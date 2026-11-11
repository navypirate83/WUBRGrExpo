/* =====================================================================
   TESTS: APP SETTINGS ROUTES
   Settings belong to the signed-in person: nothing saved yet reads back
   as null, a save reads back the same, bad values are refused, and one
   person never sees another's.
   ===================================================================== */

import request from 'supertest';
import app from '../../app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer } from '../helpers/users.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const GOOD = { theme: 'dark', hiddenFormats: ['pauper'], pageLayout: { across: 3, down: 3 } };

test('needs a sign-in', async () => {
  expect((await request(app).get('/settings')).status).toBe(401);
  expect((await request(app).put('/settings').send(GOOD)).status).toBe(401);
});

test('nothing saved yet reads back as null', async () => {
  const user = await makeUser();
  const res = await request(app).get('/settings').set('Authorization', bearer(user));
  expect(res.status).toBe(200);
  expect(res.body.settings).toBeNull();
});

test('a save reads back the same, and a second save replaces it', async () => {
  const user = await makeUser();
  const auth = bearer(user);
  const saved = await request(app).put('/settings').set('Authorization', auth).send(GOOD);
  expect(saved.status).toBe(200);
  expect(saved.body.settings).toEqual(GOOD);
  const read = await request(app).get('/settings').set('Authorization', auth);
  expect(read.body.settings).toEqual(GOOD);
  expect(read.body.savedAt).toBeTruthy();
  const changed = { theme: 'light', hiddenFormats: [], pageLayout: { across: 4, down: 4 } };
  await request(app).put('/settings').set('Authorization', auth).send(changed);
  expect((await request(app).get('/settings').set('Authorization', auth)).body.settings).toEqual(changed);
});

test('bad values are refused and nothing is saved', async () => {
  const user = await makeUser();
  const auth = bearer(user);
  const bad = [
    { ...GOOD, theme: 'purple' },
    { ...GOOD, hiddenFormats: 'pauper' },
    { ...GOOD, hiddenFormats: [5] },
    { ...GOOD, pageLayout: { across: 9, down: 3 } },
    { ...GOOD, pageLayout: { across: 2.5, down: 3 } },
    { theme: 'dark' },
  ];
  for (const body of bad) {
    expect((await request(app).put('/settings').set('Authorization', auth).send(body)).status).toBe(400);
  }
  expect((await request(app).get('/settings').set('Authorization', auth)).body.settings).toBeNull();
});

test("one person never sees another person's settings", async () => {
  const a = await makeUser();
  const b = await makeUser();
  await request(app).put('/settings').set('Authorization', bearer(a)).send(GOOD);
  expect((await request(app).get('/settings').set('Authorization', bearer(b))).body.settings).toBeNull();
});
