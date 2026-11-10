/* =====================================================================
   TESTS: THE WELCOME EMAIL
   The email service is faked (no real email is ever sent): the tests catch
   the request the server would send and read it. What must hold: a new
   person gets one email with their username (never a password), signing
   up never fails because of email, a name can't change how the email
   looks, and nothing is sent when signing up is refused.
   ===================================================================== */

import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../../app.js';
import User from '../../models/User.js';
import { welcomeEmail } from '../../utils/emailTemplates.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
beforeEach(async () => {
  await clearTestDb();
  process.env.RESEND_API_KEY = 'fake';
  process.env.MAIL_FROM = 'Test <test@example.com>';
});
afterEach(() => jest.restoreAllMocks());

// Pretend to be the mail service, and keep what was sent
function fakeMail(reply = { ok: true, status: 200 }) {
  const sent = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    sent.push({ url, ...JSON.parse(options.body) });
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return sent;
}

const signup = (body) => request(app).post('/auth/signup').send({
  email: 'new.person@example.com', password: 'a-good-password-1', name: 'New Person', username: 'newperson', ...body,
});

test('a new person gets one welcome email with their username and no secrets', async () => {
  const sent = fakeMail();
  const res = await signup();
  expect(res.status).toBe(201);
  expect(sent).toHaveLength(1);
  expect(sent[0].url).toBe('https://api.resend.com/emails');
  expect(sent[0].to).toEqual(['new.person@example.com']);
  expect(sent[0].subject).toBe('Welcome to WUBRG\'r');
  expect(sent[0].text).toContain('Hi New Person,');
  expect(sent[0].text).toContain('Your username: newperson');
  expect(typeof sent[0].html).toBe('string');
  expect(sent[0].html).toContain('newperson');
  // The password is in neither the text nor the HTML
  expect(sent[0].text).not.toContain('a-good-password-1');
  expect(sent[0].html).not.toContain('a-good-password-1');
});

test('signing up still works when email is not set up, and nothing is sent', async () => {
  process.env.RESEND_API_KEY = '';
  const sent = fakeMail();
  expect((await signup()).status).toBe(201);
  expect(sent).toHaveLength(0);
});

test('signing up still works when the mail service fails or can\'t be reached', async () => {
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
  fakeMail({ ok: false, status: 500 });
  expect((await signup()).status).toBe(201);
  jest.restoreAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  fakeMail(new Error('network down'));
  expect((await signup({ email: 'second@example.com', username: 'second' })).status).toBe(201);
  expect(await User.countDocuments()).toBe(2);
  expect(quiet).toBeDefined();
});

test('no email is sent when signing up is refused', async () => {
  const sent = fakeMail();
  expect((await signup()).status).toBe(201);
  expect(sent).toHaveLength(1);
  // The same email again (409) and a bad password (400)
  expect((await signup({ username: 'other' })).status).toBe(409);
  expect((await signup({ email: 'x@example.com', username: 'x1', password: 'short' })).status).toBe(400);
  expect(sent).toHaveLength(1);
});

test('a name with HTML in it cannot change how the email looks', () => {
  const email = welcomeEmail({ name: '<b>Sam</b> & "Co"', username: 'sam', email: 'sam@example.com' });
  expect(email.html).not.toContain('<b>Sam</b>');
  expect(email.html).toContain('&lt;b&gt;Sam&lt;/b&gt; &amp; &quot;Co&quot;');
  // The plain text is not HTML, so it keeps the name as typed
  expect(email.text).toContain('Hi <b>Sam</b> & "Co",');
});

test('when the username is the email (Google sign-ups), it is not said twice', () => {
  const email = welcomeEmail({ name: 'Gina', username: 'Gina@Example.com', email: 'gina@example.com' });
  expect(email.text).not.toContain('Your username:');
  expect(email.html).not.toContain('Your username:');
  expect(email.text).toContain('Hi Gina,');
});

test('the link in the email can be set with APP_URL', () => {
  process.env.APP_URL = 'https://example.org/app/';
  try {
    const email = welcomeEmail({ name: 'A', username: 'abc', email: 'a@example.com' });
    expect(email.text).toContain('https://example.org/app/');
    expect(email.html).toContain('href="https://example.org/app/"');
  } finally {
    delete process.env.APP_URL;
  }
});

test('the Google sign-up upsert says whether it made the person (so only one welcome is sent)', async () => {
  const upsert = () => User.findOneAndUpdate(
    { googleId: 'g-123' },
    { $setOnInsert: { googleId: 'g-123', email: 'g@example.com', username: 'g@example.com', name: 'G', role: 'user' } },
    { upsert: true, returnDocument: 'after', runValidators: true, includeResultMetadata: true },
  );
  const first = await upsert();
  const second = await upsert();
  expect(first.lastErrorObject.updatedExisting).toBe(false);
  expect(first.value.email).toBe('g@example.com');
  expect(second.lastErrorObject.updatedExisting).toBe(true);
  expect(await User.countDocuments({ googleId: 'g-123' })).toBe(1);
});
