/* =====================================================================
   LOGIN TOKENS
   Signing in gives the app two tokens:
   - an ACCESS token: a signed note saying who you are. It lasts only
     15 minutes (so a stolen one stops working fast) and the app keeps
     it in memory only.
   - a REFRESH token: a long random secret (60 days) the app keeps so you
     stay signed in. It buys a new pair when the access token runs out.
     We save only its SHA-256 fingerprint, never the token itself.
   ===================================================================== */

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import RefreshToken from '../models/RefreshToken.js';

// How long a refresh token lives: 60 days
const REFRESH_DAYS = 60;

// The fingerprint of a token. SHA-256 is fine here (no need for the slow
// bcrypt) because the token is already long and random, so there is
// nothing to guess, and the server needs to find the row fast.
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// A short-lived signed note about who the user is
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256' },
  );
}

// A new refresh token: 48 random bytes written as text. Only the
// fingerprint is saved; the plain text is returned once and forgotten.
// "family" ties together every token that came from one login.
export async function createRefreshToken(user, family = crypto.randomUUID()) {
  const token = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(token),
    family,
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

// The one way every sign-in ends (signup, login, refresh, Google): both
// tokens plus a user object built BY HAND with only safe fields, so a
// password hash can never leak even if the model gains fields later.
export async function issueSession(user, family) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: await createRefreshToken(user, family),
    user: {
      id: String(user._id),
      username: user.username,
      email: user.email,
      name: user.name ?? '',
      role: user.role,
    },
  };
}
