/* =====================================================================
   TESTS: CARD LIST ROUTES
   Lists are an ordered line of cards: the order sent must be the order
   kept, and a bad card must stop the whole save.
   ===================================================================== */

import request from 'supertest';
import app from '../../app.js';
import List from '../../models/List.js';
import ListCard from '../../models/ListCard.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer, aCard } from '../helpers/users.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

// A list card is a card without page and pocket
const lc = (name, extra = {}) => {
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

test('make, rename and delete a list; the same name twice is refused', async () => {
  const me = await setup();
  const made = await me.post('/lists', { name: 'Wishlist' });
  expect(made.status).toBe(201);
  expect((await me.post('/lists', { name: 'wishlist' })).status).toBe(409);
  const renamed = await me.put(`/lists/${made.body._id}`, { name: 'Wants' });
  expect(renamed.body.name).toBe('Wants');
  expect((await me.post('/lists', { name: '   ' })).status).toBe(400);
  expect((await me.del(`/lists/${made.body._id}`)).status).toBe(204);
  expect(await List.countDocuments()).toBe(0);
});

test('cards keep the order they were sent in, and are replaced as a whole', async () => {
  const me = await setup();
  const { _id } = (await me.post('/lists', { name: 'Ordered' })).body;
  const saved = await me.put(`/lists/${_id}/cards`, { cards: [lc('Zebra'), lc('Apple'), lc('Mango')] });
  expect(saved.body).toEqual({ saved: 3 });
  const read = await me.get(`/lists/${_id}/cards`);
  expect(read.body.map((c) => c.name)).toEqual(['Zebra', 'Apple', 'Mango']);
  expect(read.body[0]).toMatchObject({ manaCost: '{1}{U}', typeLine: 'Instant' });
  await me.put(`/lists/${_id}/cards`, { cards: [lc('Only')] });
  expect(await ListCard.countDocuments()).toBe(1);
});

test('one bad card rejects the whole save and keeps the old cards', async () => {
  const me = await setup();
  const { _id } = (await me.post('/lists', { name: 'Safe' })).body;
  await me.put(`/lists/${_id}/cards`, { cards: [lc('Keep')] });
  const bad = await me.put(`/lists/${_id}/cards`, { cards: [lc('Fine'), lc('Bad', { count: 100 })] });
  expect(bad.status).toBe(400);
  expect(bad.body.error).toMatch(/^Card 1:/);
  expect((await me.get(`/lists/${_id}/cards`)).body.map((c) => c.name)).toEqual(['Keep']);
});

test('the list shows its card count, and deleting it deletes its cards', async () => {
  const me = await setup();
  const { _id } = (await me.post('/lists', { name: 'Counted' })).body;
  await me.put(`/lists/${_id}/cards`, { cards: [lc('A'), lc('B')] });
  expect((await me.get('/lists')).body[0].cardCount).toBe(2);
  await me.del(`/lists/${_id}`);
  expect(await ListCard.countDocuments()).toBe(0);
});
