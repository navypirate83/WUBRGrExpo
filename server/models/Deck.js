/* =====================================================================
   THE DECK MODEL
   One document per deck (a named deck in one format, like Commander).
   The cards are separate documents (see DeckCard.js). Like a list, a deck
   belongs to one person and is only ever read or changed by its owner.
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';

// The formats a deck can be built for: the same codes as Scryfall's card
// "legalities" and the app's own list (src/lib/deckFormats.ts). Paper
// formats only.
export const DECK_FORMAT_CODES = [
  'commander', 'oathbreaker', 'duel', 'paupercommander', 'predh', 'tlr',
  'standard', 'pioneer', 'modern', 'legacy', 'vintage', 'pauper', 'penny', 'premodern', 'oldschool', 'future',
];

const deckSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    format: { type: String, enum: DECK_FORMAT_CODES, default: 'commander' },
  },
  { timestamps: true },
);

// A person can't have two decks with the same name ("Deck" = "deck")
deckSchema.index({ owner: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('Deck', deckSchema, COLLECTIONS.deck);
