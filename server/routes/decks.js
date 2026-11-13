/* =====================================================================
   DECK ROUTES (/decks/...)
   Decks work like card lists: an ordered line of cards, each kept in the
   main deck, the sideboard or the command zone. A deck also has a format.
   Mounted behind requireAuth in app.js; every search is filtered by the
   owner (see ownerFilter), so nobody can read or change anyone else's deck.
   - GET    /decks              my decks (with how many cards each)
   - POST   /decks              make a deck (a name and a format)
   - GET    /decks/:id          one deck
   - PUT    /decks/:id          rename it and/or change its format
   - DELETE /decks/:id          delete it and its cards
   - GET    /decks/:id/cards    its cards, in order
   - PUT    /decks/:id/cards    replace all its cards (the order sent is kept)
   ===================================================================== */

import { Router } from 'express';
import mongoose from 'mongoose';
import Deck from '../models/Deck.js';
import DeckCard from '../models/DeckCard.js';
import { ownerFilter } from '../middleware/auth.js';
import { handleDbError } from '../middleware/errorHandler.js';
import { parsePaging } from '../utils/paging.js';
import { validateDeck, validateDeckCard } from '../utils/validate.js';

const router = Router();

// The most cards one deck may hold (a safety cap)
const MAX_CARDS_PER_DECK = 10000;
const BATCH = 1000;
const CARD_FIELDS = '-_id -owner -deck -__v -createdAt -updatedAt -position';
const notFound = (res) => res.status(404).json({ error: 'Not found' });

router.get('/', async (req, res) => {
  const paging = parsePaging(req.query);
  if (paging.error) return res.status(400).json({ error: paging.error });
  try {
    const filter = ownerFilter(req);
    const [decks, total] = await Promise.all([
      Deck.find(filter).sort({ _id: 1 }).skip(paging.skip).limit(paging.limit).lean(),
      Deck.countDocuments(filter),
    ]);
    const counts = await DeckCard.aggregate([
      { $match: { deck: { $in: decks.map((d) => d._id) } } },
      { $group: { _id: '$deck', n: { $sum: 1 } } },
    ]);
    const countOf = new Map(counts.map((c) => [String(c._id), c.n]));
    res.set('X-Total-Count', String(total));
    return res.json(decks.map((d) => ({ ...d, __v: undefined, cardCount: countOf.get(String(d._id)) ?? 0 })));
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.post('/', async (req, res) => {
  const result = validateDeck(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    const deck = await Deck.create({ ...result.value, owner: req.user.sub });
    return res.status(201).json(deck);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const deck = await Deck.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!deck) return notFound(res);
    return res.json(deck);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.put('/:id', async (req, res) => {
  const result = validateDeck(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  try {
    const deck = await Deck.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req) },
      { $set: result.value },
      { returnDocument: 'after', runValidators: true },
    );
    if (!deck) return notFound(res);
    return res.json(deck);
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deck = await Deck.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) });
    if (!deck) return notFound(res);
    await DeckCard.deleteMany({ deck: deck._id });
    return res.status(204).end();
  } catch (err) {
    return handleDbError(err, res);
  }
});

router.get('/:id/cards', async (req, res) => {
  try {
    const deck = await Deck.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!deck) return notFound(res);
    // In the order they were saved (the "position" each card remembers)
    const cards = await DeckCard.find({ deck: deck._id }).sort({ position: 1 }).select(CARD_FIELDS).lean();
    res.set('X-Total-Count', String(cards.length));
    return res.json(cards);
  } catch (err) {
    return handleDbError(err, res);
  }
});

// Replaces all the deck's cards. The order sent is the order kept: the
// server numbers the cards 0, 1, 2... Everything is checked first, then
// swapped in one all-or-nothing transaction.
router.put('/:id/cards', async (req, res) => {
  const cards = req.body?.cards;
  if (!Array.isArray(cards)) return res.status(400).json({ error: 'cards must be a list' });
  if (cards.length > MAX_CARDS_PER_DECK) return res.status(400).json({ error: `A deck can hold at most ${MAX_CARDS_PER_DECK} cards` });

  const checked = [];
  for (let index = 0; index < cards.length; index += 1) {
    const result = validateDeckCard(cards[index]);
    if (result.error) return res.status(400).json({ error: `Card ${index}: ${result.error}` });
    checked.push({ ...result.value, position: index });
  }

  try {
    const deck = await Deck.findOne({ _id: req.params.id, ...ownerFilter(req) });
    if (!deck) return notFound(res);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await DeckCard.deleteMany({ deck: deck._id }, { session });
        for (let start = 0; start < checked.length; start += BATCH) {
          const slice = checked.slice(start, start + BATCH).map((card) => ({ ...card, owner: req.user.sub, deck: deck._id }));
          await DeckCard.insertMany(slice, { session });
        }
      });
    } finally {
      await session.endSession();
    }
    // Note the time on the deck itself, so other devices can tell its cards changed
    await Deck.updateOne({ _id: deck._id }, { $currentDate: { updatedAt: true } });
    return res.json({ saved: checked.length });
  } catch (err) {
    return handleDbError(err, res);
  }
});

export default router;
