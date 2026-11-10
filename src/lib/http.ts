/* =====================================================================
   SAFER INTERNET REQUESTS
   Every request to Scryfall (card details), and later Google Drive
   (binders), goes through fetchOrExplain, so problems come back as
   plain-English messages instead of "Failed to fetch", and
   a request that never answers doesn't leave the page stuck on
   "Loading…". (The same as the original site's binder-storage.js.)
   In the phone app, every request (and every card picture, through
   pictureSource) also says which app is asking: Scryfall refuses to
   answer phones that don't (see APP_HEADERS).
   ===================================================================== */

import { Platform } from 'react-native';

// How long to wait for a reply before giving up (20 seconds).
const REQUEST_TIMEOUT_MS = 20000;

// How the phone app introduces itself to websites (the "User-Agent").
// Scryfall turns away requests that only carry a phone's built-in
// default ("okhttp" on Android) and asks every app to name itself, so
// the phone app sends this with every request, and with every card
// picture it downloads. (A web browser always sends its own name and
// won't let a website change it, so the website leaves this out.)
const APP_USER_AGENT = 'WUBRGr/0.2 (+https://github.com/navypirate83/WUBRGrExpo)';
export const APP_HEADERS: Record<string, string> =
  Platform.OS === 'web' ? {} : { 'User-Agent': APP_USER_AGENT };

// A picture to download from Scryfall (or anywhere), with the app's
// name sent along in the phone app (see APP_HEADERS). On the website
// it's just the address: there, giving headers at all makes the picture
// load a different way, which some of Scryfall's picture servers don't
// allow (the card backs went blank). The same picture always gets the
// same object back, so a picture that hasn't changed isn't downloaded again.
// On the phone, a picture that was saved on the device earlier (see
// pictureCache.ts) is used from there instead: pictureCache.ts plugs in
// a function that says where (or null if it isn't saved yet). That way
// pictures need no internet and no data the second time.
let localPictureLookup: ((url: string) => string | null) | null = null;
export function setLocalPictureLookup(lookup: (url: string) => string | null): void {
  localPictureLookup = lookup;
}
const localSources = new Map<string, { uri: string }>();

const pictureSources = new Map<string, { uri: string; headers?: Record<string, string> }>();
export function pictureSource(url: string) {
  const local = localPictureLookup?.(url);
  if (local) {
    let source = localSources.get(local);
    if (!source) {
      source = { uri: local };
      localSources.set(local, source);
    }
    return source;
  }
  let source = pictureSources.get(url);
  if (!source) {
    source = Platform.OS === 'web' ? { uri: url } : { uri: url, headers: APP_HEADERS };
    pictureSources.set(url, source);
  }
  return source;
}

// An error that can say whether trying again might help. "offline" means
// there was no reply at all (no internet, or too slow), and "retryable"
// means asking again in a moment could work (TanStack Query, which runs
// the requests, uses it to decide whether to try again by itself).
export class RequestError extends Error {
  offline: boolean;
  retryable: boolean;
  constructor(message: string, { offline = false, retryable = false } = {}) {
    super(message);
    this.offline = offline;
    this.retryable = retryable;
  }
}

// Send a request ("fetch") and return the reply. "service" is who it's
// for, used in messages (like "Scryfall"). If there's no reply at all,
// it throws a RequestError that explains why:
//  - the device is offline (only known on the web)
//  - it took longer than REQUEST_TIMEOUT_MS ("AbortController" is the
//    way to cancel a request part way)
//  - anything else (no internet, a blocked or broken connection)
// A reply that says something went wrong (like "not found") is still a
// reply: it's returned, and the caller decides what to say.
// "timeoutMs" is how long to wait; most callers use the usual 20 seconds,
// but our own server on a free host may need a minute to wake up (api.ts).
export async function fetchOrExplain(
  url: string,
  options: RequestInit = {},
  service = 'the server',
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // The request, with the app's name added to its headers (see APP_HEADERS)
    const headers = { ...APP_HEADERS, ...(options.headers as Record<string, string> | undefined) };
    return await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err) {
    const message = navigator.onLine === false
      ? 'You\'re offline. Check your internet connection, then try again.'
      : (err as Error).name === 'AbortError'
        ? `${service} is taking too long to answer. Please try again in a moment.`
        : `Couldn't reach ${service}. Check your internet connection, then try again.`;
    throw new RequestError(message, { offline: true, retryable: true });
  } finally {
    clearTimeout(timer);
  }
}
