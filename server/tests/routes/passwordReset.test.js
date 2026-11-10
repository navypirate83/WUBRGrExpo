/* =====================================================================
   TESTS: FORGOT USERNAME / PASSWORD
   The email service is faked (no real email is ever sent): the test
   catches the request the server would send and reads the code out of it.
   ===================================================================== */

import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../../app.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, TEST_PASSWORD } from '../helpers/users.js';

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  process.env.RESEND_API_KEY = 'fake';
  process.env.MAIL_FROM = 'Test <test@example.com>';
});
afterEach(() => jest.restoreAllMocks());

// Pretend to be the mail service, and keep what was sent
function fakeMail() {
  const sent = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true, status: 200 };
  });
  return sent;
}

test('forgot sends the username and a code, and reset sets the new password', async () => {
  const user = await makeUser();
  const sent = fakeMail();
  const forgot = await request(app).post('/auth/forgot').send({ email: user.email });
  expect(forgot.status).toBe(200);
  expect(sent).toHaveLength(1);
  expect(sent[0].text).toContain(user.username);
  const code = /code is: (\d{6})/.exec(sent[0].text)[1];

  const reset = await request(app).post('/auth/reset').send({ email: user.email, code, password: 'brand-new-pass1' });
  expect(reset.status).toBe(200);
  expect((await request(app).post('/auth/login').send({ username: user.username, password: 'brand-new-pass1' })).status).toBe(200);
  expect((await request(app).post('/auth/login').send({ username: user.username, password: TEST_PASSWORD })).status).toBe(401);
  // The code works only once
  expect((await request(app).post('/auth/reset').send({ email: user.email, code, password: 'another-pass-2' })).status).toBe(400);
});

test('an unknown email gets the same answer and nothing is sent', async () => {
  const sent = fakeMail();
  const res = await request(app).post('/auth/forgot').send({ email: 'nobody@example.com' });
  expect(res.status).toBe(200);
  expect(sent).toHaveLength(0);
});

test('five wrong codes throw the code away', async () => {
  const user = await makeUser();
  const sent = fakeMail();
  await request(app).post('/auth/forgot').send({ email: user.email });
  const code = /code is: (\d{6})/.exec(sent[0].text)[1];
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i += 1) {
    expect((await request(app).post('/auth/reset').send({ email: user.email, code: wrong, password: 'brand-new-pass1' })).status).toBe(400);
  }
  // Even the right code fails now
  expect((await request(app).post('/auth/reset').send({ email: user.email, code, password: 'brand-new-pass1' })).status).toBe(400);
});

test('without mail settings, forgot says email is not set up', async () => {
  delete process.env.RESEND_API_KEY;
  const user = await makeUser();
  expect((await request(app).post('/auth/forgot').send({ email: user.email })).status).toBe(503);
});

test('a short new password is refused', async () => {
  const user = await makeUser();
  expect((await request(app).post('/auth/reset').send({ email: user.email, code: '123456', password: 'short' })).status).toBe(400);
});
