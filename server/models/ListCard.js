/* =====================================================================
   THE LIST CARD MODEL
   One card on a card list. A list is in order (and a card is removed by
   its place in that order), so each card remembers its "position".
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';
import { cardFields } from './Card.js';

const listCardSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
    // Its place in the list, counting from 0
    position: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: 'position must be a whole number' } },
    manaCost: { type: String, default: '', maxlength: 100 },
    typeLine: { type: String, default: '', maxlength: 200 },
    ...cardFields,
  },
  { timestamps: true },
);

// Cards come back in order, and no two share a place in the same list
listCardSchema.index({ list: 1, position: 1 }, { unique: true });

export default mongoose.model('ListCard', listCardSchema, COLLECTIONS.listCard);
