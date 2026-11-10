/* =====================================================================
   THE LIST MODEL
   One document per card list (a named list of cards, like a wishlist).
   The cards are separate documents (see ListCard.js).
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';

const listSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
  },
  { timestamps: true },
);

// A person can't have two lists with the same name ("List" = "list")
listSchema.index({ owner: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export default mongoose.model('List', listSchema, COLLECTIONS.list);
