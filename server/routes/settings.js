/* =====================================================================
   APP SETTINGS ROUTES (/settings)
   Mounted behind requireAuth in app.js, so every request has a signed-in
   person in req.user. The settings belong to the person's own account and
   the person is never taken from the request, so nobody can read or
   change anyone else's.
   - GET /settings   the saved settings (or null if none were ever saved)
   - PUT /settings   save the settings (replaces what was saved; a save
                     from an older app with no price store keeps the one
                     already saved)

   THE THREE PAGE LAYOUTS (pockets across and down a binder page):
   - phoneLayout and wideLayout: what the app shows on a narrow window
     (a phone) and on a wide one. Each device picks by its window's size.
   - pageLayout: the layout the account's CARDS are stored in (each card's
     page and pocket numbers count in it). The app converts to and from
     it, so a phone and a computer using different layouts still agree on
     where every card is. Once an account has one it is NOT changed by the
     app (a device with out-of-date settings could otherwise change it
     without the cards moving with it, and scramble every binder).
     An older copy of the app sends only pageLayout (no phone or wide
     layout) and means "the one layout in use, and the one cards are
     stored in": that is accepted as before.
   ===================================================================== */

import { Router } from 'express';
import User from '../models/User.js';
import { handleDbError } from '../middleware/errorHandler.js';

const router = Router();

const THEMES = ['system', 'light', 'dark'];
// The stores whose prices the app can show in the binders
const PRICE_STORES = ['tcgplayer', 'cardkingdom', 'cardmarket'];
const DEFAULT_PRICE_STORE = 'tcgplayer';

// A page layout count must be a whole number from 1 to 6
const isCount = (n) => Number.isInteger(n) && n >= 1 && n <= 6;

// Is this a layout: whole numbers across and down, each 1 to 6?
const isLayout = (l) => !!l && typeof l === 'object' && isCount(l.across) && isCount(l.down);
const pick = (l) => ({ across: l.across, down: l.down });

// Check what the app sent. Returns { settings } with only the known fields
// (extras are ignored), or { error } saying what is wrong. "twoLayouts" is
// true when it came from an app that has the phone and wide layouts.
function checkSettings(body) {
  const { theme, hiddenFormats, priceStore, pageLayout, phoneLayout, wideLayout } = body ?? {};
  if (!THEMES.includes(theme)) return { error: 'Theme must be system, light or dark' };
  if (!Array.isArray(hiddenFormats) || hiddenFormats.length > 100
    || !hiddenFormats.every((f) => typeof f === 'string' && f.length > 0 && f.length < 40)) {
    return { error: 'Hidden formats must be a list of short names' };
  }
  // The price store is optional (an older app doesn't send one)
  if (priceStore !== undefined && !PRICE_STORES.includes(priceStore)) {
    return { error: 'Price store must be tcgplayer, cardkingdom or cardmarket' };
  }
  if (!isLayout(pageLayout)) {
    return { error: 'Page layout must be whole numbers from 1 to 6 across and down' };
  }
  // The phone and wide layouts come together or not at all
  if ((phoneLayout === undefined) !== (wideLayout === undefined)) {
    return { error: 'Send both the phone layout and the wide layout, or neither' };
  }
  if (phoneLayout !== undefined && (!isLayout(phoneLayout) || !isLayout(wideLayout))) {
    return { error: 'The phone and wide layouts must be whole numbers from 1 to 6 across and down' };
  }
  const settings = { theme, hiddenFormats, pageLayout: pick(pageLayout) };
  if (priceStore !== undefined) settings.priceStore = priceStore;
  if (phoneLayout !== undefined) {
    settings.phoneLayout = pick(phoneLayout);
    settings.wideLayout = pick(wideLayout);
  }
  return { settings, twoLayouts: phoneLayout !== undefined };
}

// What is sent back: the settings and when they were saved
function answer(user) {
  const saved = user?.settings;
  if (!user?.settingsSavedAt || !saved?.theme) return { settings: null, savedAt: null };
  const stored = { across: saved.pageLayout?.across ?? 4, down: saved.pageLayout?.down ?? 4 };
  return {
    settings: {
      theme: saved.theme,
      hiddenFormats: saved.hiddenFormats ?? [],
      priceStore: saved.priceStore ?? DEFAULT_PRICE_STORE,
      pageLayout: stored,
      // Settings saved before there were two layouts: both are the one layout
      phoneLayout: saved.phoneLayout?.across ? pick(saved.phoneLayout) : stored,
      wideLayout: saved.wideLayout?.across ? pick(saved.wideLayout) : stored,
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
    // A newer app never changes the layout the cards are stored in once
    // the account has one (see the top of this file): keep the saved one
    // An older app sends no price store: keep the one already saved
    if (checked.twoLayouts || checked.settings.priceStore === undefined) {
      const before = await User.findById(req.user.id).select('settings settingsSavedAt').lean();
      const keep = before?.settingsSavedAt && before.settings?.pageLayout?.across && before.settings?.pageLayout?.down;
      if (checked.twoLayouts && keep) checked.settings.pageLayout = pick(before.settings.pageLayout);
      if (checked.settings.priceStore === undefined && before?.settings?.priceStore) {
        checked.settings.priceStore = before.settings.priceStore;
      }
    }
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
