/* =====================================================================
   THE CARD MODEL
   One document per card sitting in a binder pocket. Cards are their own
   documents (not stored inside the binder) because one binder can hold
   thousands of cards and one MongoDB document is capped at 16 MB.
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';

// A check that a number is a whole number
const whole = { validator: Number.isInteger, message: '{PATH} must be a whole number' };

// The fields every kind of card has, shared with ListCard.js so the two
// can never drift apart
export const cardFields = {
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  set: { type: String, lowercase: true, trim: true, maxlength: 10, default: '' },
  number: { type: String, trim: true, maxlength: 20, default: '' },
  // 0 = front, 1 = back
  face: { type: Number, enum: [0, 1], default: 0 },
  image: { type: String, required: true, maxlength: 500, match: [/^https:\/\//, 'image must be an https address'] },
  lang: { type: String, default: 'en', maxlength: 10 },
  count: { type: Number, default: 1, min: 1, max: 99, validate: whole },
  foil: { type: Boolean, default: false },
  added: { type: Date },
  // Other columns kept from an uploaded file (Condition, Rarity, ...)
  extra: { type: Map, of: { type: String, maxlength: 200 } },
};

const cardSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    binder: { type: mongoose.Schema.Types.ObjectId, ref: 'Binder', required: true },
    page: { type: Number, required: true, min: 1, validate: whole },
    pocket: { type: Number, required: true, min: 1, validate: whole },
    ...cardFields,
  },
  { timestamps: true },
);

// Two cards can never sit in the same pocket of the same binder
cardSchema.index({ binder: 1, page: 1, pocket: 1 }, { unique: true });
// For finding a card by name across a whole collection
cardSchema.index({ owner: 1, name: 1 });

export default mongoose.model('Card', cardSchema, COLLECTIONS.card);
