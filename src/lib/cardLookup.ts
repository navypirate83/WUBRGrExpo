/* =====================================================================
   WHERE CARD INFORMATION COMES FROM
   Every card lookup in scryfall.ts goes through lookup() below, which
   decides where the answer comes from:

   NOT LOGGED IN: straight from Scryfall, from this device, exactly as
   before. Nothing is saved and our server is never used.

   LOGGED IN, in this order:
     1. The copy saved on this device, if it's still fresh. No internet
        needed at all, and it's instant.
     2. Our server, which remembers answers for everybody and asks
        Scryfall politely (the server is the one place that has to stay
        under Scryfall's limits for all of its users together).
     3. Scryfall directly, if our server can't be reached (it may be
        asleep, or down).
     4. The saved copy even though it's old, if nothing at all can be
        reached. That's what makes searching and viewing cards work with
        no internet.
   Every answer that arrives is saved on the device for next time.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { ApiError, apiRequest, isOffline } from './api';
import { readSaved, writeSaved } from './cardCache';
import { RequestError } from './http';
import { isServerSignedIn } from './session';

// How long to wait for our server before trying Scryfall directly (8
// seconds: a sleeping free server takes up to a minute to wake, and a
// card search shouldn't hang that long)
const SERVER_WAIT_MS = 8000;

// After our server fails to answer, skip it for this long (a minute) so
// every following lookup doesn't wait for it again
const SKIP_SERVER_MS = 60 * 1000;
let skipServerUntil = 0;

// The server answers "stale" when it had to use an older copy of its own.
// Such an answer is saved as if it were nearly out of date, so the app
// asks again soon (in 10 minutes).
const RETRY_STALE_MS = 10 * 60 * 1000;

// Answers read or written during this visit, kept ready in memory so the
// same answer isn't read from the device's storage over and over
const inMemory = new Map<string, { data: unknown; savedAt: number }>();
// (a card with every printing can be over a megabyte, so only a few)
const MAX_IN_MEMORY = 30;

function remember(key: string, data: unknown, savedAt: number): void {
  inMemory.delete(key);
  inMemory.set(key, { data, savedAt });
  if (inMemory.size > MAX_IN_MEMORY) inMemory.delete(inMemory.keys().next().value as string);
}

// Ask our server for something. (The server answers with { ..., stale }.)
export function serverGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { timeoutMs: SERVER_WAIT_MS });
}
export function serverPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body, timeoutMs: SERVER_WAIT_MS });
}

// Is our server worth trying right now?
export function serverUsable(): boolean {
  return isServerSignedIn() && Date.now() >= skipServerUntil;
}

// Note that our server didn't answer, unless the answer was just "no such
// card" (404): that is a real answer, passed on as an error
export function serverFailed(err: unknown): void {
  if (err instanceof ApiError && err.status === 404) throw new RequestError(err.message);
  // Not reachable, or it had trouble: leave it alone for a minute
  if (isOffline(err) || (err instanceof ApiError && err.status >= 500)) {
    skipServerUntil = Date.now() + SKIP_SERVER_MS;
  }
}

// Get one answer.
//   key:      what this answer is called when saved on the device
//   freshMs:  how long a saved copy counts as fresh
//   server:   asks our server (leave out where the server has no such thing)
//   direct:   asks Scryfall directly (the original way)
export async function lookup<T>(options: {
  key: string;
  freshMs: number;
  server?: () => Promise<{ data: T; stale: boolean }>;
  direct: () => Promise<T>;
}): Promise<T> {
  const { key, freshMs, server, direct } = options;

  // Not logged in: as before, and nothing is saved
  if (!isServerSignedIn()) return direct();

  // 1. A fresh copy saved on this device
  const saved = inMemory.get(key) ?? (await readSaved<T>(key));
  if (saved) remember(key, saved.data, saved.savedAt);
  if (saved && Date.now() - saved.savedAt < freshMs) return saved.data as T;

  // 2. Our server
  if (server && serverUsable()) {
    try {
      const { data, stale } = await server();
      const savedAt = stale ? Date.now() - freshMs + RETRY_STALE_MS : Date.now();
      remember(key, data, savedAt);
      void writeSaved(key, data, savedAt);
      return data;
    } catch (err) {
      serverFailed(err);
    }
  }

  // 3. Scryfall directly
  try {
    const data = await direct();
    const savedAt = Date.now();
    remember(key, data, savedAt);
    void writeSaved(key, data, savedAt);
    return data;
  } catch (err) {
    // 4. Nothing could be reached: an old saved copy is better than nothing.
    // (But not when Scryfall really answered "no such card".)
    const couldNotReach = err instanceof RequestError && (err.offline || err.retryable);
    if (saved && couldNotReach) return saved.data as T;
    throw err;
  }
}
