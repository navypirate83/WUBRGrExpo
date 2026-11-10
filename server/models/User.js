/* =====================================================================
   THE USER MODEL
   One document per account. A person can sign in with a password, with
   Google, or both. The password is never saved as typed: it is
   scrambled ("hashed") with bcrypt first, and it is left out of every
   query unless asked for by name.
   ===================================================================== */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { COLLECTIONS } from './collectionNames.js';

// What a chosen username may look like: 3 to 30 letters, numbers, dots,
// underscores and dashes. No "@", so nobody can register someone else's
// email address as a username.
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;

const userSchema = new mongoose.Schema(
  {
    // The email: saved lowercase and trimmed, and no two accounts share one
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 100 },
    // "user" or "admin". Nobody can set this through the API.
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    // Google's own stable id for the person (only for Google sign-ins).
    // Its unique rule is "sparse": accounts without one don't clash.
    googleId: { type: String, maxlength: 255 },
    // Shown/used for login. If none is chosen it becomes the email.
    username: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        // A chosen username must match the pattern; the defaulted one (the
        // email itself) is also fine. When a person is made by an "upsert"
        // (Google sign-up), there is no document yet, so "this" is the
        // update itself, and the email is read from what is being inserted.
        validator(value) {
          const email = this?.email ?? this?.getUpdate?.()?.$setOnInsert?.email;
          return (typeof email === 'string' && String(value).toLowerCase() === email.toLowerCase())
            || USERNAME_PATTERN.test(value);
        },
        message: 'Username must be 3 to 30 letters, numbers, dots, underscores or dashes',
      },
    },
    // The scrambled password. "select: false" keeps it out of every query
    // unless asked for with .select('+password'). Google-only accounts have none.
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters long'],
      maxlength: 72,
      select: false,
      required: [function () { return !this.googleId; }, 'Password is required'],
    },
  },
  { timestamps: true },
);

// No two accounts share a Google id, but accounts without one are fine
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

// Before checking the rules: no username chosen means "use my email"
userSchema.pre('validate', function () {
  if (!this.username) this.username = this.email;
});

// Just before saving: scramble the password, but only if it was just
// changed (otherwise an already-scrambled password would be scrambled
// again and the person could never sign in)
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// A second safety net: the password never appears when a user is turned into JSON
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.password;
    return ret;
  },
});

export default mongoose.model('User', userSchema, COLLECTIONS.user);
