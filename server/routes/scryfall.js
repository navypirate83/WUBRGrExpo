/* =====================================================================
   CARD INFORMATION ROUTES (/scryfall/...)
   Card information for people who are logged in. The server looks cards
   up at Scryfall politely, remembers the answers, and sends the app
   trimmed-down cards. (People who are NOT logged in never come here:
   their app asks Scryfall directly.)
   Mounted behind requireAuth in app.js. Each person also has their own
   limit per minute here, so nobody can use up the one shared allowance
   we have with Scryfall.
   - GET  /scryfall/names                          every card name
   - GET  /scryfall/sets                           every set's symbol picture
   - GET  /scryfall/cards/named?exact=NAME         one card by name
          (or ?fuzzy=NAME: the closest match)
   - GET  /scryfall/cards/set/:set/:number         one exact printing
   - GET  /scryfall/cards/set/:set/:number/languages   it in every language
   - GET  /scryfall/cards/id/:id                   one printing by Scryfall ID
   - GET  /scryfall/cards/id/:id/prints            every printing of that card
   - GET  /scryfall/cards/id/:id/rulings           its official rulings
   - POST /scryfall/cards/collection               many cards at once
   Answers say "stale": true when Scryfall couldn't be reached and an
   older saved answer was used.
   ===================================================================== */

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { ScryfallError, scryfall } from '../utils/scryfallClient.js';
import { createScryfallService } from '../utils/scryfallService.js';

// The most cards one "collection" request may ask about (the app sends
// bigger piles in several requests)
const MAX_COLLECTION = 150;

// What a good value looks like. Checking before we ask Scryfall means a
// strange request is turned away without spending a request on it.
const SET_CODE = /^[a-z0-9]{2,8}$/i;
const COLLECTOR_NUMBER = /^[^\s/?#\\]{1,12}$/u;
const SCRYFALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isName = (value) => typeof value === 'string' && value.trim() !== '' && value.length <= 200;

const bad = (res, message) => res.status(400).json({ error: message });

// A limit per logged-in person (not per internet address)
function perPerson(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    keyGenerator: (req) => req.user.id,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many card lookups. Please wait a minute and try again.' },
  });
}

// service: the lookups (the tests give a fake one); limit: lookups per
// person per minute. "Many cards at once" costs us the most, so it gets
// a sixth of that.
export function createScryfallRouter(service, limit) {
  const router = Router();
  router.use(perPerson(limit));

  router.get('/names', async (req, res) => {
    const { data, stale } = await service.names();
    res.json({ names: data, stale });
  });

  router.get('/sets', async (req, res) => {
    const { data, stale } = await service.setIcons();
    res.json({ icons: data, stale });
  });

  router.get('/cards/named', async (req, res) => {
    const mode = typeof req.query.exact === 'string' ? 'exact' : typeof req.query.fuzzy === 'string' ? 'fuzzy' : null;
    if (!mode || !isName(req.query[mode])) return bad(res, 'Give a card name: ?exact=NAME or ?fuzzy=NAME');
    const { data, stale } = await service.cardByName(mode, req.query[mode].trim());
    return res.json({ card: data, stale });
  });

  // Many cards at once. Declared before the "by id" routes only for tidiness.
  router.post('/cards/collection', perPerson(Math.max(1, Math.floor(limit / 6))), async (req, res) => {
    const list = req.body?.identifiers;
    if (!Array.isArray(list) || list.length === 0) return bad(res, 'identifiers must be a list of cards');
    if (list.length > MAX_COLLECTION) return bad(res, `At most ${MAX_COLLECTION} cards at a time`);
    const identifiers = [];
    for (const item of list) {
      if (typeof item?.id === 'string' && SCRYFALL_ID.test(item.id)) identifiers.push({ id: item.id });
      else if (typeof item?.set === 'string' && SET_CODE.test(item.set)
        && typeof item?.number === 'string' && COLLECTOR_NUMBER.test(item.number)) {
        identifiers.push({ set: item.set, number: item.number });
      } else return bad(res, 'Each card needs an id, or a set and a number');
    }
    return res.json(await service.collection(identifiers));
  });

  router.get('/cards/set/:set/:number', async (req, res) => {
    const { set, number } = req.params;
    if (!SET_CODE.test(set) || !COLLECTOR_NUMBER.test(number)) return bad(res, 'Invalid set or number');
    const { data, stale } = await service.cardBySet(set, number);
    return res.json({ card: data, stale });
  });

  router.get('/cards/set/:set/:number/languages', async (req, res) => {
    const { set, number } = req.params;
    if (!SET_CODE.test(set) || !COLLECTOR_NUMBER.test(number)) return bad(res, 'Invalid set or number');
    const { data, stale } = await service.languages(set, number);
    return res.json({ cards: data, stale });
  });

  router.get('/cards/id/:id', async (req, res) => {
    if (!SCRYFALL_ID.test(req.params.id)) return bad(res, 'Invalid card ID');
    const { data, stale } = await service.cardById(req.params.id);
    return res.json({ card: data, stale });
  });

  router.get('/cards/id/:id/prints', async (req, res) => {
    if (!SCRYFALL_ID.test(req.params.id)) return bad(res, 'Invalid card ID');
    const { data, stale } = await service.prints(req.params.id);
    return res.json({ cards: data, stale });
  });

  router.get('/cards/id/:id/rulings', async (req, res) => {
    if (!SCRYFALL_ID.test(req.params.id)) return bad(res, 'Invalid card ID');
    const { data, stale } = await service.rulings(req.params.id);
    return res.json({ rulings: data, stale });
  });

  // Turn Scryfall's troubles into plain answers for the app. (Express 5
  // sends anything thrown in the routes above to here.)
  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, next) => {
    if (!(err instanceof ScryfallError)) return next(err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 429) {
      if (err.retryAfterSeconds) res.set('Retry-After', String(err.retryAfterSeconds));
      return res.status(503).json({ error: 'Card information is busy right now. Please try again in a moment.' });
    }
    if (err.status >= 400 && err.status < 500) return res.status(400).json({ error: err.message });
    return res.status(502).json({ error: 'Card information could not be reached. Please try again in a moment.' });
  });

  return router;
}

// The router the server uses: the real lookups, with the shared polite client
export default function makeScryfallRouter(limit) {
  return createScryfallRouter(createScryfallService(scryfall), limit);
}
