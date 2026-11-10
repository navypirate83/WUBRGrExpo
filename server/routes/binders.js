/* =====================================================================
   BINDER AND CARD ROUTES (/binders/...)
   Mounted behind requireAuth in app.js, so every request here has a
   signed-in person in req.user. THE KEY RULE: every search is filtered
   by the owner (ownerFilter), and the owner is never taken from the
   request. Asking for someone else's binder gets "Not found", exactly
   like an id that doesn't exist.
   - GET    /binders               my binders (with how many cards each)
   - POST   /binders               make a binder
   - GET    /binders/:id           one binder
   - PUT    /binders/:id           change a binder's details
   - DELETE /binders/:id           delete a binder and its cards
   - GET    /binders/:id/cards     all its cards
   - PUT    /binders/:id/cards     replace all its cards in one go
   - POST   /binders/import        make a binder from the text of a .csv file
   - GET    /binders/:id/export    the binder as a .csv file
   ===================================================================== */

import { Router } from 'express';
import mongoose from 'mongoose';
import Binder from '../models/Binder.js';
import Card from '../models/Card.js';
import { ownerFilter } from '../middleware/auth.js';
import { handleDbError } from '../middleware/errorHandler.js';
import { parsePaging } from '../utils/paging.js';
import { validateBinder, validateCard, checkDate, MAX_CARDS_PER_BINDER } from '../utils/validate.js';
import { binderToCsv, readCsvRows, KEPT_COLUMNS } from '../utils/binderCsv.js';

const router = Router();

// The fields of a card we send back (no ids, owner or bookkeeping)
const CARD_FIELDS = '-_id -owner -binder -__v -createdAt -updatedAt';

// How many cards to write to the database in one go (the free database
// handles about 100 operations a second, so we write in batches, never
// one card per request)
const BATCH = 1000;

// The same 404 for "doesn't exist" and "isn't yours"
const notFound = (res) => res.status(404).json({ error: 'Not found' });

/* ---------- the list of my binders ---------- */

router.get('/', async (req, res) => {
  const paging = parsePaging(req.query);
  if (paging.error) return res.status(400).json({ error: paging.error });
  try {
    const filter = ownerFilter(req);
    const [binders, total] = await Promise.all([
      // Sorted by _id so pages stay steady
      Binder.find(filter).sort({ _id: 1 }).skip(paging.skip).limit(paging.limit).lean(),
      Binder.countDocuments(filter),
    ]);
    // How many cards each binder on this page has, in one question
    const counts = await Card.aggregate([
      { $match: { binder: { $in: binders.map((b) => b._id) } } },
      { $group: { _id: '$binder', n: { $sum: 1 } } },
    ]);
    const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
    res.set('X-Total-Count', String(total));
    return res.json(binders.map((b) => ({ ...b, __v: undefined, cardCount: countOf.get(String(b._id)) ?? 0 })));
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- make a binder from a .csv file ---------- */
// (before the "/:id" routes, or "import" would be taken for an id)

router.post('/import', async (req, res) => {
  const text = req.body?.csv;
  if (typeof text !== 'string' || text.trim() === '') return res.status(400).json({ error: 'csv must be the text of a .csv file' });

  let rows;
  try {
    rows = readCsvRows(text);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (rows.length === 0) return res.status(400).json({ error: 'The file has no cards' });
  if (rows.length > MAX_CARDS_PER_BINDER) return res.status(400).json({ error: `A file can have at most ${MAX_CARDS_PER_BINDER} rows` });

  // The binder's own details come from the first row (or from the request)
  const first = rows[0];
  const layoutText = /^[0-9]{1,2}x[0-9]{1,2}$/.test(first['Page layout'] ?? '') ? first['Page layout'] : '4x4';
  const [across, down] = layoutText.split('x').map(Number);
  const perPage = Math.max(1, across * down);

  const taken = new Set();
  const valid = [];
  const skipped = [];
  let autoPage = 1;
  let autoPocket = 1;

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // row 1 is the column names
    const skip = (reason) => skipped.push({ row: rowNumber, reason });

    // Only rows with a real Scryfall ID are accepted here: the picture
    // address is built from it (the app's own importer can look up the rest)
    const id = (row['Scryfall ID'] ?? '').toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return skip('Missing or invalid Scryfall ID');
    const face = (row.Side ?? '').toLowerCase() === 'back' ? 1 : 0;

    // Quantity: a whole number from 1 to 99 (blank means 1)
    const quantityText = row.Quantity === undefined || row.Quantity === '' ? '1' : row.Quantity;
    if (!/^[0-9]{1,4}$/.test(quantityText) || Number(quantityText) < 1 || Number(quantityText) > 99) {
      return skip(`Quantity ${quantityText} is not a whole number from 1 to 99`);
    }

    // Where the card sits: from the Page and Pocket columns, or the next free pocket
    let page = Number(row.Page);
    let pocket = Number(row.Pocket);
    if (!Number.isInteger(page) || !Number.isInteger(pocket) || page < 1 || pocket < 1) {
      while (taken.has(`${autoPage}-${autoPocket}`)) {
        autoPocket += 1;
        if (autoPocket > perPage) { autoPage += 1; autoPocket = 1; }
      }
      page = autoPage;
      pocket = autoPocket;
    }
    if (taken.has(`${page}-${pocket}`)) return skip(`Page ${page}, pocket ${pocket} already has a card`);

    const card = {
      page,
      pocket,
      name: row.Name,
      set: row['Set code'] ?? '',
      number: row['Collector number'] ?? '',
      face,
      image: `https://cards.scryfall.io/normal/${face ? 'back' : 'front'}/${id[0]}/${id[1]}/${id}.jpg`,
      lang: row.Language || 'en',
      count: Number(quantityText),
      foil: ['foil', 'etched', 'true', 'yes'].includes((row.Foil ?? '').toLowerCase()),
    };
    if (row.Added) {
      const dateProblem = checkDate(row.Added, 'Added');
      if (dateProblem) return skip(dateProblem);
      card.added = row.Added;
    }
    // The columns we only keep (condition, rarity, ...)
    const extra = {};
    for (const [column, usual] of Object.entries(KEPT_COLUMNS)) extra[column] = row[column] || usual;
    if ((row.Foil ?? '').toLowerCase() === 'etched') extra.Foil = 'etched';
    card.extra = extra;

    const result = validateCard(card, { withPlace: true });
    if (result.error) return skip(result.error);
    taken.add(`${page}-${pocket}`);
    valid.push(result.value);
  });

  // The binder: name from the request or the file, kept to 12 characters
  const wantedName = typeof req.body.name === 'string' ? req.body.name : first.Binder || 'Imported';
  const biggestPage = valid.reduce((most, card) => Math.max(most, card.page), 1);
  const details = validateBinder({
    name: wantedName.trim().slice(0, 12) || 'Imported',
    color: /^[A-Z]{1,2}$/.test(first['Cover symbol'] ?? '') ? first['Cover symbol'] : null,
    cover: first['Cover color'] || 'black',
    pages: Math.max(biggestPage, Number(first.Pages) || 10),
    pageLayout: layoutText,
  });
  if (details.error) return res.status(400).json({ error: details.error });

  try {
    const binder = await Binder.create({ ...details.value, owner: req.user.sub });
    try {
      for (let start = 0; start < valid.length; start += BATCH) {
        const slice = valid.slice(start, start + BATCH).map((card) => ({ ...card, owner: req.user.sub, binder: binder._id }));
        await Card.insertMany(slice);
      }
    } catch (err) {
      // Don't leave a half-made binder behind
      await Card.deleteMany({ binder: binder._id });
      await Binder.deleteOne({ _id: binder._id });
      throw err;
    }
    return res.status(201).json({ binder: { id: String(binder._id), name: binder.name }, imported: valid.length, skipped });
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- make a binder ---------- */

router.post('/', async (req, res) => {
  const result = validateBinder(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    // The owner is always the signed-in person; one in the body is ignored
    const binder = await Binder.create({ ...result.value, owner: req.user.sub });
    return res.status(201).json(binder);
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- one binder ---------- */

router.get('/:id', async (req, res) => {
  try {
    const binder = await Binder.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!binder) return notFound(res);
    return res.json(binder);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.put('/:id', async (req, res) => {
  // On an update, fields not sent are skipped, but any sent must pass
  const result = validateBinder(req.body, { partial: true });
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    const binder = await Binder.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req) },
      { $set: result.value },
      { returnDocument: 'after', runValidators: true },
    );
    if (!binder) return notFound(res);
    return res.json(binder);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const binder = await Binder.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });
    if (!binder) return notFound(res);
    // The binder's cards go with it
    await Card.deleteMany({ binder: binder._id });
    return res.status(204).end();
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- a binder's cards ---------- */

router.get('/:id/cards', async (req, res) => {
  try {
    const binder = await Binder.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!binder) return notFound(res);
    const cards = await Card.find({ binder: binder._id }).select(CARD_FIELDS).sort({ page: 1, pocket: 1 }).lean();
    res.set('X-Total-Count', String(cards.length));
    return res.json(cards);
  } catch (err) {
    return handleDbError(err, res);
  }
});

// Replaces ALL the binder's cards in one go (the app saves a whole
// binder at a time). Every card is checked first; if any is bad nothing
// is written. The swap happens inside a "transaction" (all or nothing),
// so a failure can't leave half a binder.
router.put('/:id/cards', async (req, res) => {
  const cards = req.body?.cards;
  if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards must be a list' });
  if (cards.length > MAX_CARDS_PER_BINDER) return res.status(400).json({ error: `A binder can hold at most ${MAX_CARDS_PER_BINDER} cards` });

  const checked = [];
  const taken = new Set();
  for (let index = 0; index < cards.length; index += 1) {
    const result = validateCard(cards[index], { withPlace: true });
    if (result.error) return res.status(400).json({ error: `Card ${index}: ${result.error}` });
    const place = `${result.value.page}-${result.value.pocket}`;
    if (taken.has(place)) return res.status(400).json({ error: `Card ${index}: page ${result.value.page}, pocket ${result.value.pocket} is already used by another card` });
    taken.add(place);
    checked.push(result.value);
  }

  try {
    const binder = await Binder.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!binder) return notFound(res);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Card.deleteMany({ binder: binder._id }, { session });
        for (let start = 0; start < checked.length; start += BATCH) {
          const slice = checked.slice(start, start + BATCH).map((card) => ({ ...card, owner: req.user.sub, binder: binder._id }));
          await Card.insertMany(slice, { session });
        }
      });
    } finally {
      await session.endSession();
    }
    // Note the time on the binder itself, so other devices can tell its cards changed
    await Binder.updateOne({ _id: binder._id }, { $currentDate: { updatedAt: true } });
    return res.json({ saved: checked.length });
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- export ---------- */

router.get('/:id/export', async (req, res) => {
  try {
    const binder = await Binder.findOne({ _id: req.params.id, ...ownerFilter(req) }).lean();
    if (!binder) return notFound(res);
    const cards = await Card.find({ binder: binder._id }).sort({ page: 1, pocket: 1 }).lean();
    // A file name with only safe characters
    const fileName = binder.name.replace(/[^A-Za-z0-9 _-]/g, '_') || 'binder';
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    return res.send(binderToCsv(binder, cards));
  } catch (err) {
    return handleDbError(err, res);
  }
});

export default router;
