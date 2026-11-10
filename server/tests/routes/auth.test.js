/* =====================================================================
   TESTS: SIGN UP, LOG IN, TOKENS AND STAYING SIGNED IN
   Each test sends a pretend request straight to the app (no real port)
   and checks the answer. The test database is emptied after every test.
   ===================================================================== */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.js';
import User from '../../models/User.js';
import RefreshToken from '../../models/RefreshToken.js';
import { connectTestDb, clearTestDb, disconnectTestDb } from '../helpers/db.js';
import { makeUser, bearer, TEST_PASSWORD } from '../helpers/users.js';
import { hashToken } from '../../utils/tokens.js';

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

const signup = (body) => request(app).post('/auth/signup').send(body);
const good = { email: 'Ann@Example.com', password: 'longenough1', name: 'Ann' };

describe('signup', () => {
  test('201 with exactly the right keys, nothing secret, email lowercased, username defaults to email', async () => {
    const res = await signup(good);
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['accessToken', 'refreshToken', 'user']);
    expect(Object.keys(res.body.user).sort()).toEqual(['email', 'id', 'name', 'role', 'username']);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('password');
    expect(res.body.user.email).toBe('ann@example.com');
    expect(res.body.user.username).toBe('ann@example.com');
  });

  test('a chosen username is saved lowercase, and a sneaky role is ignored', async () => {
    const res = await signup({ ...good, username: 'Ann.Smith', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('ann.smith');
    expect((await User.findOne({ email: 'ann@example.com' })).role).toBe('user');
  });

  test.each([
    ['empty body', {}],
    ['missing name', { email: 'a@b.com', password: 'longenough1' }],
    ['bad email', { ...good, email: 'not-an-email' }],
    ['5-character password', { ...good, password: '12345' }],
    ['email as an object', { ...good, email: { $ne: null } }],
    ['username as an object', { ...good, username: { $ne: null } }],
    ['username with an @', { ...good, username: 'a@b.com' }],
    ['too-short username', { ...good, username: 'ab' }],
    ['reserved username', { ...good, username: 'admin' }],
    ['80-byte password', { ...good, password: 'x'.repeat(80) }],
  ])('400 for %s', async (label, body) => {
    const res = await signup(body);
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  test('the short-password message says exactly what is needed', async () => {
    const res = await signup({ ...good, password: '1234' });
    expect(res.body.error).toBe('Password must be at least 8 characters long');
  });

  test('409 for a duplicate email in another capitalization, and a duplicate username', async () => {
    await signup({ ...good, username: 'ann.one' });
    const sameEmail = await signup({ ...good, email: 'ANN@example.com' });
    expect(sameEmail.status).toBe(409);
    const sameName = await signup({ email: 'other@example.com', password: 'longenough1', name: 'B', username: 'ANN.ONE' });
    expect(sameName.status).toBe(409);
  });

  test('10 signups at the same instant with one email: exactly one succeeds', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => signup(good)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
  });
});

describe('password storage', () => {
  test('the stored password is scrambled, and saving again does not scramble it twice', async () => {
    const user = await makeUser();
    const saved = await User.findById(user._id).select('+password');
    expect(saved.password.startsWith('$2')).toBe(true);
    expect(saved.password).not.toContain(TEST_PASSWORD);
    const before = saved.password;
    saved.name = 'New Name';
    await saved.save();
    expect((await User.findById(user._id).select('+password')).password).toBe(before);
  });
});

describe('login', () => {
  test('works with the username and with the email', async () => {
    const user = await makeUser({ username: 'login.user' });
    const byName = await request(app).post('/auth/login').send({ username: 'LOGIN.user', password: TEST_PASSWORD });
    const byEmail = await request(app).post('/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    expect(byName.status).toBe(200);
    expect(byEmail.status).toBe(200);
    expect(JSON.stringify(byName.body)).not.toMatch(/\$2[aby]\$/);
  });

  test('a wrong password and an unknown account give the identical 401', async () => {
    const user = await makeUser();
    const wrong = await request(app).post('/auth/login').send({ email: user.email, password: 'nope-nope-nope' });
    const unknown = await request(app).post('/auth/login').send({ email: 'ghost@example.com', password: 'nope-nope-nope' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.text).toBe(unknown.text);
    expect(wrong.body.error).toBe('Invalid username or password');
  });

  test('login with an object instead of text is refused', async () => {
    await makeUser();
    const res = await request(app).post('/auth/login').send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe('sessions', () => {
  test('the access token holds sub, email and role and lives 900 seconds; another secret fails', async () => {
    const res = await signup(good);
    const payload = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.email).toBe('ann@example.com');
    expect(payload.role).toBe('user');
    expect(payload.exp - payload.iat).toBe(900);
    expect(() => jwt.verify(res.body.accessToken, 'a-different-secret')).toThrow();
  });

  test('refresh gives a new pair and kills the old token; the database holds only fingerprints', async () => {
    const first = (await signup(good)).body;
    expect(await RefreshToken.countDocuments({ tokenHash: first.refreshToken })).toBe(0);
    const second = await request(app).post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(second.status).toBe(200);
    expect(second.body.refreshToken).not.toBe(first.refreshToken);
    const old = await request(app).post('/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(old.status).toBe(401);
  });

  test('replaying an old refresh token also kills the newer one', async () => {
    const first = (await signup(good)).body;
    const second = (await request(app).post('/auth/refresh').send({ refreshToken: first.refreshToken })).body;
    await request(app).post('/auth/refresh').send({ refreshToken: first.refreshToken }); // the replay
    const newer = await request(app).post('/auth/refresh').send({ refreshToken: second.refreshToken });
    expect(newer.status).toBe(401);
  });

  test('two refreshes at the same instant: exactly one wins', async () => {
    const first = (await signup(good)).body;
    const both = await Promise.all([1, 2].map(() => request(app).post('/auth/refresh').send({ refreshToken: first.refreshToken })));
    expect(both.filter((r) => r.status === 200)).toHaveLength(1);
  });

  test('expired, made-up and deleted-account tokens all give 401', async () => {
    const first = (await signup(good)).body;
    await RefreshToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/auth/refresh').send({ refreshToken: first.refreshToken })).status).toBe(401);
    expect((await request(app).post('/auth/refresh').send({ refreshToken: 'made-up' })).status).toBe(401);

    const other = (await signup({ ...good, email: 'zed@example.com' })).body;
    await User.deleteOne({ email: 'zed@example.com' });
    expect((await request(app).post('/auth/refresh').send({ refreshToken: other.refreshToken })).status).toBe(401);
  });

  test('logout makes the token fail; logout-all kills every token of the user', async () => {
    const a = (await signup(good)).body;
    expect((await request(app).post('/auth/logout').send({ refreshToken: a.refreshToken })).status).toBe(204);
    expect((await request(app).post('/auth/refresh').send({ refreshToken: a.refreshToken })).status).toBe(401);

    const login1 = (await request(app).post('/auth/login').send({ email: good.email, password: good.password })).body;
    const login2 = (await request(app).post('/auth/login').send({ email: good.email, password: good.password })).body;
    const all = await request(app).post('/auth/logout-all').set('Authorization', `Bearer ${login1.accessToken}`);
    expect(all.status).toBe(204);
    expect((await request(app).post('/auth/refresh').send({ refreshToken: login1.refreshToken })).status).toBe(401);
    expect((await request(app).post('/auth/refresh').send({ refreshToken: login2.refreshToken })).status).toBe(401);
  });

  test('logout always answers 204, even for nonsense', async () => {
    expect((await request(app).post('/auth/logout').send({ refreshToken: 'nonsense' })).status).toBe(204);
    expect((await request(app).post('/auth/logout').send({})).status).toBe(204);
  });

  test('only a fingerprint of the refresh token is stored', async () => {
    const a = (await signup(good)).body;
    const row = await RefreshToken.findOne();
    expect(row.tokenHash).toBe(hashToken(a.refreshToken));
    expect(row.tokenHash).not.toBe(a.refreshToken);
  });
});

describe('google sign-in', () => {
  test('answers 503 when it is not set up, and 400 without a token', async () => {
    expect((await request(app).post('/auth/google').send({ accessToken: 'abc' })).status).toBe(503);
    expect((await request(app).post('/auth/google').send({})).status).toBe(400);
  });
});

describe('logout-all needs sign-in', () => {
  test('401 without a token', async () => {
    expect((await request(app).post('/auth/logout-all')).status).toBe(401);
    const user = await makeUser();
    expect((await request(app).post('/auth/logout-all').set('Authorization', bearer(user))).status).toBe(204);
  });
});
