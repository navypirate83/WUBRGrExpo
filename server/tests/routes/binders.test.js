/* =====================================================================
   TESTS: BINDER AND CARD ROUTES
   Creating, changing and deleting binders; saving and reading cards;
   the checks that turn bad input away; .csv import and export.
   ===================================================================== */

import request from 'supertest';
import app from '../../app.js';
import Binder from '../../models/Binder.js';
import Card from '../../models/Card.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer, aCard } from '../helpers/users.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

// A signed-in person plus shortcuts for requests as them
async function setup() {
  const user = await makeUser();
  const auth = bearer(user);
  return {
    user,
    get: (url) => request(app).get(url).set('Authorization', auth),
    post: (url, body) => request(app).post(url).set('Authorization', auth).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', auth).send(body),
    del: (url) => request(app).delete(url).set('Authorization', auth),
  };
}

describe('binders', () => {
  test('the list is an empty array when there is nothing', async () => {
    const me = await setup();
    const res = await me.get('/binders');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('create: 201, matches what was sent, really exists, with defaults', async () => {
    const me = await setup();
    const res = await me.post('/binders', { name: 'Blue Deck', color: 'U', cover: '#3A7BD5' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Blue Deck');
    expect(res.body._id).toBeDefined();
    expect(res.body.cover).toBe('#3a7bd5');
    expect(res.body.pages).toBe(10);
    expect(await Binder.countDocuments()).toBe(1);
  });

  test('a cover can have a set symbol ("set:" and the set code), and it can be changed back to a mana symbol', async () => {
    const me = await setup();
    const made = await me.post('/binders', { name: 'Commander', color: 'set:mh3' });
    expect(made.status).toBe(201);
    expect(made.body.color).toBe('set:mh3');
    const id = made.body._id;
    expect((await me.get(`/binders/${id}`)).body.color).toBe('set:mh3');
    const changed = await me.put(`/binders/${id}`, { color: 'WU' });
    expect(changed.status).toBe(200);
    expect(changed.body.color).toBe('WU');
    expect((await me.put(`/binders/${id}`, { color: 'set:sld' })).body.color).toBe('set:sld');
    expect((await me.put(`/binders/${id}`, { color: null })).body.color).toBeNull();
  });

  test('create with a missing name: 400 and nothing saved', async () => {
    const me = await setup();
    const res = await me.post('/binders', { color: 'U' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Name must be text');
    expect(await Binder.countDocuments()).toBe(0);
  });

  test.each([
    ['name too long', { name: 'x'.repeat(13) }],
    ['name only a zero-width space', { name: '​' }],
    ['name with a null character', { name: 'a\u0000b' }],
    ['name only line breaks', { name: '\n\n' }],
    ['name as an object', { name: { $ne: null } }],
    ['pages not whole', { name: 'ok', pages: 2.5 }],
    ['pages as text', { name: 'ok', pages: '5' }],
    ['bad cover', { name: 'ok', cover: 'javascript:1' }],
    ['bad color', { name: 'ok', color: 'xyz' }],
    ['a set symbol with no set code', { name: 'ok', color: 'set:' }],
    ['a set symbol in capitals', { name: 'ok', color: 'set:MH3' }],
    ['a set symbol with a code too short', { name: 'ok', color: 'set:a' }],
    ['a set symbol with a code too long', { name: 'ok', color: 'set:abcdefghi' }],
    ['a set symbol with odd characters', { name: 'ok', color: 'set:mh3/../x' }],
    ['a set symbol as an object', { name: 'ok', color: { $ne: null } }],
    ['bad layout', { name: 'ok', pageLayout: 'big' }],
  ])('create rejects %s', async (label, body) => {
    const me = await setup();
    expect((await me.post('/binders', body)).status).toBe(400);
  });

  test('the same name twice (even in another capitalization) is refused', async () => {
    const me = await setup();
    await me.post('/binders', { name: 'Binder' });
    const again = await me.post('/binders', { name: 'binder' });
    expect(again.status).toBe(409);
  });

  test('get one, update (partial), delete; a malformed id is 400; unknown id is 404', async () => {
    const me = await setup();
    const made = (await me.post('/binders', { name: 'First' })).body;
    expect((await me.get(`/binders/${made._id}`)).body.name).toBe('First');
    const changed = await me.put(`/binders/${made._id}`, { pages: 20 });
    expect(changed.body.pages).toBe(20);
    expect(changed.body.name).toBe('First');
    expect((await me.put(`/binders/${made._id}`, { pages: 0 })).status).toBe(400);
    expect((await me.get('/binders/not-an-id')).body).toEqual({ error: 'Invalid ID format' });
    expect((await me.get('/binders/not-an-id')).status).toBe(400);
    expect((await me.del(`/binders/${made._id}`)).status).toBe(204);
    expect((await me.get(`/binders/${made._id}`)).status).toBe(404);
  });

  test('extra fields (_id, __proto__, role) change nothing', async () => {
    const me = await setup();
    const res = await me.post('/binders', { name: 'Sneaky', _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', __v: 9, createdAt: '2000-01-01' });
    expect(res.status).toBe(201);
    expect(res.body._id).not.toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(res.body.__v).toBe(0);
  });

  test('paging: bad values are 400, and the limit is capped', async () => {
    const me = await setup();
    expect((await me.get('/binders?page=0')).status).toBe(400);
    expect((await me.get('/binders?limit=101')).status).toBe(400);
    expect((await me.get('/binders?limit=abc')).status).toBe(400);
    // ?limit[$ne]=1 is read as a plain odd name (not as an object), so it does nothing
    const sneaky = await me.get('/binders?limit[$ne]=1');
    expect(sneaky.status).toBe(200);
    expect(sneaky.body).toEqual([]);
  });

  test('list shows the card count of each binder', async () => {
    const me = await setup();
    const made = (await me.post('/binders', { name: 'Counted' })).body;
    await me.put(`/binders/${made._id}/cards`, { cards: [aCard(1, 1), aCard(1, 2)] });
    const res = await me.get('/binders');
    expect(res.body[0].cardCount).toBe(2);
  });
});

describe('cards', () => {
  test('replace all cards, read them back in order, then replace again', async () => {
    const me = await setup();
    const { _id } = (await me.post('/binders', { name: 'Cards' })).body;
    const saved = await me.put(`/binders/${_id}/cards`, { cards: [aCard(2, 1), aCard(1, 2, { count: 3, foil: true, added: '2026-10-19T21:46:35.638Z', extra: { Condition: 'near_mint' } }), aCard(1, 1)] });
    expect(saved.body).toEqual({ saved: 3 });
    const read = await me.get(`/binders/${_id}/cards`);
    expect(read.body.map((c) => `${c.page}-${c.pocket}`)).toEqual(['1-1', '1-2', '2-1']);
    expect(read.body[1]).toMatchObject({ count: 3, foil: true, extra: { Condition: 'near_mint' } });
    expect(read.body[0]._id).toBeUndefined();
    await me.put(`/binders/${_id}/cards`, { cards: [aCard(1, 1)] });
    expect(await Card.countDocuments()).toBe(1);
  });

  test('one bad card rejects the whole save, says which card, and keeps the old cards', async () => {
    const me = await setup();
    const { _id } = (await me.post('/binders', { name: 'Safe' })).body;
    await me.put(`/binders/${_id}/cards`, { cards: [aCard(1, 1)] });
    const bad = await me.put(`/binders/${_id}/cards`, { cards: [aCard(1, 1), aCard(1, 2, { count: 500 })] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/^Card 1: count/);
    expect(await Card.countDocuments()).toBe(1);
  });

  test.each([
    ['name missing', { name: undefined }],
    ['image over http', { image: 'http://example.com/a.jpg' }],
    ['image javascript', { image: 'javascript:alert(1)' }],
    ['foil as text', { foil: 'yes' }],
    ['foil as 1', { foil: 1 }],
    ['count 0', { count: 0 }],
    ['count 2.5', { count: 2.5 }],
    ['count as text', { count: '2' }],
    ['face 2', { face: 2 }],
    ['date 2026-02-31', { added: '2026-02-31' }],
    ['date "5"', { added: '5' }],
    ['date 1/2/3', { added: '1/2/3' }],
    ['date year 0000', { added: '0000-01-01' }],
    ['date year 9999', { added: '9999-01-01' }],
    ['extra with a dot in a name', { extra: { 'a.b': 'x' } }],
    ['extra as an array', { extra: ['x'] }],
    ['name with <script> is fine but 5000 characters is not', { name: 'x'.repeat(5000) }],
  ])('a card with %s is rejected', async (label, change) => {
    const me = await setup();
    const { _id } = (await me.post('/binders', { name: 'Checks' })).body;
    const res = await me.put(`/binders/${_id}/cards`, { cards: [aCard(1, 1, change)] });
    expect(res.status).toBe(400);
  });

  test('two cards in one pocket are refused; cards must be a list', async () => {
    const me = await setup();
    const { _id } = (await me.post('/binders', { name: 'Pockets' })).body;
    expect((await me.put(`/binders/${_id}/cards`, { cards: [aCard(1, 1), aCard(1, 1)] })).status).toBe(400);
    expect((await me.put(`/binders/${_id}/cards`, { cards: 'nope' })).status).toBe(400);
    expect((await me.put(`/binders/${_id}/cards`, {})).status).toBe(400);
  });

  test('HTML in a name is stored as plain text, never changed', async () => {
    const me = await setup();
    const { _id } = (await me.post('/binders', { name: 'Text' })).body;
    await me.put(`/binders/${_id}/cards`, { cards: [aCard(1, 1, { name: '<script>alert(1)</script>' })] });
    expect((await me.get(`/binders/${_id}/cards`)).body[0].name).toBe('<script>alert(1)</script>');
  });

  test('deleting a binder deletes its cards', async () => {
    const me = await setup();
    const { _id } = (await me.post('/binders', { name: 'Gone' })).body;
    await me.put(`/binders/${_id}/cards`, { cards: [aCard(1, 1), aCard(1, 2)] });
    await me.del(`/binders/${_id}`);
    expect(await Card.countDocuments()).toBe(0);
  });
});

describe('csv import and export', () => {
  const ID = '0aeebaf5-8c7d-4636-9e82-8c27447861f7';
  const csv = [
    'Name,Set code,Collector number,Foil,Quantity,Scryfall ID,Page,Pocket,Binder',
    `Black Lotus,LEA,232,normal,1,${ID},1,1,Imported`,
    `,LEA,1,normal,1,${ID},1,2,Imported`,
    `Counterspell,LEA,1,foil,500,${ID},1,3,Imported`,
    '=HYPERLINK("http://evil"),LEA,1,normal,1,no-id,1,4,Imported',
    `=cmd|' /C calc'!A0,LEA,9,normal,2,${ID},1,5,Imported`,
  ].join('\n');

  test('good rows come in; a missing name, quantity 500 and a missing ID are skipped with reasons', async () => {
    const me = await setup();
    const res = await me.post('/binders/import', { csv });
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.skipped.map((s) => s.row)).toEqual([3, 4, 5]);
    expect(res.body.skipped[1].reason).toBe('Quantity 500 is not a whole number from 1 to 99');
    expect(await Card.countDocuments()).toBe(2);
  });

  test('export gives the same columns, and a formula cell gets an apostrophe', async () => {
    const me = await setup();
    const imported = (await me.post('/binders/import', { csv })).body;
    const res = await me.get(`/binders/${imported.binder.id}/export`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,Scryfall ID,Purchase price,Condition,Language,Proxy,Purchase price currency,Added,Page,Pocket,Side,Binder,Cover symbol,Cover color,Pages,Page layout,Colors,Type,Mana value,Released');
    expect(lines).toHaveLength(3);
    expect(res.text).toContain("'=cmd");
  });

  test('the sorting details (colors, type, mana value, release date, rarity) come in with a file and go back out', async () => {
    const me = await setup();
    const file = [
      'Name,Set code,Collector number,Foil,Quantity,Scryfall ID,Page,Pocket,Binder,Rarity,Colors,Type,Mana value,Released',
      `Golem,LEA,5,normal,1,${ID},1,1,Details,rare,C,Artifact Creature — Golem,4,1993-08-05`,
    ].join('\n');
    const imported = (await me.post('/binders/import', { csv: file })).body;
    expect(imported.imported).toBe(1);
    // Kept with the card...
    const saved = await Card.findOne({ name: 'Golem' }).lean();
    expect(saved.extra).toMatchObject({
      Rarity: 'rare', Colors: 'C', Type: 'Artifact Creature — Golem', 'Mana value': '4', Released: '1993-08-05',
    });
    // ...and written back out in the same columns
    const out = (await me.get(`/binders/${imported.binder.id}/export`)).text.trim().split('\n');
    const header = out[0].split(',');
    expect(out[1]).toContain('Artifact Creature — Golem');
    expect(out[1].split(',')[header.indexOf('Colors')]).toBe('C');
    expect(out[1].split(',')[header.indexOf('Released')]).toBe('1993-08-05');
  });

  test('empty or non-text csv is a 400', async () => {
    const me = await setup();
    expect((await me.post('/binders/import', { csv: '' })).status).toBe(400);
    expect((await me.post('/binders/import', { csv: { a: 1 } })).status).toBe(400);
  });
});

describe('bodies and routes', () => {
  test('broken JSON is 400, an oversized body is 413, an unknown route is the plain 404', async () => {
    const me = await setup();
    const auth = bearer(me.user);
    const broken = await request(app).post('/binders').set('Authorization', auth).set('Content-Type', 'application/json').send('{"name":');
    expect(broken.status).toBe(400);
    const huge = await request(app).post('/binders').set('Authorization', auth).send({ name: 'x'.repeat(200000) });
    expect(huge.status).toBe(413);
    const nope = await request(app).get('/nothing/here');
    expect(nope.status).toBe(404);
    expect(nope.body).toEqual({ error: 'Route not found' });
    expect(nope.text).not.toContain('nothing');
  });

  test('no response mentions Express', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.body).toEqual({ ok: true });
  });
});
