/* =====================================================================
   THE SCRYFALL CACHE MODEL
   A small notebook of answers we already got from Scryfall, so most
   requests never need to bother Scryfall again. Each row is one answer:
     - key: what was asked (like "card:set/lea/1")
     - data: the answer, already trimmed down to what the app uses
     - expiresAt: after this the answer is "old" and worth refreshing
     - deleteAt: after this the row is thrown away. It is later than
       expiresAt on purpose: if Scryfall is down, an old answer is still
       better than none.
   Rows delete themselves, so the notebook can't grow without limit (the
   free database has only 512 MB). It fills up only with cards people
   actually looked at.
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';

const scryfallCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, maxlength: 300 },
  // What kind of answer it is (card, names, sets, prices...), for tidying
  kind: { type: String, required: true, maxlength: 40 },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  deleteAt: { type: Date, required: true },
});

// A "self-destruct date": MongoDB deletes each row once its deleteAt passes
scryfallCacheSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('ScryfallCache', scryfallCacheSchema, COLLECTIONS.scryfallCache);
