/* =====================================================================
   TESTS: THE STRICTER LIMIT ON THE SIGN-IN ROUTES
   The app reads the limit once, when it loads, so this file sets it to
   5 first and loads the app afterwards. Empty bodies are sent, so the
   routes answer 400 without touching the database.
   ===================================================================== */

import request from 'supertest';

process.env.AUTH_RATE_LIMIT_MAX = '5';
const { default: app } = await import('../../app.js');

test('tries 1 to 5 on /login get 400, the 6th gets 429 with the message and Retry-After', async () => {
  for (let i = 1; i <= 5; i += 1) {
    expect((await request(app).post('/auth/login').send({})).status).toBe(400);
  }
  const sixth = await request(app).post('/auth/login').send({});
  expect(sixth.status).toBe(429);
  expect(sixth.body).toEqual({ error: 'Too many attempts. Please wait a minute and try again.' });
  expect(sixth.headers['retry-after']).toBeDefined();
});

test('/signup has its own counter, and ordinary routes are not affected', async () => {
  expect((await request(app).post('/auth/signup').send({})).status).toBe(400);
  expect((await request(app).get('/api/hello')).status).toBe(200);
});
