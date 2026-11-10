/* =====================================================================
   LOOK IT UP, REMEMBERING THE ANSWER
   cachedLookup() is how every route gets Scryfall data:
     1. Is the answer in the notebook and still fresh? Use it. Scryfall
        is not contacted at all.
     2. Otherwise ask Scryfall (through the polite client), write the
        answer in the notebook, and return it.
     3. If Scryfall can't be reached or is busy, but an OLD answer is in
        the notebook, return that (marked "stale") instead of an error.
   Two people asking for the same thing at the same moment share one
   lookup.
   ===================================================================== */

import ScryfallCache from '../models/ScryfallCache.js';

// How long an old answer is kept as a safety net (30 days past its expiry)
const KEEP_OLD_MS = 30 * 24 * 60 * 60 * 1000;

// Lookups running right now, by key
const running = new Map();

// key:    what is being asked for ("card:set/lea/1")
// kind:   a short label for the sort of answer ("card")
// ttlMs:  how long the answer counts as fresh
// load:   a function that asks Scryfall and returns the (trimmed) answer
// Returns { data, stale } where stale is true for an old answer used
// because Scryfall couldn't be asked.
export async function cachedLookup({ key, kind, ttlMs, load, now = () => Date.now() }) {
  const saved = await ScryfallCache.findOne({ key }).lean();
  if (saved && saved.expiresAt.getTime() > now()) {
    return { data: saved.data, stale: false };
  }

  // Someone is already fetching this: wait for their answer
  if (running.has(key)) return running.get(key);

  const lookup = (async () => {
    try {
      const data = await load();
      const when = now();
      await ScryfallCache.updateOne(
        { key },
        { $set: {
          kind,
          data,
          fetchedAt: new Date(when),
          expiresAt: new Date(when + ttlMs),
          deleteAt: new Date(when + ttlMs + KEEP_OLD_MS),
        } },
        { upsert: true },
      );
      return { data, stale: false };
    } catch (err) {
      // Scryfall said "not found" (404) or "bad request": that IS the
      // answer, an old copy would be wrong. For "can't reach it", "busy"
      // or "had a problem", an old copy is better than nothing.
      const trouble = !err.status || err.status === 429 || err.status >= 500;
      if (saved && trouble) return { data: saved.data, stale: true };
      throw err;
    }
  })();

  running.set(key, lookup);
  try {
    return await lookup;
  } finally {
    running.delete(key);
  }
}
