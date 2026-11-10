/* =====================================================================
   THE SCRYFALL CLIENT (the server's one and only way to talk to Scryfall)
   Scryfall is free, and in return it asks every program to be polite:
     - wait about 50 to 100 milliseconds between requests (so no more
       than about 10 a second)
     - send a "User-Agent" (who we are) and an "Accept" header
     - if it says "slow down" (error 429), actually slow down
   Scryfall counts requests per internet address. Every logged-in user
   shares this server's ONE address, so one rude moment could get the
   whole app blocked. That is why every request goes through here:
     1. ONE LINE: requests wait in a single queue, one at a time, with a
        gap between them, no matter how many people are asking.
     2. SHARED ANSWERS: if the same request is already on its way, the
        second asker waits for the first one's answer instead of sending
        a copy.
     3. BACK OFF: after a 429 we stop contacting Scryfall for a while
        (the time it asks for, or a minute, doubling if it keeps
        happening). Requests during that pause fail at once, without
        bothering Scryfall.
     4. ONLY SCRYFALL: we only ever call api.scryfall.com, so nobody can
        trick the server into fetching some other website.
   Plain JavaScript with no database in it, so it can be tested alone.
   ===================================================================== */

// Who we are, so Scryfall can contact us if we ever misbehave
const USER_AGENT = 'WUBRGr/1.0 (+https://github.com/navypirate83/WUBRGrExpo)';

// An error from Scryfall, or from not being able to reach it.
//  - status: Scryfall's own number (404 not found, 429 slow down...), or
//    0 when there was no reply at all
//  - retryAfterSeconds: only for 429, how long we're pausing for
export class ScryfallError extends Error {
  constructor(status, message, retryAfterSeconds) {
    super(message);
    this.name = 'ScryfallError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// A pause: "await sleep(100)" waits 100 milliseconds
const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Makes a client. The options exist so the tests can fake the internet
// and the clock; the server just calls createScryfallClient() with none.
export function createScryfallClient({
  fetchFn = (...args) => fetch(...args),
  sleep = realSleep,
  now = () => Date.now(),
  baseUrl = 'https://api.scryfall.com',
  gapMs = 120,            // the wait between two requests (a little over Scryfall's 100)
  timeoutMs = 15000,      // give up on one request after 15 seconds
  pauseSeconds = 60,      // how long to pause after a 429 that doesn't say
  maxPauseSeconds = 900,  // never pause longer than 15 minutes
} = {}) {
  // When the last request was sent (to keep the gap)
  let lastSentAt = 0;
  // Until this time we don't contact Scryfall at all (after a 429)
  let pausedUntil = 0;
  // How many 429s in a row (each one doubles the pause)
  let tooManyInARow = 0;
  // The end of the line: each new request waits for the one before it
  let lineEnd = Promise.resolve();
  // Requests on their way right now, so a copy can share the answer
  const onTheirWay = new Map();

  // If we're pausing, throw the "busy" error right away
  function refuseIfPaused() {
    const left = pausedUntil - now();
    if (left > 0) {
      const seconds = Math.ceil(left / 1000);
      throw new ScryfallError(429, 'Scryfall asked us to slow down. Please try again in a moment.', seconds);
    }
  }

  // The actual trip to Scryfall. Only ever runs one at a time.
  async function send(url, method, body) {
    // We may have started pausing while this request waited in line
    refuseIfPaused();

    // Keep the polite gap since the last request
    const wait = lastSentAt + gapMs - now();
    if (wait > 0) await sleep(wait);
    lastSentAt = now();

    let response;
    try {
      response = await fetchFn(url, {
        method,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json;q=0.9,*/*;q=0.8',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // No reply at all (offline, too slow)
      throw new ScryfallError(0, 'Scryfall could not be reached.');
    }

    // "Slow down": pause, and pause longer if it keeps happening
    if (response.status === 429) {
      tooManyInARow += 1;
      const asked = Number(response.headers.get('retry-after'));
      const base = Number.isFinite(asked) && asked > 0 ? asked : pauseSeconds;
      const seconds = Math.min(maxPauseSeconds, base * 2 ** (tooManyInARow - 1));
      pausedUntil = now() + seconds * 1000;
      throw new ScryfallError(429, 'Scryfall asked us to slow down. Please try again in a moment.', seconds);
    }
    tooManyInARow = 0;

    // Read the reply. Scryfall sends JSON, with a "details" sentence for errors.
    let data = null;
    try { data = await response.json(); } catch { /* not JSON: handled below */ }
    if (response.ok && data) return data;
    throw new ScryfallError(
      response.status,
      (data && typeof data.details === 'string' && data.details) || `Scryfall had a problem (error ${response.status}).`,
    );
  }

  // Ask for something. The same request already on its way shares its answer.
  function request(path, method, body) {
    // Only api.scryfall.com: a path ("/cards/named?...") or one of
    // Scryfall's own full addresses (like a "next page" link)
    const url = path.startsWith('http') ? path : baseUrl + path;
    if (!url.startsWith(baseUrl + '/')) {
      return Promise.reject(new ScryfallError(400, 'Only Scryfall addresses are allowed.'));
    }
    try { refuseIfPaused(); } catch (err) { return Promise.reject(err); }

    const sameAs = `${method} ${url} ${body === undefined ? '' : JSON.stringify(body)}`;
    const already = onTheirWay.get(sameAs);
    if (already) return already;

    // Join the end of the line
    const job = lineEnd.then(() => send(url, method, body));
    lineEnd = job.catch(() => {});
    onTheirWay.set(sameAs, job);
    job.catch(() => {}).finally(() => onTheirWay.delete(sameAs));
    return job;
  }

  return {
    get: (path) => request(path, 'GET'),
    post: (path, body) => request(path, 'POST', body),
  };
}

// The one client the whole server shares (so the one line and the pause
// really are shared by every user)
export const scryfall = createScryfallClient();
