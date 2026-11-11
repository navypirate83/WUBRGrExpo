/* =====================================================================
   APP SETTINGS ROUTES (/settings)
   Mounted behind requireAuth in app.js, so every request has a signed-in
   person in req.user. The settings belong to the person's own account and
   the person is never taken from the request, so nobody can read or
   change anyone else's.
   - GET /settings   the saved settings (or null if none were ever saved)
   - PUT /settings   save the settings (replaces what was saved)
   ===================================================================== */

import { Router } from 'express';
import User from '../models/User.js';
import { handleDbError } from '../middleware/errorHandler.js';

const router = Router();

const THEMES = ['system', 'light', 'dark'];

// A page layout count must be a whole number from 1 to 6
const isCount = (n) => Number.isInteger(n) && n >= 1 && n <= 6;

// Check what the app sent. Returns { settings } with only the known fields
// (extras are ignored), or { error } saying what is wrong.
function checkSettings(body) {
  const { theme, hiddenFormats, pageLayout } = body ?? {};
  if (!THEMES.includes(theme)) return { error: 'Theme must be system, light or dark' };
  if (!Array.isArray(hiddenFormats) || hiddenFormats.length > 100
    || !hiddenFormats.every((f) => typeof f === 'string' && f.length > 0 && f.length < 40)) {
    return { error: 'Hidden formats must be a list of short names' };
  }
  if (!pageLayout || !isCount(pageLayout.across) || !isCount(pageLayout.down)) {
    return { error: 'Page layout must be whole numbers from 1 to 6 across and down' };
  }
  return {
    settings: {
      theme,
      hiddenFormats,
      pageLayout: { across: pageLayout.across, down: pageLayout.down },
    },
  };
}

// What is sent back: the settings and when they were saved
function answer(user) {
  const saved = user?.settings;
  if (!user?.settingsSavedAt || !saved?.theme) return { settings: null, savedAt: null };
  return {
    settings: {
      theme: saved.theme,
      hiddenFormats: saved.hiddenFormats ?? [],
      pageLayout: { across: saved.pageLayout?.across ?? 4, down: saved.pageLayout?.down ?? 4 },
    },
    savedAt: user.settingsSavedAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('settings settingsSavedAt').lean();
    res.json(answer(user));
  } catch (err) {
    handleDbError(err, res);
  }
});

router.put('/', async (req, res) => {
  const checked = checkSettings(req.body);
  if (checked.error) return res.status(400).json({ error: checked.error });
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { settings: checked.settings, settingsSavedAt: new Date() } },
      { returnDocument: 'after', runValidators: true },
    ).select('settings settingsSavedAt').lean();
    res.json(answer(user));
  } catch (err) {
    handleDbError(err, res);
  }
});

export default router;
