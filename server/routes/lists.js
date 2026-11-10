/* =====================================================================
   CARD LIST ROUTES (/lists/...)
   Lists work like binders, but they are an ordered line of cards with
   no pages or pockets. Mounted behind requireAuth in app.js; every
   search is filtered by the owner (see ownerFilter).
   - GET    /lists              my lists (with how many cards each)
   - POST   /lists              make a list
   - GET    /lists/:id          one list
   - PUT    /lists/:id          rename it
   - DELETE /lists/:id          delete it and its cards
   - GET    /lists/:id/cards    its cards, in order
   - PUT    /lists/:id/cards    replace all its cards (the order sent is kept)
   ===================================================================== */

import { Router } from 'express';
import mongoose from 'mongoose';
import List from '../models/List.js';
import ListCard from '../models/ListCard.js';
import { ownerFilter } from '../middleware/auth.js';
import { handleDbError } from '../middleware/errorHandler.js';
import { parsePaging } from '../utils/paging.js';
import { validateListCard, validateListName } from '../utils/validate.js';

const router = Router();

// The most cards one list may hold (a safety cap)
const MAX_CARDS_PER_LIST = 10000;
const BATCH = 1000;
const CARD_FIELDS = '-_id -owner -list -__v -createdAt -updatedAt -position';
const notFound = (res) => res.status(404).json({ error: 'Not found' });

router.get('/', async (req, res) => {
  const paging = parsePaging(req.query);
  if (paging.error) return res.status(400).json({ error: paging.error });
  try {
    const filter = ownerFilter(req);
    const [lists, total] = await Promise.all([
      List.find(filter).sort({ _id: 1 }).skip(paging.skip).limit(paging.limit).lean(),
      List.countDocuments(filter),
    ]);
    const counts = await ListCard.aggregate([
      { $match: { list: { $in: lists.map((l) => l._id) } } },
      { $group: { _id: '$list', n: { $sum: 1 } } },
    ]);
    const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
    res.set('X-Total-Count', String(total));
    return res.json(lists.map((l) => ({ ...l, __v: undefined, cardCount: countOf.get(String(l._id)) ?? 0 })));
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.post('/', async (req, res) => {
  const result = validateListName(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    const list = await List.create({ ...result.value, owner: req.user.sub });
    return res.status(201).json(list);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const list = await List.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!list) return notFound(res);
    return res.json(list);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.put('/:id', async (req, res) => {
  const result = validateListName(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    const list = await List.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req) },
      { $set: result.value },
      { returnDocument: 'after', runValidators: true },
    );
    if (!list) return notFound(res);
    return res.json(list);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const list = await List.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });
    if (!list) return notFound(res);
    await ListCard.deleteMany({ list: list._id });
    return res.status(204).end();
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.get('/:id/cards', async (req, res) => {
  try {
    const list = await List.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!list) return notFound(res);
    // In the order they were saved (the "position" each card remembers)
    const cards = await ListCard.find({ list: list._id }).sort({ position: 1 }).select(CARD_FIELDS).lean();
    res.set('X-Total-Count', String(cards.length));
    return res.json(cards);
  } catch (err) {
    return handleDbError(err, res);
  }
});

// Replaces all the list's cards. The order sent is the order kept: the
// server numbers the cards 0, 1, 2... Everything is checked first, then
// swapped in one all-or-nothing transaction.
router.put('/:id/cards', async (req, res) => {
  const cards = req.body?.cards;
  if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards must be a list' });
  if (cards.length > MAX_CARDS_PER_LIST) return res.status(400).json({ error: `A list can hold at most ${MAX_CARDS_PER_LIST} cards` });

  const checked = [];
  for (let index = 0; index < cards.length; index += 1) {
    const result = validateListCard(cards[index]);
    if (result.error) return res.status(400).json({ error: `Card ${index}: ${result.error}` });
    checked.push({ ...result.value, position: index });
  }

  try {
    const list = await List.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!list) return notFound(res);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ListCard.deleteMany({ list: list._id }, { session });
        for (let start = 0; start < checked.length; start += BATCH) {
          const slice = checked.slice(start, start + BATCH).map((card) => ({ ...card, owner: req.user.sub, list: list._id }));
          await ListCard.insertMany(slice, { session });
        }
      });
    } finally {
      await session.endSession();
    }
    // Note the time on the list itself, so other devices can tell its cards changed
    await List.updateOne({ _id: list._id }, { $currentDate: { updatedAt: true } });
    return res.json({ saved: checked.length });
  } catch (err) {
    return handleDbError(err, res);
  }
});

export default router;
