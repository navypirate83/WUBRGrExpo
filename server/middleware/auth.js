/* =====================================================================
   WHO IS ASKING?
   requireAuth checks the login token on a request and says who it is.
   requireAdmin goes after it and lets only admins through.
   ===================================================================== */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Every sign-in failure gets this same answer, so nothing is revealed
function pleaseSignIn(res) {
  return res.status(401).json({ error: 'Please sign in' });
}

// Reads "Authorization: Bearer <token>", checks the signature (only the
// HS256 way, so a forged token claiming "no signature needed" is refused),
// and that the account still exists. On success the request carries
// req.user = { id, sub, email, role }.
export async function requireAuth(req, res, next) {
  try {
    const parts = (req.headers.authorization ?? '').split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] === '') return pleaseSignIn(res);
    const payload = jwt.verify(parts[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    // A real token for an account that has been deleted must not work
    if (typeof payload.sub !== 'string' || !(await User.exists({ _id: payload.sub }))) return pleaseSignIn(res);
    req.user = { ...payload, id: payload.sub };
    return next();
  } catch {
    // Missing, malformed, wrong signature, expired, or no secret set
    return pleaseSignIn(res);
  }
}

// Only admins may pass (the role comes from the 15-minute token, so a
// change reaches a signed-in person within 15 minutes)
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  return next();
}

// The one rule for "whose things may this person touch": only their own.
// Every database search spreads this in, so someone else's item looks
// exactly like one that doesn't exist (even admins get no special view).
export function ownerFilter(req) {
  return { owner: req.user.sub };
}
