/* =====================================================================
   TESTS: CORS (which websites a browser lets read our answers)
   Only the exact addresses in CORS_ORIGINS get the permission header,
   and "*" is never sent. The phone app has no Origin and still works.
   ===================================================================== */

import request from 'supertest';

// The app reads CORS_ORIGINS once, when it loads, so set it first and
// load the app afterwards (a "dynamic import")
process.env.CORS_ORIGINS = 'https://navypirate83.github.io,http://localhost:8081';
const { default: app } = await import('../../app.js');

const ALLOW = 'access-control-allow-origin';

test('a listed address gets exactly that address back (never *)', async () => {
  const res = await request(app).get('/api/health').set('Origin', 'https://navypirate83.github.io');
  expect(res.headers[ALLOW]).toBe('https://navypirate83.github.io');
});

test.each([
  ['an unlisted site', 'https://evil.example'],
  ['a look-alike', 'https://navypirate83.github.io.evil.com'],
  ['the http version', 'http://navypirate83.github.io'],
  ['a trailing slash', 'https://navypirate83.github.io/'],
])('%s gets no permission header', async (label, origin) => {
  const res = await request(app).get('/api/health').set('Origin', origin);
  expect(res.headers[ALLOW]).toBeUndefined();
});

test('a preflight from an unlisted site gets none either', async () => {
  const res = await request(app).options('/binders').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
  expect(res.headers[ALLOW]).toBeUndefined();
});

test('a request with no Origin (the phone app) still works', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.headers[ALLOW]).toBeUndefined();
});

test('no response ever contains a wildcard', async () => {
  for (const url of ['/api/health', '/nothing', '/binders']) {
    const res = await request(app).get(url).set('Origin', 'https://evil.example');
    expect(res.headers[ALLOW]).not.toBe('*');
  }
});
