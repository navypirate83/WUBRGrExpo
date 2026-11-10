/* =====================================================================
   SIGNING UP, SIGNING IN AND STAYING SIGNED IN (/auth/...)
   - POST /auth/signup       make an account (email + password)
   - POST /auth/login        sign in with a username-or-email + password
   - POST /auth/google       sign in with Google
   - POST /auth/refresh      swap the long-lived token for a fresh pair
   - POST /auth/logout       end this login
   - POST /auth/logout-all   end every login of this account (needs sign-in)
   - POST /auth/forgot       email a 6-digit code (and the username) to an account
   - POST /auth/reset        set a new password using that code
   Every sign-in ends by calling issueSession (see utils/tokens.js).
   The strict rate limits on these routes are attached in app.js.
   ===================================================================== */

import { Router } from 'express';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import User, { USERNAME_PATTERN } from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordReset from '../models/PasswordReset.js';
import { mailIsConfigured, sendMail, sendWelcomeEmail } from '../utils/mail.js';
import { requireAuth } from '../middleware/auth.js';
import { handleDbError } from '../middleware/errorHandler.js';
import { checkText } from '../utils/validate.js';
import { hashToken, issueSession } from '../utils/tokens.js';
import { checkGoogleAccessToken, googleIsConfigured } from '../utils/google.js';

const router = Router();

// Usernames nobody may register (so no one can pose as the admin or the app)
const RESERVED_USERNAMES = ['admin', 'administrator', 'root', 'support', 'system', 'moderator', 'staff', 'wubrg', 'wubrgr', 'wubgr', 'wubrgrexpo'];

// A throwaway scrambled password, made once. Login compares against it
// when there is no such account, so "no account" takes as long as "wrong
// password" and can't be told apart by timing.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// A rough "looks like an email" check
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- sign up ---------- */

router.post('/signup', async (req, res) => {
  // Take ONLY these four fields, so extras like "role" are never looked at
  const { email, password, name, username } = req.body ?? {};

  // Check the input (400 with a clear message)
  const emailProblem = checkText(email, 'Email', { max: 254 });
  if (emailProblem) return res.status(400).json({ error: emailProblem });
  if (!EMAIL_SHAPE.test(email.trim())) return res.status(400).json({ error: 'Email must look like name@example.com' });

  if (typeof password !== 'string') return res.status(400).json({ error: 'Password must be text' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  // bcrypt silently ignores everything after 72 bytes
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ error: 'Password must be at most 72 bytes long' });

  const nameProblem = checkText(name, 'Name', { max: 100 });
  if (nameProblem) return res.status(400).json({ error: nameProblem });

  // A username is optional (nothing, null or empty text = "use my email")
  let chosenUsername;
  if (username !== undefined && username !== null && username !== '') {
    if (typeof username !== 'string') return res.status(400).json({ error: 'Username must be text' });
    if (!USERNAME_PATTERN.test(username.trim())) {
      return res.status(400).json({ error: 'Username must be 3 to 30 letters, numbers, dots, underscores or dashes' });
    }
    chosenUsername = username.trim().toLowerCase();
    if (RESERVED_USERNAMES.includes(chosenUsername)) return res.status(400).json({ error: 'That username is reserved' });
  }

  try {
    // Duplicates (the model saves both trimmed and lowercase, so search the same way)
    const cleanEmail = email.trim().toLowerCase();
    if (await User.exists({ email: cleanEmail })) return res.status(409).json({ error: 'Email already registered' });
    if (chosenUsername && (await User.exists({ username: chosenUsername }))) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    // create() runs the model's rules, so the password is scrambled here
    const user = await User.create({ email: cleanEmail, password, name: name.trim(), username: chosenUsername });
    // Say welcome by email (not waited for, and never a reason signing up fails)
    sendWelcomeEmail(user);
    return res.status(201).json(await issueSession(user));
  } catch (err) {
    // Two signups at the same instant can both pass the checks above; the
    // unique rule in the database stops the second one
    if (err?.code === 11000) {
      const which = err.keyPattern?.username ? 'Username already taken' : 'Email already registered';
      return res.status(409).json({ error: which });
    }
    return handleDbError(err, res);
  }
});

/* ---------- log in ---------- */

router.post('/login', async (req, res) => {
  const { password } = req.body ?? {};
  // "username" or "email": either field may hold the username or the email
  const who = req.body?.username ?? req.body?.email;
  if (typeof who !== 'string' || who.trim() === '' || typeof password !== 'string' || password === '') {
    return res.status(400).json({ error: 'Username or email, and password, are required' });
  }
  try {
    const name = who.trim().toLowerCase();
    // A username can't contain "@", so it can never equal someone else's email
    const user = await User.findOne({ $or: [{ username: name }, { email: name }] }).select('+password');
    // Same amount of work whether or not the account exists (or has a password)
    const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !user.password || !ok) {
      // One answer for "no such account" and "wrong password"
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    return res.status(200).json(await issueSession(user));
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- Google sign-in ---------- */

router.post('/google', async (req, res) => {
  const { accessToken } = req.body ?? {};
  if (typeof accessToken !== 'string' || accessToken === '' || accessToken.length > 4096) {
    return res.status(400).json({ error: 'accessToken is required' });
  }
  if (!googleIsConfigured()) return res.status(503).json({ error: 'Google sign-in is not set up on this server' });
  try {
    let google;
    try {
      google = await checkGoogleAccessToken(accessToken);
    } catch {
      return res.status(503).json({ error: 'Could not reach Google. Try again.' });
    }
    if (!google || !google.emailVerified) return res.status(401).json({ error: 'Please sign in' });

    // Already signed in with this Google account before?
    let user = await User.findOne({ googleId: google.sub });
    if (!user) {
      // An account with this email already exists (a password account)?
      // Link them, because Google says the email is verified.
      const sameEmail = await User.findOne({ email: google.email });
      if (sameEmail) {
        if (sameEmail.googleId) return res.status(409).json({ error: 'That email belongs to another Google account' });
        sameEmail.googleId = google.sub;
        await sameEmail.save();
        user = sameEmail;
      } else {
        // A brand-new person. One upsert, so two simultaneous first sign-ins
        // can't create two users. Upserts skip model hooks, so set the
        // username (the email) and other fields ourselves.
        // (includeResultMetadata tells us whether this call made the person
        // or somebody else's simultaneous call did, so only one welcome is sent)
        const result = await User.findOneAndUpdate(
          { googleId: google.sub },
          { $setOnInsert: { googleId: google.sub, email: google.email, username: google.email, name: google.name, role: 'user' } },
          { upsert: true, returnDocument: 'after', runValidators: true, includeResultMetadata: true },
        );
        user = result.value;
        if (result.lastErrorObject?.updatedExisting === false) sendWelcomeEmail(user);
      }
    }
    return res.status(200).json(await issueSession(user));
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- staying signed in ---------- */

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== 'string' || refreshToken === '') {
    return res.status(400).json({ error: 'refreshToken is required' });
  }
  try {
    const tokenHash = hashToken(refreshToken);
    const row = await RefreshToken.findOne({ tokenHash });
    // Not found, or past its 60 days
    if (!row || row.expiresAt <= new Date()) return res.status(401).json({ error: 'Please sign in' });

    // Already swapped for a newer one: someone is replaying an old token
    // (it may have been copied). Cancel every token from this login.
    if (row.usedAt) {
      await RefreshToken.deleteMany({ family: row.family });
      return res.status(401).json({ error: 'Please sign in' });
    }

    // The account must still exist (this also picks up a role change)
    const user = await User.findById(row.user);
    if (!user) {
      await RefreshToken.deleteMany({ family: row.family });
      return res.status(401).json({ error: 'Please sign in' });
    }

    // Mark it used in ONE step, so two refreshes at the same instant can't both win
    const claimed = await RefreshToken.findOneAndUpdate({ tokenHash, usedAt: null }, { usedAt: new Date() });
    if (!claimed) return res.status(401).json({ error: 'Please sign in' });

    // A new pair, in the same family (the old token is now dead)
    return res.status(200).json(await issueSession(user, row.family));
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- forgot username / password ---------- */

// The same answer whether or not the email has an account, so nobody can
// use this to find out who is registered
const FORGOT_ANSWER = { message: 'If that email has an account, we sent it a code. It works for 15 minutes.' };

// Sends a 6-digit code AND the username to the account's email
router.post('/forgot', async (req, res) => {
  const { email } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_SHAPE.test(email.trim())) {
    return res.status(400).json({ error: 'Enter the email address of your account' });
  }
  if (!mailIsConfigured()) return res.status(503).json({ error: 'Email isn\'t set up on this server yet' });
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (user) {
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      // A Google-only account has no password to reset: just remind the username
      const googleOnly = !user.password;
      if (!googleOnly) {
        // Replace any code still waiting for this person
        await PasswordReset.findOneAndUpdate(
          { user: user._id },
          { codeHash: hashToken(code), attempts: 0, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
          { upsert: true },
        );
      }
      try {
        await sendMail({
          to: user.email,
          subject: 'Your WUBRG\'r sign-in details',
          text: `Your WUBRG'r username is: ${user.username}\n\n`
            + (googleOnly
              ? 'This account signs in with Google, so there is no password to reset.\n'
              : `Your password reset code is: ${code}\nIt works for 15 minutes. If you didn't ask for it, ignore this email.\n`),
        });
      } catch (err) {
        console.error('Could not send the reset email:', err.message);
        return res.status(503).json({ error: 'Could not send the email. Try again in a moment.' });
      }
    }
    return res.status(200).json(FORGOT_ANSWER);
  } catch (err) {
    return handleDbError(err, res);
  }
});

// Checks the code and sets the new password. Every login of the account
// is ended, so anyone who had the old password is signed out.
router.post('/reset', async (req, res) => {
  const { email, code, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof code !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email, code and new password are required' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ error: 'Password must be at most 72 bytes long' });
  const WRONG = { error: 'That code is wrong or has run out. Ask for a new one.' };
  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    const row = user ? await PasswordReset.findOne({ user: user._id }) : null;
    if (!row || row.expiresAt <= new Date()) return res.status(400).json(WRONG);
    if (row.codeHash !== hashToken(code.trim())) {
      // A wrong guess. After 5 the code is thrown away.
      row.attempts += 1;
      if (row.attempts >= 5) await row.deleteOne(); else await row.save();
      return res.status(400).json(WRONG);
    }
    user.password = password;   // scrambled by the model when saved
    await user.save();
    await row.deleteOne();
    await RefreshToken.deleteMany({ user: user._id });
    return res.status(200).json({ message: 'Password changed. You can sign in now.' });
  } catch (err) {
    return handleDbError(err, res);
  }
});

/* ---------- signing out ---------- */

// Ends this login (its whole family). Always answers 204, so the answer
// reveals nothing about whether the token was real.
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (typeof refreshToken === 'string' && refreshToken !== '') {
      const row = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
      if (row) await RefreshToken.deleteMany({ family: row.family });
    }
  } catch (err) {
    console.error(err);
  }
  return res.status(204).end();
});

// Ends every login of this account (every phone, every browser)
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    await RefreshToken.deleteMany({ user: req.user.sub });
    return res.status(204).end();
  } catch (err) {
    return handleDbError(err, res);
  }
});

export default router;
