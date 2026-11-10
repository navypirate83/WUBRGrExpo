/* =====================================================================
   THE PASSWORD RESET MODEL
   When someone taps "Forgot username/password", we email a 6-digit code.
   Here we keep only the code's fingerprint (never the code itself), when
   it stops working (15 minutes), and how many wrong guesses were made.
   Rows delete themselves when they expire.
   ===================================================================== */

import mongoose from 'mongoose';
import { COLLECTIONS } from './collectionNames.js';

const passwordResetSchema = new mongoose.Schema(
  {
    // One waiting reset per person
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    codeHash: { type: String, required: true, maxlength: 128 },
    // Wrong guesses so far (after 5 the code is thrown away)
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// A "self-destruct date": MongoDB deletes each row once its expiresAt passes
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PasswordReset', passwordResetSchema, COLLECTIONS.passwordReset);
