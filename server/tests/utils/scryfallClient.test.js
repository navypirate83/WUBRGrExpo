/* =====================================================================
   TESTS: THE SCRYFALL CLIENT
   These never touch the internet: a fake "fetch" stands in for Scryfall
   and a fake clock stands in for time, so we can check the manners we
   promised (gaps, headers, sharing, backing off) quickly and exactly.
   ===================================================================== */

import { createScryfallClient, ScryfallError } from '../../utils/scryfallClient.js';

// A fake Scryfall reply
const reply = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

// A fake clock: "sleep" moves time forward instead of really waiting
function fakeTime() {
  const clock = { time: 1000 };
  return {
    clock,
    now: () => clock.time,
    sleep: async (ms) => { clock.time += ms; },
  };
}

test('requests are sent one at a time with at least the polite gap between them', async () => {
  const { clock, now, sleep } = fakeTime();
  const sentAt = [];
  const client = createScryfallClient({
    now, sleep, gapMs: 120,
    fetchFn: async () => { sentAt.push(clock.time); return reply({ ok: true }); },
  });
  await Promise.all([client.get('/cards/a'), client.get('/cards/b'), client.get('/cards/c')]);
  expect(sentAt).toHaveLength(3);
  expect(sentAt[1] - sentAt[0]).toBeGreaterThanOrEqual(120);
  expect(sentAt[2] - sentAt[1]).toBeGreaterThanOrEqual(120);
});

test('every request says who we are and what we accept', async () => {
  const { now, sleep } = fakeTime();
  let seen;
  const client = createScryfallClient({
    now, sleep,
    fetchFn: async (url, options) => { seen = { url, options }; return reply({ ok: true }); },
  });
  await client.get('/sets');
  expect(seen.url).toBe('https://api.scryfall.com/sets');
  expect(seen.options.headers['User-Agent']).toMatch(/WUBRGr/);
  expect(seen.options.headers.Accept).toMatch(/application\/json/);
});

test('the same request made twice at once is sent to Scryfall only once', async () => {
  const { now, sleep } = fakeTime();
  let calls = 0;
  const client = createScryfallClient({
    now, sleep,
    fetchFn: async () => { calls += 1; return reply({ name: 'Sol Ring' }); },
  });
  const [one, two] = await Promise.all([client.get('/cards/named?exact=Sol%20Ring'), client.get('/cards/named?exact=Sol%20Ring')]);
  expect(calls).toBe(1);
  expect(one).toEqual(two);
});

test('after a 429 it stops contacting Scryfall until the pause is over', async () => {
  const { clock, now, sleep } = fakeTime();
  let calls = 0;
  const client = createScryfallClient({
    now, sleep,
    fetchFn: async () => { calls += 1; return calls === 1 ? reply({}, 429, { 'retry-after': '30' }) : reply({ ok: true }); },
  });

  await expect(client.get('/cards/a')).rejects.toMatchObject({ status: 429, retryAfterSeconds: 30 });
  expect(calls).toBe(1);

  // During the pause: refused at once, Scryfall not bothered
  await expect(client.get('/cards/b')).rejects.toMatchObject({ status: 429 });
  expect(calls).toBe(1);

  // After the pause: works again
  clock.time += 31000;
  await expect(client.get('/cards/b')).resolves.toEqual({ ok: true });
  expect(calls).toBe(2);
});

test('repeated 429s double the pause, up to a limit', async () => {
  const { clock, now, sleep } = fakeTime();
  const client = createScryfallClient({
    now, sleep, pauseSeconds: 10, maxPauseSeconds: 25,
    fetchFn: async () => reply({}, 429),
  });
  await expect(client.get('/a')).rejects.toMatchObject({ retryAfterSeconds: 10 });
  clock.time += 11000;
  await expect(client.get('/a')).rejects.toMatchObject({ retryAfterSeconds: 20 });
  clock.time += 21000;
  await expect(client.get('/a')).rejects.toMatchObject({ retryAfterSeconds: 25 });
});

test('a 404 passes on Scryfall\'s own sentence, and does not start a pause', async () => {
  const { now, sleep } = fakeTime();
  let calls = 0;
  const client = createScryfallClient({
    now, sleep,
    fetchFn: async () => { calls += 1; return reply({ details: 'No cards found matching "zzz"' }, 404); },
  });
  await expect(client.get('/cards/named?exact=zzz')).rejects.toMatchObject({ status: 404, message: 'No cards found matching "zzz"' });
  await expect(client.get('/cards/named?exact=yyy')).rejects.toMatchObject({ status: 404 });
  expect(calls).toBe(2);
});

test('no reply at all becomes a plain error with status 0', async () => {
  const { now, sleep } = fakeTime();
  const client = createScryfallClient({ now, sleep, fetchFn: async () => { throw new Error('offline'); } });
  await expect(client.get('/sets')).rejects.toMatchObject({ status: 0 });
});

test('it refuses to call any address that is not Scryfall', async () => {
  const { now, sleep } = fakeTime();
  let calls = 0;
  const client = createScryfallClient({ now, sleep, fetchFn: async () => { calls += 1; return reply({}); } });
  await expect(client.get('https://evil.example.com/steal')).rejects.toBeInstanceOf(ScryfallError);
  await expect(client.get('https://api.scryfall.com.evil.example.com/x')).rejects.toBeInstanceOf(ScryfallError);
  expect(calls).toBe(0);
  // Scryfall's own full address (like a "next page" link) is fine
  await expect(client.get('https://api.scryfall.com/cards/search?page=2')).resolves.toEqual({});
});

test('a POST sends its body as JSON', async () => {
  const { now, sleep } = fakeTime();
  let seen;
  const client = createScryfallClient({
    now, sleep,
    fetchFn: async (url, options) => { seen = options; return reply({ data: [] }); },
  });
  await client.post('/cards/collection', { identifiers: [{ id: 'x' }] });
  expect(seen.method).toBe('POST');
  expect(seen.headers['Content-Type']).toBe('application/json');
  expect(JSON.parse(seen.body)).toEqual({ identifiers: [{ id: 'x' }] });
});
