/* =====================================================================
   TESTS: WHO MAY DO WHAT
   - every protected route needs a good login token
   - admin-only routes keep ordinary users out
   - people can only ever see and change their OWN binders and lists
   ===================================================================== */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.js';
import Binder from '../../models/Binder.js';
import List from '../../models/List.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer, tokenFor, aCard } from '../helpers/users.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const PLEASE = { error: 'Please sign in' };

describe('every protected route needs a token', () => {
  test.each([
    ['get', '/binders'], ['post', '/binders'], ['get', '/binders/123'], ['put', '/binders/123'],
    ['delete', '/binders/123'], ['get', '/binders/123/cards'], ['put', '/binders/123/cards'],
    ['post', '/binders/import'], ['get', '/binders/123/export'],
    ['get', '/lists'], ['post', '/lists'], ['get', '/lists/123/cards'], ['get', '/admin/users'],
  ])('%s %s gives 401', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual(PLEASE);
  });

  test('seven bad tokens each give the identical 401', async () => {
    const user = await makeUser();
    const noSignature = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: String(user._id), role: 'admin' })).toString('base64url')}.`;
    const headers = [
      undefined,
      'Bearer',
      'Bearer garbage',
      `Token ${tokenFor(user)}`,
      `Bearer ${jwt.sign({ sub: String(user._id) }, 'wrong-secret')}`,
      `Bearer ${tokenFor(user, { expiresIn: -10 })}`,
      `Bearer ${noSignature}`,
    ];
    for (const header of headers) {
      const req = request(app).get('/binders');
      const res = header === undefined ? await req : await req.set('Authorization', header);
      expect(res.status).toBe(401);
      expect(res.body).toEqual(PLEASE);
    }
  });

  test('a real token for a deleted account is rejected', async () => {
    const user = await makeUser();
    const token = bearer(user);
    await user.deleteOne();
    expect((await request(app).get('/binders').set('Authorization', token)).status).toBe(401);
  });

  test('a token whose role was edited without re-signing is refused', async () => {
    const user = await makeUser();
    const [head, , signature] = tokenFor(user).split('.');
    const edited = Buffer.from(JSON.stringify({ sub: String(user._id), role: 'admin' })).toString('base64url');
    const res = await request(app).get('/admin/users').set('Authorization', `Bearer ${head}.${edited}.${signature}`);
    expect(res.status).toBe(401);
  });
});

describe('roles', () => {
  test('a normal user gets 403 on an admin route; an admin gets 200 with no password', async () => {
    const normal = await makeUser();
    const admin = await makeUser({ role: 'admin' });
    expect((await request(app).get('/admin/users').set('Authorization', bearer(normal))).status).toBe(403);
    const res = await request(app).get('/admin/users').set('Authorization', bearer(admin));
    expect(res.status).toBe(200);
    expect(res.headers['x-total-count']).toBe('2');
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('password');
  });
});

describe('ownership', () => {
  async function twoPeople() {
    const a = await makeUser();
    const b = await makeUser();
    const binder = await Binder.create({ owner: a._id, name: 'Mine' });
    const list = await List.create({ owner: a._id, name: 'Mine' });
    return { a, b, binder, list };
  }

  test('each user sees only their own binders, and the count matches', async () => {
    const { a, b } = await twoPeople();
    const forA = await request(app).get('/binders').set('Authorization', bearer(a));
    const forB = await request(app).get('/binders').set('Authorization', bearer(b));
    expect(forA.body).toHaveLength(1);
    expect(forA.headers['x-total-count']).toBe('1');
    expect(forB.body).toEqual([]);
    expect(forB.headers['x-total-count']).toBe('0');
  });

  test("someone else's binder: read, change, delete, cards and export all give 404, and nothing changes", async () => {
    const { b, binder } = await twoPeople();
    const auth = bearer(b);
    const id = binder._id;
    expect((await request(app).get(`/binders/${id}`).set('Authorization', auth)).status).toBe(404);
    expect((await request(app).put(`/binders/${id}`).set('Authorization', auth).send({ name: 'Stolen' })).status).toBe(404);
    expect((await request(app).get(`/binders/${id}/cards`).set('Authorization', auth)).status).toBe(404);
    expect((await request(app).put(`/binders/${id}/cards`).set('Authorization', auth).send({ cards: [aCard()] })).status).toBe(404);
    expect((await request(app).get(`/binders/${id}/export`).set('Authorization', auth)).status).toBe(404);
    expect((await request(app).delete(`/binders/${id}`).set('Authorization', auth)).status).toBe(404);
    expect((await Binder.findById(id)).name).toBe('Mine');
  });

  test("someone else's list gives 404 for every route, even for an admin", async () => {
    const { list } = await twoPeople();
    const admin = await makeUser({ role: 'admin' });
    const auth = bearer(admin);
    expect((await request(app).get(`/lists/${list._id}`).set('Authorization', auth)).status).toBe(404);
    expect((await request(app).put(`/lists/${list._id}/cards`).set('Authorization', auth).send({ cards: [] })).status).toBe(404);
    expect((await request(app).delete(`/lists/${list._id}`).set('Authorization', auth)).status).toBe(404);
    expect(await List.countDocuments()).toBe(1);
  });

  test('an owner in the body of a create is ignored', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const res = await request(app).post('/binders').set('Authorization', bearer(a)).send({ name: 'Mine', owner: String(b._id) });
    expect(res.status).toBe(201);
    expect(String(res.body.owner)).toBe(String(a._id));
  });

  test('a well-formed id that belongs to no one is the same 404 as someone elses', async () => {
    const a = await makeUser();
    const res = await request(app).get('/binders/aaaaaaaaaaaaaaaaaaaaaaaa').set('Authorization', bearer(a));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
