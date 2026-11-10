/* =====================================================================
   TESTS: THE SCRYFALL ANSWER NOTEBOOK
   Checks that answers are remembered, that Scryfall is not asked again
   while an answer is fresh, that an old answer is used when Scryfall is
   down, and that a "not found" is never hidden behind an old answer.
   ===================================================================== */

import { cachedLookup } from '../../utils/scryfallCache.js';
import { ScryfallError } from '../../utils/scryfallClient.js';
import ScryfallCache from '../../models/ScryfallCache.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const HOUR = 60 * 60 * 1000;

test('the first lookup asks Scryfall and the second, while fresh, does not', async () => {
  let asked = 0;
  const load = async () => { asked += 1; return { name: 'Sol Ring' }; };
  const first = await cachedLookup({ key: 'card:a', kind: 'card', ttlMs: HOUR, load });
  const second = await cachedLookup({ key: 'card:a', kind: 'card', ttlMs: HOUR, load });
  expect(first).toEqual({ data: { name: 'Sol Ring' }, stale: false });
  expect(second).toEqual({ data: { name: 'Sol Ring' }, stale: false });
  expect(asked).toBe(1);
  expect(await ScryfallCache.countDocuments({ key: 'card:a' })).toBe(1);
});

test('two lookups at the same moment share one question to Scryfall', async () => {
  let asked = 0;
  const load = async () => { asked += 1; await new Promise((r) => setTimeout(r, 30)); return { n: 1 }; };
  const [one, two] = await Promise.all([
    cachedLookup({ key: 'card:b', kind: 'card', ttlMs: HOUR, load }),
    cachedLookup({ key: 'card:b', kind: 'card', ttlMs: HOUR, load }),
  ]);
  expect(asked).toBe(1);
  expect(one.data).toEqual(two.data);
});

test('an old answer is refreshed from Scryfall when it can be', async () => {
  let version = 1;
  const load = async () => ({ version: version++ });
  await cachedLookup({ key: 'card:c', kind: 'card', ttlMs: HOUR, load, now: () => 0 });
  // Two hours later the answer has expired
  const later = await cachedLookup({ key: 'card:c', kind: 'card', ttlMs: HOUR, load, now: () => 2 * HOUR });
  expect(later).toEqual({ data: { version: 2 }, stale: false });
});

test('when Scryfall is down, an old answer is used and marked stale', async () => {
  await cachedLookup({ key: 'card:d', kind: 'card', ttlMs: HOUR, load: async () => ({ name: 'Old' }), now: () => Date.now() - 2 * HOUR });
  const down = async () => { throw new ScryfallError(0, 'Scryfall could not be reached.'); };
  const result = await cachedLookup({ key: 'card:d', kind: 'card', ttlMs: HOUR, load: down });
  expect(result).toEqual({ data: { name: 'Old' }, stale: true });
});

test('when Scryfall is busy (429), an old answer is used too', async () => {
  await cachedLookup({ key: 'card:e', kind: 'card', ttlMs: HOUR, load: async () => ({ name: 'Old' }), now: () => Date.now() - 2 * HOUR });
  const busy = async () => { throw new ScryfallError(429, 'slow down', 30); };
  const result = await cachedLookup({ key: 'card:e', kind: 'card', ttlMs: HOUR, load: busy });
  expect(result.stale).toBe(true);
});

test('a "not found" is passed on, never hidden behind an old answer', async () => {
  await cachedLookup({ key: 'card:f', kind: 'card', ttlMs: HOUR, load: async () => ({ name: 'Old' }), now: () => Date.now() - 2 * HOUR });
  const missing = async () => { throw new ScryfallError(404, 'No cards found'); };
  await expect(cachedLookup({ key: 'card:f', kind: 'card', ttlMs: HOUR, load: missing })).rejects.toMatchObject({ status: 404 });
});

test('with nothing saved and Scryfall down, the error is passed on', async () => {
  const down = async () => { throw new ScryfallError(0, 'Scryfall could not be reached.'); };
  await expect(cachedLookup({ key: 'card:g', kind: 'card', ttlMs: HOUR, load: down })).rejects.toMatchObject({ status: 0 });
});

test('rows get a self-destruct date after the expiry', async () => {
  await cachedLookup({ key: 'card:h', kind: 'card', ttlMs: HOUR, load: async () => ({ a: 1 }) });
  const row = await ScryfallCache.findOne({ key: 'card:h' }).lean();
  expect(row.deleteAt.getTime()).toBeGreaterThan(row.expiresAt.getTime());
});
