/* =====================================================================
   TESTS: DECK ROUTES
   Decks are an ordered line of cards, each in the main deck, the sideboard
   or the command zone, in a format. The order sent must be the order kept, a
   bad card must stop the whole save, and nobody can reach anyone else's deck.
   ===================================================================== */

import request from 'supertest';
import app from '../../app.js';
import Deck from '../../models/Deck.js';
import DeckCard from '../../models/DeckCard.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer, aCard } from '../helpers/users.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

// A deck card is a card without page and pocket
const dc = (name, extra = {}) => {
  const { page, pocket, ...rest } = aCard(1, 1, { name, manaCost: '{1}{U}', typeLine: 'Instant', ...extra });
  return rest;
};

async function setup() {
  const user = await makeUser();
  const auth = bearer(user);
  return {
    get: (url) => request(app).get(url).set('Authorization', auth),
    post: (url, body) => request(app).post(url).set('Authorization', auth).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', auth).send(body),
    del: (url) => request(app).delete(url).set('Authorization', auth),
  };
}

test('make, rename and delete a deck; the same name twice and a bad format are refused', async () => {
  const me = await setup();
  const made = await me.post('/decks', { name: 'Goblins', format: 'modern' });
  expect(made.status).toBe(201);
  expect(made.body.format).toBe('modern');
  expect((await me.post('/decks', { name: 'goblins' })).status).toBe(409);
  expect((await me.post('/decks', { name: 'Brawl', format: 'brawl' })).status).toBe(400);
  const renamed = await me.put(`/decks/${made.body._id}`, { name: 'Krenko', format: 'commander' });
  expect(renamed.body).toMatchObject({ name: 'Krenko', format: 'commander' });
  expect((await me.post('/decks', { name: '   ' })).status).toBe(400);
  expect((await me.del(`/decks/${made.body._id}`)).status).toBe(204);
  expect(await Deck.countDocuments()).toBe(0);
});

test('a deck made with no format is a Commander deck', async () => {
  const me = await setup();
  expect((await me.post('/decks', { name: 'Plain' })).body.format).toBe('commander');
});

test('cards keep the order and the zone they were sent in, and are replaced as a whole', async () => {
  const me = await setup();
  const { _id } = (await me.post('/decks', { name: 'Ordered' })).body;
  const cards = [
    dc('Krenko, Mob Boss', { zone: 'command', slot: 0, extra: { Pairing: '[]', 'Color identity': 'R' } }),
    dc('Zebra'),
    dc('Side Card', { zone: 'side' }),
  ];
  expect((await me.put(`/decks/${_id}/cards`, { cards })).body).toEqual({ saved: 3 });
  const read = await me.get(`/decks/${_id}/cards`);
  expect(read.body.map((c) => c.name)).toEqual(['Krenko, Mob Boss', 'Zebra', 'Side Card']);
  expect(read.body[0]).toMatchObject({ zone: 'command', slot: 0, manaCost: '{1}{U}', typeLine: 'Instant' });
  expect(read.body[1].zone).toBeUndefined();
  expect(read.body[2].zone).toBe('side');
  await me.put(`/decks/${_id}/cards`, { cards: [dc('Only')] });
  expect(await DeckCard.countDocuments()).toBe(1);
});

test('one bad card or a bad zone rejects the whole save and keeps the old cards', async () => {
  const me = await setup();
  const { _id } = (await me.post('/decks', { name: 'Safe' })).body;
  await me.put(`/decks/${_id}/cards`, { cards: [dc('Keep')] });
  const bad = await me.put(`/decks/${_id}/cards`, { cards: [dc('Fine'), dc('Bad', { count: 100 })] });
  expect(bad.status).toBe(400);
  expect(bad.body.error).toMatch(/^Card 1:/);
  expect((await me.put(`/decks/${_id}/cards`, { cards: [dc('X', { zone: 'graveyard' })] })).status).toBe(400);
  expect((await me.put(`/decks/${_id}/cards`, { cards: [dc('X', { zone: 'command', slot: 2 })] })).status).toBe(400);
  expect((await me.get(`/decks/${_id}/cards`)).body.map((c) => c.name)).toEqual(['Keep']);
});

test('the deck shows its card count, and deleting it deletes its cards', async () => {
  const me = await setup();
  const { _id } = (await me.post('/decks', { name: 'Counted' })).body;
  await me.put(`/decks/${_id}/cards`, { cards: [dc('A'), dc('B')] });
  expect((await me.get('/decks')).body[0].cardCount).toBe(2);
  await me.del(`/decks/${_id}`);
  expect(await DeckCard.countDocuments()).toBe(0);
});

test('nobody can see, change or delete another person\'s deck, and a deck needs a sign-in', async () => {
  const mine = await setup();
  const theirs = await setup();
  const { _id } = (await mine.post('/decks', { name: 'Private' })).body;
  await mine.put(`/decks/${_id}/cards`, { cards: [dc('Secret')] });
  expect((await theirs.get(`/decks/${_id}`)).status).toBe(404);
  expect((await theirs.get(`/decks/${_id}/cards`)).status).toBe(404);
  expect((await theirs.put(`/decks/${_id}`, { name: 'Taken' })).status).toBe(404);
  expect((await theirs.put(`/decks/${_id}/cards`, { cards: [] })).status).toBe(404);
  expect((await theirs.del(`/decks/${_id}`)).status).toBe(404);
  expect((await theirs.get('/decks')).body).toEqual([]);
  expect((await request(app).get('/decks')).status).toBe(401);
  expect(await DeckCard.countDocuments()).toBe(1);
});
