/* =====================================================================
   TESTS: CARD INFORMATION ROUTES (/scryfall/...)
   A fake Scryfall stands in for the real one (these tests never touch
   the internet), so we can count exactly how often "Scryfall" is asked.
   The things to prove: only logged-in people get in, answers are
   trimmed and remembered, Scryfall is spared repeat questions, odd
   input is turned away before Scryfall is asked, and Scryfall's
   troubles become plain answers.
   ===================================================================== */

import express from 'express';
import request from 'supertest';
import app from '../../app.js';
import ScryfallCache from '../../models/ScryfallCache.js';
import { requireAuth } from '../../middleware/auth.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { createScryfallRouter } from '../../routes/scryfall.js';
import { createScryfallService } from '../../utils/scryfallService.js';
import { ScryfallError } from '../../utils/scryfallClient.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer } from '../helpers/users.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

// A card as the real Scryfall sends it: with lots of parts the app never uses
const rawCard = (id, set, number, extra = {}) => ({
  id,
  oracle_id: 'oracle-1',
  name: 'Sol Ring',
  lang: 'en',
  set,
  set_name: 'A Set',
  collector_number: number,
  released_at: '2021-01-01',
  scryfall_uri: `https://scryfall.com/card/${set}/${number}`,
  prints_search_uri: 'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-1&unique=prints',
  rulings_uri: `https://api.scryfall.com/cards/${id}/rulings`,
  image_uris: { small: 's', normal: 'n', large: 'l', png: 'p', border_crop: 'b' },
  prices: { usd: '1.50', usd_foil: null, tix: '0.01' },
  oracle_text: 'Tap: Add two colorless mana.',
  edhrec_rank: 1,
  related_uris: { gatherer: 'x' },
  ...extra,
});

// A fake Scryfall: answers from a table, and counts the questions
function fakeScryfall(table = {}) {
  const calls = { get: [], post: [] };
  return {
    calls,
    table,
    async get(path) {
      calls.get.push(path);
      const answer = table[path];
      if (answer instanceof Error) throw answer;
      if (answer === undefined) throw new ScryfallError(404, 'No cards found');
      return answer;
    },
    async post(path, body) {
      calls.post.push(body);
      const answer = table.collection;
      if (answer instanceof Error) throw answer;
      const wanted = body.identifiers;
      return { data: answer(wanted) };
    },
  };
}

// A small app with just the card routes, using the fake Scryfall
function appWith(client, limit = 100000) {
  const mini = express();
  mini.use(express.json());
  mini.use('/scryfall', requireAuth, createScryfallRouter(createScryfallService(client), limit));
  mini.use(errorHandler);
  return mini;
}

async function signedIn(client, limit) {
  const user = await makeUser();
  const mini = appWith(client, limit);
  const auth = bearer(user);
  return {
    get: (url) => request(mini).get(url).set('Authorization', auth),
    post: (url, body) => request(mini).post(url).set('Authorization', auth).send(body),
  };
}

test('only logged-in people can use the card routes', async () => {
  expect((await request(app).get('/scryfall/names')).status).toBe(401);
  expect((await request(app).post('/scryfall/cards/collection').send({ identifiers: [] })).status).toBe(401);
});

test('names: sent from Scryfall once, then from the notebook', async () => {
  const client = fakeScryfall({ '/catalog/card-names': { data: ['Sol Ring', 'Island'] } });
  const me = await signedIn(client);
  const first = await me.get('/scryfall/names');
  const second = await me.get('/scryfall/names');
  expect(first.body).toEqual({ names: ['Sol Ring', 'Island'], stale: false });
  expect(second.body.names).toEqual(['Sol Ring', 'Island']);
  expect(client.calls.get).toHaveLength(1);
});

test('sets: a lookup from set code to picture address', async () => {
  const client = fakeScryfall({ '/sets': { data: [{ code: 'lea', icon_svg_uri: 'a.svg', name: 'Alpha' }, { code: 'neo', icon_svg_uri: 'b.svg' }] } });
  const me = await signedIn(client);
  const res = await me.get('/scryfall/sets');
  expect(res.body.icons).toEqual({ lea: 'a.svg', neo: 'b.svg' });
});

test('a card by name is trimmed down and remembered', async () => {
  const client = fakeScryfall({ '/cards/named?exact=Sol%20Ring': rawCard(ID_A, 'c21', '263') });
  const me = await signedIn(client);
  const res = await me.get('/scryfall/cards/named?exact=Sol%20Ring');
  expect(res.status).toBe(200);
  expect(res.body.card.name).toBe('Sol Ring');
  expect(res.body.card.image_uris).toEqual({ small: 's', normal: 'n', large: 'l', png: 'p' });
  expect(res.body.card.prices).toMatchObject({ usd: '1.50', usd_foil: null });
  // the rules text is kept (the card menu shows it); the long extras are not
  expect(res.body.card).toHaveProperty('oracle_text', 'Tap: Add two colorless mana.');
  expect(res.body.card).not.toHaveProperty('edhrec_rank');
  expect(res.body.card).not.toHaveProperty('related_uris');
  expect(res.body.card.prices).not.toHaveProperty('tix');
  await me.get('/scryfall/cards/named?exact=sol%20ring');
  expect(client.calls.get).toHaveLength(1);
});

test('a card Scryfall does not know is a plain 404 with its sentence', async () => {
  const client = fakeScryfall({});
  const me = await signedIn(client);
  const res = await me.get('/scryfall/cards/named?fuzzy=zzzz');
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('No cards found');
});

test('odd input is refused without asking Scryfall', async () => {
  const client = fakeScryfall({});
  const me = await signedIn(client);
  expect((await me.get('/scryfall/cards/named')).status).toBe(400);
  expect((await me.get('/scryfall/cards/named?exact=')).status).toBe(400);
  expect((await me.get('/scryfall/cards/set/not%20a%20set/1')).status).toBe(400);
  expect((await me.get('/scryfall/cards/set/lea/a%2Fb')).status).toBe(400);
  expect((await me.get('/scryfall/cards/id/not-an-id')).status).toBe(400);
  expect((await me.get('/scryfall/cards/id/not-an-id/rulings')).status).toBe(400);
  expect((await me.post('/scryfall/cards/collection', { identifiers: [] })).status).toBe(400);
  expect((await me.post('/scryfall/cards/collection', { identifiers: [{ set: '../x', number: '1' }] })).status).toBe(400);
  expect((await me.post('/scryfall/cards/collection', { identifiers: Array.from({ length: 151 }, () => ({ id: ID_A })) })).status).toBe(400);
  expect(client.calls.get).toHaveLength(0);
  expect(client.calls.post).toHaveLength(0);
});

test('a card by set and number', async () => {
  const client = fakeScryfall({ '/cards/c21/263': rawCard(ID_A, 'c21', '263') });
  const me = await signedIn(client);
  const res = await me.get('/scryfall/cards/set/C21/263');
  expect(res.body.card.id).toBe(ID_A);
});

test('every printing: follows the pages and trims each card', async () => {
  const next = 'https://api.scryfall.com/cards/search?page=2';
  const client = fakeScryfall({
    [`/cards/${ID_A}`]: rawCard(ID_A, 'c21', '263'),
    'https://api.scryfall.com/cards/search?order=released&q=oracleid%3Aoracle-1&unique=prints':
      { data: [rawCard(ID_A, 'c21', '263')], has_more: true, next_page: next },
    [next]: { data: [rawCard(ID_B, 'lea', '1')], has_more: false },
  });
  const me = await signedIn(client);
  const res = await me.get(`/scryfall/cards/id/${ID_A}/prints`);
  expect(res.body.cards.map((c) => c.set)).toEqual(['c21', 'lea']);
  expect(res.body.cards[0]).toHaveProperty('oracle_text');
  expect(res.body.cards[0]).not.toHaveProperty('edhrec_rank');
});

test('rulings and languages', async () => {
  const query = encodeURIComponent('set:c21 cn:"263" lang:any');
  const client = fakeScryfall({
    [`/cards/${ID_A}/rulings`]: { data: [{ source: 'wotc', published_at: '2020-01-01', comment: 'Hello', oracle_id: 'x' }] },
    [`/cards/search?unique=prints&q=${query}`]: { data: [rawCard(ID_A, 'c21', '263'), rawCard(ID_B, 'c21', '263', { lang: 'ja' })] },
  });
  const me = await signedIn(client);
  const rulings = await me.get(`/scryfall/cards/id/${ID_A}/rulings`);
  expect(rulings.body.rulings).toEqual([{ source: 'wotc', published_at: '2020-01-01', comment: 'Hello' }]);
  const languages = await me.get('/scryfall/cards/set/c21/263/languages');
  expect(languages.body.cards.map((c) => c.lang)).toEqual(['en', 'ja']);
});

// A fake "collection" answer: a card for each set/number asked about,
// except the set "zzz" (which Scryfall doesn't know)
const knows = (wanted) => wanted
  .filter((w) => w.set !== 'zzz')
  .map((w) => rawCard(`aaaaaaaa-aaaa-4aaa-8aaa-${w.set.charCodeAt(0)}${String(w.collector_number).padStart(9, '0')}`, w.set, w.collector_number));

test('many cards at once: Scryfall is asked once, then the notebook answers', async () => {
  const client = fakeScryfall({ collection: knows });
  const me = await signedIn(client);
  const ask = { identifiers: [{ set: 'lea', number: '1' }, { set: 'neo', number: '5' }, { set: 'zzz', number: '9' }] };
  const first = await me.post('/scryfall/cards/collection', ask);
  expect(first.status).toBe(200);
  expect(first.body.cards.map((c) => `${c.set}/${c.collector_number}`)).toEqual(['lea/1', 'neo/5']);
  expect(first.body.notFound).toEqual([{ set: 'zzz', number: '9' }]);
  expect(first.body.unavailable).toEqual([]);

  // The same cards again: only the unknown one needs Scryfall
  const second = await me.post('/scryfall/cards/collection', ask);
  expect(second.body.cards).toHaveLength(2);
  expect(client.calls.post).toHaveLength(2);
  expect(client.calls.post[1].identifiers).toEqual([{ set: 'zzz', collector_number: '9' }]);

  // And a card is also found by its Scryfall ID once it's been seen
  const id = first.body.cards[0].id;
  const byId = await me.post('/scryfall/cards/collection', { identifiers: [{ id }] });
  expect(byId.body.cards[0].id).toBe(id);
  expect(client.calls.post).toHaveLength(2);
});

test('big piles are sent to Scryfall 75 at a time', async () => {
  const client = fakeScryfall({ collection: knows });
  const me = await signedIn(client);
  const identifiers = Array.from({ length: 100 }, (_, i) => ({ set: 'lea', number: String(i + 1) }));
  const res = await me.post('/scryfall/cards/collection', { identifiers });
  expect(res.body.cards).toHaveLength(100);
  expect(client.calls.post.map((b) => b.identifiers.length)).toEqual([75, 25]);
});

test('when Scryfall is down: saved copies are used (stale), the rest are "unavailable"', async () => {
  const client = fakeScryfall({ collection: knows });
  const me = await signedIn(client);
  await me.post('/scryfall/cards/collection', { identifiers: [{ set: 'lea', number: '1' }] });
  // Make the saved copy old, then take Scryfall away
  await ScryfallCache.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  client.table.collection = new ScryfallError(0, 'Scryfall could not be reached.');

  const res = await me.post('/scryfall/cards/collection', {
    identifiers: [{ set: 'lea', number: '1' }, { set: 'neo', number: '5' }],
  });
  expect(res.status).toBe(200);
  expect(res.body.stale).toBe(true);
  expect(res.body.cards.map((c) => c.set)).toEqual(['lea']);
  expect(res.body.unavailable).toEqual([{ set: 'neo', number: '5' }]);
  expect(res.body.notFound).toEqual([]);
});

test('Scryfall saying "slow down" becomes a 503 with Retry-After', async () => {
  const client = fakeScryfall({ '/catalog/card-names': new ScryfallError(429, 'slow', 42) });
  const me = await signedIn(client);
  const res = await me.get('/scryfall/names');
  expect(res.status).toBe(503);
  expect(res.headers['retry-after']).toBe('42');
});

test('Scryfall being unreachable becomes a plain 502', async () => {
  const client = fakeScryfall({ '/catalog/card-names': new ScryfallError(0, 'Scryfall could not be reached.') });
  const me = await signedIn(client);
  const res = await me.get('/scryfall/names');
  expect(res.status).toBe(502);
  expect(res.body.error).not.toMatch(/ECONN|stack|at /);
});

test('each person has their own limit per minute', async () => {
  const client = fakeScryfall({ '/catalog/card-names': { data: ['Island'] } });
  const mini = appWith(client, 2);
  const one = bearer(await makeUser());
  const two = bearer(await makeUser());
  const get = (auth) => request(mini).get('/scryfall/names').set('Authorization', auth);
  expect((await get(one)).status).toBe(200);
  expect((await get(one)).status).toBe(200);
  expect((await get(one)).status).toBe(429);
  // Someone else is not affected
  expect((await get(two)).status).toBe(200);
});
