/* =====================================================================
   TALKING TO THE WUBRG'R SERVER
   Every request to our own server (sign in, binders, lists) goes through
   apiRequest(), so the rules live in one place:
   - the login token ("access token") is added to each request
   - the token only lasts 15 minutes. When the server says it ran out
     (error 401), we quietly ask for a new one with the long-lasting
     "refresh token" and try the request again, once.
   - several requests can run out at the same moment. They SHARE one
     refresh, because a refresh token works only once: using it twice
     would look like theft and sign you out everywhere.
   - a server on a free host goes to sleep when nobody uses it and takes
     up to a minute to wake. If a reply is slow, listeners (a screen) are
     told so it can say "Waking the server…" instead of looking frozen.
   - no reply at all gives a plain-English RequestError (see http.ts)
   This file doesn't know where the refresh token is kept: session.ts
   plugs that in with setAuthHandlers(), so the two files don't need each
   other. Plain TypeScript with no React in it.
   ===================================================================== */

import { RequestError, fetchOrExplain } from './http';

// The server's address. It is set when the app is built
// (EXPO_PUBLIC_API_URL). Without it the app talks to a server on this
// same computer, which is what you want while testing on the website.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4100').replace(/\/+$/, '');

// How long to wait for the server before giving up: a minute, because a
// free host that went to sleep needs that long to wake up
const SERVER_TIMEOUT_MS = 60000;

// How long a slow reply may take before we tell the screen the server
// is probably waking up (4 seconds)
const WAKING_AFTER_MS = 4000;

// An error the server answered with (wrong password, not found...).
// "status" is the number it sent (400, 401, 404, 409...) and the
// message is the server's own plain-English sentence.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The short-lived login token we hold right now, kept in memory only.
// (The long-lasting one is kept safely by session.ts.)
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// The two jobs session.ts does for us: get a new pair of tokens using
// the saved refresh token, and what to do when that fails for good
// (the person has to sign in again).
type AuthHandlers = {
  refresh: () => Promise<boolean>;   // true if we now have a fresh access token
  signedOut: () => void;
};
let handlers: AuthHandlers = { refresh: async () => false, signedOut: () => {} };
export function setAuthHandlers(next: AuthHandlers): void {
  handlers = next;
}

// Screens that want to know "the server is slow, probably waking up".
// Each listener gets true when it starts being slow and false when the
// reply arrives (or fails).
const wakingListeners = new Set<(waking: boolean) => void>();
export function onServerWaking(listener: (waking: boolean) => void): () => void {
  wakingListeners.add(listener);
  return () => { wakingListeners.delete(listener); };
}
function tellWaking(waking: boolean): void {
  for (const listener of wakingListeners) listener(waking);
}

// The refresh that is running right now, if any. Everyone who needs a
// new token while it runs waits for the same one.
let refreshing: Promise<boolean> | null = null;
export function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = handlers.refresh().finally(() => { refreshing = null; });
  }
  return refreshing;
}

// One trip to the server, no retrying. Returns the reply.
// (timeoutMs is how long to wait for this one request. Most use the full
// minute; card lookups give up sooner, see scryfall.ts.)
async function sendOnce(
  path: string, method: string, body: unknown, useToken: boolean, timeoutMs: number,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (useToken && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  // If the reply is slow, tell the screens the server may be waking up
  const timer = setTimeout(() => tellWaking(true), WAKING_AFTER_MS);
  try {
    return await fetchOrExplain(
      `${API_URL}${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
      'the WUBRG\'r server',
      SERVER_TIMEOUT_MS,
    );
  } finally {
    clearTimeout(timer);
    tellWaking(false);
  }
}

// Ask the server for something and get its answer back as data.
//   apiRequest('/binders')                       → a list
//   apiRequest('/auth/login', { method: 'POST', body: {...}, auth: false })
// auth: false is for sign-in and sign-up, which have no token yet.
// timeoutMs: how long to wait before giving up (a minute if left out).
// Throws ApiError (the server said no) or RequestError (no reply).
export async function apiRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = SERVER_TIMEOUT_MS } = options;

  let response = await sendOnce(path, method, body, auth, timeoutMs);

  // The token ran out: get a new one and try once more
  if (auth && response.status === 401) {
    if (await refreshOnce()) {
      response = await sendOnce(path, method, body, auth, timeoutMs);
    } else {
      handlers.signedOut();
    }
  }

  // Read the reply. Not every reply has a body (a delete says "204").
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON: use the fallback below */ }

  if (!response.ok) {
    const message = (data as { error?: string } | null)?.error
      ?? (response.status >= 500 ? 'The server had a problem. Please try again in a moment.' : 'Something went wrong.');
    throw new ApiError(response.status, message);
  }
  return data as T;
}

// Is this error "no reply at all" (offline, slow, unreachable)? Used to
// decide to keep changes on the device and try again later.
export function isOffline(err: unknown): boolean {
  return err instanceof RequestError && err.offline;
}
