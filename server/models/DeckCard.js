/* =====================================================================
   THE DECK CARD MODEL
   One card in a deck. A deck is in order (and a card is removed by its
   place in that order), so each card remembers its "position". A card is
   kept in the main deck (no "zone"), the sideboard ("side") or the command
   zone ("command", in spot "slot" 0 or 1: the commander or Oathbreaker, then
   the partner, Background or signature spell).
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';
import { cardFields } from './Card.js';

const deckCardSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deck: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
    // Its place in the deck, counting from 0
    position: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: 'position must be a whole number' } },
    manaCost: { type: String, default: '', maxlength: 100 },
    typeLine: { type: String, default: '', maxlength: 200 },
    zone: { type: String, enum: ['side', 'command'] },
    slot: { type: Number, enum: [0, 1] },
    ...cardFields,
  },
  { timestamps: true },
);

// Cards come back in order, and no two share a place in the same deck
deckCardSchema.index({ deck: 1, position: 1 }, { unique: true });

export default mongoose.model('DeckCard', deckCardSchema, COLLECTIONS.deckCard);
