/* =====================================================================
   THE SCRYFALL SERVICE
   The things the app can ask the server about cards. Each one first
   looks in the answer notebook (scryfallCache.js) and only asks Scryfall
   (through the polite client) when the notebook has nothing fresh.
   Every answer comes back as { data, stale }: "stale" is true when
   Scryfall couldn't be reached and an older saved answer was used.
   The client is handed in (not imported here) so the tests can use a
   fake one.
   ===================================================================== */

import ScryfallCache from '../models/ScryfallCache.js';
import { cachedLookup } from './scryfallCache.js';
import { slimCard } from './scryfallSlim.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const KEEP_OLD_MS = 30 * DAY;

// How long an answer counts as fresh. Anything with prices in it is
// refreshed daily (Scryfall updates prices about once a day); the rest
// hardly ever changes.
const FRESH = {
  names: DAY,
  sets: 7 * DAY,
  card: DAY,
  prints: DAY,
  rulings: 7 * DAY,
  languages: 7 * DAY,
};

// Safety caps, so one odd card can't use up the database or our turn at
// Scryfall: at most this many pages (175 cards each) of printings
const MAX_PAGES = 20;
// Scryfall takes up to this many cards in one "collection" request
const COLLECTION_BATCH = 75;

// Lowercase, for keys that shouldn't care about capital letters
const lower = (text) => String(text).toLowerCase();

// The notebook keys for a card: by set and number, and by Scryfall ID
const setKey = (set, number) => `card:${lower(set)}/${lower(number)}`;
const idKey = (id) => `id:${lower(id)}`;

export function createScryfallService(client) {
  // Read a list that comes in pages (printings, languages): keep asking
  // for the next page, trimming every card.
  async function allPages(firstPath) {
    const cards = [];
    let next = firstPath;
    for (let page = 0; next && page < MAX_PAGES; page += 1) {
      const answer = await client.get(next);
      cards.push(...answer.data.map(slimCard));
      next = answer.has_more ? answer.next_page : undefined;
    }
    return cards;
  }

  // The name of every card (about 35,000), for the app's search box
  const names = () => cachedLookup({
    key: 'names', kind: 'names', ttlMs: FRESH.names,
    load: async () => (await client.get('/catalog/card-names')).data,
  });

  // Every set's symbol picture: { setCode: pictureAddress }
  const setIcons = () => cachedLookup({
    key: 'sets', kind: 'sets', ttlMs: FRESH.sets,
    load: async () => {
      const sets = await client.get('/sets');
      return Object.fromEntries(sets.data.map((set) => [set.code, set.icon_svg_uri]));
    },
  });

  // One card by name. mode is 'exact' (the name came from our own list)
  // or 'fuzzy' (Scryfall guesses the closest match).
  const cardByName = (mode, name) => cachedLookup({
    key: `named:${mode}:${lower(name)}`, kind: 'card', ttlMs: FRESH.card,
    load: async () => slimCard(await client.get(`/cards/named?${mode}=${encodeURIComponent(name)}`)),
  });

  // One exact printing, by set code and collector number
  const cardBySet = (set, number) => cachedLookup({
    key: setKey(set, number), kind: 'card', ttlMs: FRESH.card,
    // (set codes are always lowercase at Scryfall)
    load: async () => slimCard(await client.get(`/cards/${encodeURIComponent(lower(set))}/${encodeURIComponent(number)}`)),
  });

  // One printing, by its Scryfall ID
  const cardById = (id) => cachedLookup({
    key: idKey(id), kind: 'card', ttlMs: FRESH.card,
    load: async () => slimCard(await client.get(`/cards/${encodeURIComponent(id)}`)),
  });

  // Every printing of a card (in every set), found from any one printing
  const prints = (id) => cachedLookup({
    key: `prints:${lower(id)}`, kind: 'prints', ttlMs: FRESH.prints,
    load: async () => {
      const { data: card } = await cardById(id);
      return allPages(card.prints_search_uri);
    },
  });

  // The official rulings for a card, oldest first
  const rulings = (id) => cachedLookup({
    key: `rulings:${lower(id)}`, kind: 'rulings', ttlMs: FRESH.rulings,
    load: async () => {
      const answer = await client.get(`/cards/${encodeURIComponent(id)}/rulings`);
      return answer.data.map((r) => ({ source: r.source, published_at: r.published_at, comment: r.comment }));
    },
  });

  // One exact printing in every language it was made in
  const languages = (set, number) => cachedLookup({
    key: `langs:${lower(set)}/${lower(number)}`, kind: 'languages', ttlMs: FRESH.languages,
    load: async () => {
      const query = `set:${set} cn:"${number}" lang:any`;
      return allPages(`/cards/search?unique=prints&q=${encodeURIComponent(query)}`);
    },
  });

  // Many cards at once. identifiers are { set, number } or { id }.
  // Cards already in the notebook cost Scryfall nothing; the rest are
  // asked for 75 at a time. Returns
  //   cards:       the cards found, in the order asked
  //   notFound:    identifiers Scryfall doesn't know
  //   unavailable: identifiers we couldn't check right now (Scryfall busy
  //                or unreachable, and no saved copy): try again later
  //   stale:       true if any card is an older saved copy
  async function collection(identifiers, now = () => Date.now()) {
    const keyOf = (i) => (i.id ? idKey(i.id) : setKey(i.set, i.number));
    const wanted = new Map();
    for (const identifier of identifiers) wanted.set(keyOf(identifier), identifier);

    // What the notebook already has (fresh or not)
    const saved = new Map(
      (await ScryfallCache.find({ key: { $in: [...wanted.keys()] } }).lean()).map((row) => [row.key, row]),
    );
    const found = new Map();
    let stale = false;
    const missing = [];
    for (const [key, identifier] of wanted) {
      const row = saved.get(key);
      if (row && row.expiresAt.getTime() > now()) found.set(key, row.data);
      else missing.push([key, identifier]);
    }

    // Ask Scryfall for the rest, 75 at a time
    const couldNotCheck = new Set();
    for (let start = 0; start < missing.length; start += COLLECTION_BATCH) {
      const batch = missing.slice(start, start + COLLECTION_BATCH);
      try {
        const answer = await client.post('/cards/collection', {
          identifiers: batch.map(([, i]) => (i.id ? { id: i.id } : { set: i.set, collector_number: i.number })),
        });
        const cards = answer.data.map(slimCard);
        const when = now();
        // Save every card under both of its names (set and number, and ID)
        const writes = [];
        for (const card of cards) {
          for (const key of [setKey(card.set, card.collector_number), idKey(card.id)]) {
            found.set(key, card);
            writes.push({ updateOne: {
              filter: { key },
              update: { $set: {
                kind: 'card', data: card, fetchedAt: new Date(when),
                expiresAt: new Date(when + FRESH.card), deleteAt: new Date(when + FRESH.card + KEEP_OLD_MS),
              } },
              upsert: true,
            } });
          }
        }
        if (writes.length > 0) await ScryfallCache.bulkWrite(writes, { ordered: false });
      } catch (err) {
        // Can't reach Scryfall (or it's busy): use any older saved copy
        const trouble = !err.status || err.status === 429 || err.status >= 500;
        if (!trouble) throw err;
        for (const [key] of batch) {
          if (saved.has(key)) { found.set(key, saved.get(key).data); stale = true; }
          else couldNotCheck.add(key);
        }
      }
    }

    // Put the answers in the order asked
    const cards = [];
    const notFound = [];
    const unavailable = [];
    const seen = new Set();
    for (const identifier of identifiers) {
      const key = keyOf(identifier);
      if (found.has(key)) {
        const card = found.get(key);
        if (!seen.has(card.id)) { seen.add(card.id); cards.push(card); }
      } else if (couldNotCheck.has(key)) unavailable.push(identifier);
      else notFound.push(identifier);
    }
    return { cards, notFound, unavailable, stale };
  }

  return { names, setIcons, cardByName, cardBySet, cardById, prints, rulings, languages, collection };
}
