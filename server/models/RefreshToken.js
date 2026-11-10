/* =====================================================================
   THE REFRESH TOKEN MODEL
   The record behind "stay signed in". The app keeps a long random
   token; here we keep only its SHA-256 fingerprint (so a stolen
   database can't be used to sign in). Every token that came from one
   login shares a "family", so if an old one is replayed we can cancel
   the whole family. Rows delete themselves when they expire.
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The fingerprint of the token (never the token itself)
    tokenHash: { type: String, required: true, unique: true, maxlength: 128 },
    // One id shared by every token from the same login
    family: { type: String, required: true, index: true, maxlength: 128 },
    // When it was swapped for a newer one (null = still unused)
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// A "self-destruct date": MongoDB deletes each row once its expiresAt passes
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('RefreshToken', refreshTokenSchema, COLLECTIONS.refreshToken);
