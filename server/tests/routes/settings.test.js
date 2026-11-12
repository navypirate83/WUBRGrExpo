/* =====================================================================
   TESTS: APP SETTINGS ROUTES
   Settings belong to the signed-in person: nothing saved yet reads back
   as null, a save reads back the same, bad values are refused, and one
   person never sees another's. Page layouts: an older app sends one
   layout (read back as the phone and the wide layout too); a newer app
   sends a phone and a wide layout, and the layout the cards are stored in
   can't be changed by it once the account has one.
   ===================================================================== */

import request from 'supertest';
import app from '../../app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer } from '../helpers/users.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const GOOD = { theme: 'dark', hiddenFormats: ['pauper'], pageLayout: { across: 3, down: 3 } };
// What reading GOOD back gives: one layout means the phone and wide ones too
const GOOD_BACK = { ...GOOD, phoneLayout: GOOD.pageLayout, wideLayout: GOOD.pageLayout };
// A save from the newer app: the cards stored 4x4, a phone 3x3, a wide screen 5x4
const TWO = { ...GOOD, pageLayout: { across: 4, down: 4 }, phoneLayout: { across: 3, down: 3 }, wideLayout: { across: 5, down: 4 } };

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
  expect(saved.body.settings).toEqual(GOOD_BACK);
  const read = await request(app).get('/settings').set('Authorization', auth);
  expect(read.body.settings).toEqual(GOOD_BACK);
  expect(read.body.savedAt).toBeTruthy();
  const changed = { theme: 'light', hiddenFormats: [], pageLayout: { across: 4, down: 4 } };
  await request(app).put('/settings').set('Authorization', auth).send(changed);
  expect((await request(app).get('/settings').set('Authorization', auth)).body.settings)
    .toEqual({ ...changed, phoneLayout: changed.pageLayout, wideLayout: changed.pageLayout });
});

test('a newer app saves a phone and a wide layout, and reads them back', async () => {
  const user = await makeUser();
  const auth = bearer(user);
  const saved = await request(app).put('/settings').set('Authorization', auth).send(TWO);
  expect(saved.status).toBe(200);
  expect(saved.body.settings).toEqual(TWO);
  expect((await request(app).get('/settings').set('Authorization', auth)).body.settings).toEqual(TWO);
});

test('a newer app cannot change the layout the cards are stored in, but can change the other two', async () => {
  const user = await makeUser();
  const auth = bearer(user);
  await request(app).put('/settings').set('Authorization', auth).send(TWO);
  // A device with out-of-date settings says the cards are stored 6x6, and
  // picks new phone and wide layouts
  const stale = { ...TWO, pageLayout: { across: 6, down: 6 }, phoneLayout: { across: 2, down: 2 }, wideLayout: { across: 6, down: 5 } };
  const res = await request(app).put('/settings').set('Authorization', auth).send(stale);
  expect(res.status).toBe(200);
  expect(res.body.settings.pageLayout).toEqual({ across: 4, down: 4 });
  expect(res.body.settings.phoneLayout).toEqual({ across: 2, down: 2 });
  expect(res.body.settings.wideLayout).toEqual({ across: 6, down: 5 });
});

test('an older app still sets the one layout, which replaces the newer ones', async () => {
  const user = await makeUser();
  const auth = bearer(user);
  await request(app).put('/settings').set('Authorization', auth).send(TWO);
  const res = await request(app).put('/settings').set('Authorization', auth).send(GOOD);
  expect(res.status).toBe(200);
  expect(res.body.settings).toEqual(GOOD_BACK);
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
    // the phone and wide layouts: only one of them, or a bad one
    { ...GOOD, phoneLayout: { across: 3, down: 3 } },
    { ...GOOD, wideLayout: { across: 3, down: 3 } },
    { ...TWO, phoneLayout: { across: 0, down: 3 } },
    { ...TWO, wideLayout: { across: 3, down: 7 } },
    { ...TWO, wideLayout: 'big' },
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
