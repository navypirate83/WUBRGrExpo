/* =====================================================================
   THE BINDER MODEL
   One document per binder (its name, cover and page count). The cards
   in it are separate documents (see Card.js).
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';

// The cover colors the app offers (anything else must be a "#rrggbb" code)
export const COVER_NAMES = ['white', 'blue', 'black', 'red', 'green', 'gold', 'gray', 'purple', 'orange'];

// Is this a good cover: a color name, or a code like "#3a7bd5"?
export function isGoodCover(value) {
  return COVER_NAMES.includes(value) || /^#[0-9a-fA-F]{6}$/.test(value);
}

// The symbols a cover can have: a mana symbol ("U", "WB") or a set's symbol
// ("set:mh3": "set:" and the set's lowercase code). One rule, shared by
// the model, the checks in utils/validate.js and the .csv import.
export const COVER_SYMBOL_PATTERN = /^([A-Z]{1,2}|set:[a-z0-9]{2,8})$/;

const binderSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 12 },
    // The symbol on the cover: a mana symbol ("U", "WB", ...), a set symbol
    // ("set:mh3"), or none
    color: { type: String, default: null, match: COVER_SYMBOL_PATTERN, maxlength: 12 },
    cover: {
      type: String,
      default: 'black',
      maxlength: 7,
      validate: { validator: isGoodCover, message: 'Cover must be a color name or a #rrggbb code' },
    },
    pages: {
      type: Number,
      default: 10,
      min: 1,
      max: 100000,
      validate: { validator: Number.isInteger, message: 'Pages must be a whole number' },
    },
    // How many pockets across and down a page, like "4x4"
    pageLayout: { type: String, default: '4x4', match: /^[0-9]{1,2}x[0-9]{1,2}$/, maxlength: 5 },
  },
  { timestamps: true },
);

// A person can't have two binders with the same name. The "collation"
// makes "Binder" and "binder" count as the same name.
binderSchema.index({ owner: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('Binder', binderSchema, COLLECTIONS.binder);
