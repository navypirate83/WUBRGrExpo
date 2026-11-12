/* =====================================================================
   THE SITE'S SETTINGS
   The choices on the Settings page:
   - theme: dark, light, or "system" (follow the device's own setting)
   - hiddenFormats: the formats NOT to show in the Search page's Format
     Legality box (the codes, like "pauper"). It lists the hidden ones,
     rather than the shown ones, so a new format Scryfall adds later
     shows up without anyone having to tick it.
   - priceStore: which store's prices to show in the binders (TCGplayer,
     Card Kingdom or Cardmarket; see prices.ts)
   - phoneView and wideView: how an opened binder is shown (list, grid or
     the binder's pockets) on a narrow window and on a wide one, and
     binderSort: how the list and grid are sorted (see binderView.ts)
   - phoneLayout and wideLayout: pockets across and down each binder page
     on a narrow window (a phone) and on a wide one (see pageLayout.ts).
     Changing the one in use moves every binder's cards to match.
   - accountLayout: not a choice on the Settings page. It's the layout the
     account's cards are stored in on the server, so devices using
     different layouts still agree where each card is (see serverSync.ts).
     The server calls it "pageLayout".
   To add a new setting:
     1. add it to the Settings type and DEFAULT_SETTINGS below
     2. read it in currentSettings (from this device) and fromFile (from
        Drive), checking it's a sensible value
     3. keep it on this device in applySettings (and put it into effect
        there, if it changes how the page looks)
     4. add its control to the Settings page (pages/settings)
   Where they're saved:
   - always on this device (so the page is right from the first moment)
   - logged in to the WUBRG'r server: also on the server, with the account
     (GET/PUT /settings), so they follow you to every phone and computer.
     While logged in, the server is used instead of Google Drive. A change
     made while the server can't be reached is marked "needs saving" and
     sent the next time the app syncs.
   - signed in with Google: also in "WUBRGr settings.json" in the
     "MTG Card Binder" folder in Google Drive, so they follow you to other
     computers and phones. A change made while the Google sign-in has run
     out is marked "needs saving" and sent the next time you're signed in.
   - using the site locally: on this device only.
   Pages that use a setting follow changes with hooks/useSettings.ts.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { currentThemeChoice, setThemeChoice, type ThemeChoice } from './theme';
import { storageGet, storageRemove, storageSet } from './storage';
import { isLocalMode, relayoutAllBinders } from './binderStorage';
import { isSignedIn, readSettingsFile, writeSettingsFile } from './googleDrive';
import { apiRequest } from './api';
import { DEFAULT_PRICE_STORE, cleanPriceStore, type PriceStore } from './prices';
import { DEFAULT_BINDER_VIEW, cleanBinderView, type BinderViewMode } from './binderViewTypes';
import { DEFAULT_BINDER_SORT, cleanBinderSort, type BinderSort } from './binderSort';
import { isServerSignedIn, SETTINGS_UNSENT_KEY } from './session';
import {
  DEFAULT_LAYOUT, cleanLayout, currentSizeClass, layoutFor, pageLayout, pocketsPerPage,
  sameLayout, savedLayouts, saveLayouts, setSizeClass, sizeClassFor, type PageLayout,
} from './pageLayout';

// Every setting, and what each one starts as. ("theme" is the choice:
// dark, light, or "system" to follow the device's own setting.)
export type Settings = {
  theme: ThemeChoice;
  hiddenFormats: string[];
  priceStore: PriceStore;
  phoneView: BinderViewMode;
  wideView: BinderViewMode;
  binderSort: BinderSort;
  phoneLayout: PageLayout;
  wideLayout: PageLayout;
  accountLayout: PageLayout;
};
const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  hiddenFormats: [],
  priceStore: DEFAULT_PRICE_STORE,
  phoneView: DEFAULT_BINDER_VIEW,
  wideView: DEFAULT_BINDER_VIEW,
  binderSort: DEFAULT_BINDER_SORT,
  phoneLayout: DEFAULT_LAYOUT,
  wideLayout: DEFAULT_LAYOUT,
  accountLayout: DEFAULT_LAYOUT,
};

// A label written into the settings file, so it's clear what it is, and
// a version number in case its layout changes later
const SETTINGS_APP = 'wubrgr-settings';
const SETTINGS_VERSION = 1;

// Where things are kept on this device: the "needs saving to Drive"
// marker, and the hidden formats (the theme has its own "theme")
const DIRTY_KEY = 'settingsDirty';
// The same kind of marker for the WUBRG'r server (signing out clears it)
const SERVER_DIRTY_KEY = SETTINGS_UNSENT_KEY;
const HIDDEN_FORMATS_KEY = 'hiddenFormats';
const PRICE_STORE_KEY = 'priceStore';
const PHONE_VIEW_KEY = 'phoneBinderView';
const WIDE_VIEW_KEY = 'wideBinderView';
const BINDER_SORT_KEY = 'binderSort';

/* ---------------------------------------------------------------------
   TELLING PAGES ABOUT CHANGES
   --------------------------------------------------------------------- */

// A number that goes up with every change, and the functions to call
let version = 0;
const listeners = new Set<() => void>();
export function onSettingsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function settingsVersion(): number {
  return version;
}
function settingsChanged(): void {
  version++;
  for (const listener of listeners) listener();
}

/* ---------------------------------------------------------------------
   ON THIS DEVICE
   --------------------------------------------------------------------- */

// Keep only a list of short codes (anything else counts as "none hidden")
function cleanCodes(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length < 40) : [];
}

// The settings as they are now on this device
export function currentSettings(): Settings {
  let hidden: unknown = [];
  try { hidden = JSON.parse(storageGet(HIDDEN_FORMATS_KEY) ?? '[]'); } catch { /* unreadable: none hidden */ }
  const layouts = savedLayouts();
  return {
    ...DEFAULT_SETTINGS,
    theme: currentThemeChoice(),
    hiddenFormats: cleanCodes(hidden),
    priceStore: cleanPriceStore(storageGet(PRICE_STORE_KEY)),
    phoneView: cleanBinderView(storageGet(PHONE_VIEW_KEY)),
    wideView: cleanBinderView(storageGet(WIDE_VIEW_KEY)),
    binderSort: cleanBinderSort(storageGet(BINDER_SORT_KEY)),
    phoneLayout: layouts.phone,
    wideLayout: layouts.wide,
    accountLayout: layouts.account,
  };
}

// Just the view an opened binder is shown in (for a narrow window or a
// wide one) and its sort, read straight from this device (quicker than
// reading every setting)
export function savedBinderView(narrow: boolean): BinderViewMode {
  return cleanBinderView(storageGet(narrow ? PHONE_VIEW_KEY : WIDE_VIEW_KEY));
}
export function savedBinderSort(): BinderSort {
  return cleanBinderSort(storageGet(BINDER_SORT_KEY));
}

// Put settings into effect on this device, remember them here, and tell
// the pages that use them. If the layout in use (the phone's or the wide
// screen's, whichever the window calls for) is now different, every
// binder's cards on this device first move to match, then it takes effect
// (binder pages redraw). Changing the layout NOT in use moves nothing:
// it's just remembered for when the window changes size.
function applySettings(settings: Settings): void {
  if (settings.theme !== currentThemeChoice()) setThemeChoice(settings.theme);
  storageSet(HIDDEN_FORMATS_KEY, JSON.stringify(settings.hiddenFormats));
  storageSet(PRICE_STORE_KEY, settings.priceStore);
  storageSet(PHONE_VIEW_KEY, settings.phoneView);
  storageSet(WIDE_VIEW_KEY, settings.wideView);
  storageSet(BINDER_SORT_KEY, settings.binderSort);
  const nowShowing = currentSizeClass() === 'phone' ? settings.phoneLayout : settings.wideLayout;
  if (!sameLayout(nowShowing, pageLayout())) {
    relayoutAllBinders(pocketsPerPage(), pocketsPerPage(nowShowing));
  }
  saveLayouts({ phone: settings.phoneLayout, wide: settings.wideLayout, account: settings.accountLayout });
  settingsChanged();
}

// The window changed size (called from the app's outermost frame). If it
// crossed between narrow and wide, the other layout takes over: every
// binder's cards on this device move to match first, then binder pages
// redraw. Nothing is sent anywhere: the account stores cards in its own
// layout, so a change of window is never a change to the binder.
export function followScreenSize(width: number): void {
  const next = sizeClassFor(width);
  if (next === currentSizeClass()) return;
  const from = pageLayout();
  const to = layoutFor(next);
  if (!sameLayout(from, to)) relayoutAllBinders(pocketsPerPage(from), pocketsPerPage(to));
  setSizeClass(next);
}

/* ---------------------------------------------------------------------
   IN GOOGLE DRIVE
   --------------------------------------------------------------------- */

// Pick the settings out of what was saved (a Drive settings file, or the
// server's answer), keeping only sensible values (anything missing or odd
// keeps its current value).
// Layouts: an older save has just one "pageLayout". From the server that
// is the layout the account stores cards in, and it's also what both the
// phone and wide layouts were, so both start as it. From a Drive file it
// was the one layout in use, so both start as it, and the account layout
// is left alone (Drive files don't use it).
function fromFile(data: Record<string, unknown>, from: 'server' | 'drive'): Settings {
  const settings = currentSettings();
  if (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system') settings.theme = data.theme;
  if (Array.isArray(data.hiddenFormats)) settings.hiddenFormats = cleanCodes(data.hiddenFormats);
  // An older save has no price store: keep the one chosen here
  if (data.priceStore !== undefined) settings.priceStore = cleanPriceStore(data.priceStore);
  // Likewise the binder views and sort
  if (data.phoneView !== undefined) settings.phoneView = cleanBinderView(data.phoneView);
  if (data.wideView !== undefined) settings.wideView = cleanBinderView(data.wideView);
  if (data.binderSort !== undefined) settings.binderSort = cleanBinderSort(data.binderSort);
  const isObject = (v: unknown): v is object => !!v && typeof v === 'object';
  if (isObject(data.pageLayout)) {
    const single = cleanLayout(data.pageLayout);
    settings.phoneLayout = single;
    settings.wideLayout = single;
    if (from === 'server') settings.accountLayout = single;
  }
  if (isObject(data.phoneLayout)) settings.phoneLayout = cleanLayout(data.phoneLayout);
  if (isObject(data.wideLayout)) settings.wideLayout = cleanLayout(data.wideLayout);
  return settings;
}

// What's written into the settings file. "pageLayout" is also written (as
// the wide layout) so an older copy of the app still finds a layout.
// The account layout isn't: it belongs to the server.
function toFile(settings: Settings): Record<string, unknown> {
  const { accountLayout: _account, ...shared } = settings;
  return {
    app: SETTINGS_APP, version: SETTINGS_VERSION, ...shared, pageLayout: settings.wideLayout, savedAt: new Date().toISOString(),
  };
}

// Saves to Drive happen one at a time, in order ("chain" is the last one
// waiting), each sending the settings as they are when its turn comes.
// So quick changes (like ticking several boxes) can't overlap, and the
// settings file is never made twice.
let chain: Promise<void> = Promise.resolve();
function saveToDrive(): Promise<void> {
  const run = chain.then(async () => {
    await writeSettingsFile(toFile(currentSettings()));
    storageRemove(DIRTY_KEY);
  });
  chain = run.catch(() => { /* the caller hears about the problem */ });
  return run;
}

/* ---------------------------------------------------------------------
   ON THE WUBRG'R SERVER
   --------------------------------------------------------------------- */

// What the server sends back: the saved settings (null if none yet)
type ServerSettings = {
  settings: { theme?: unknown; hiddenFormats?: unknown; priceStore?: unknown; phoneView?: unknown; wideView?: unknown; binderSort?: unknown; pageLayout?: unknown; phoneLayout?: unknown; wideLayout?: unknown } | null;
};

// Send the settings as they are now to the account on the server
async function saveToServer(): Promise<void> {
  const { theme, hiddenFormats, priceStore, phoneView, wideView, binderSort, phoneLayout, wideLayout, accountLayout: stored } = currentSettings();
  await apiRequest('/settings', {
    method: 'PUT',
    body: { theme, hiddenFormats, priceStore, phoneView, wideView, binderSort, pageLayout: stored, phoneLayout, wideLayout },
  });
  storageRemove(SERVER_DIRTY_KEY);
}

// Where a change was saved, for the Settings page to say
export type SavedWhere = 'server' | 'drive' | 'device' | 'not-yet';

// Change some settings: put them into effect straight away, then save
// them to Google Drive (when signed in). Resolves with where they were
// saved; if Drive couldn't be reached, they're kept on this device and
// marked "needs saving" (and the error is passed on).
export async function changeSettings(changes: Partial<Settings>): Promise<SavedWhere> {
  applySettings({ ...currentSettings(), ...changes });
  // Logged in to the server: the account keeps them
  if (isServerSignedIn()) {
    storageSet(SERVER_DIRTY_KEY, 'yes');
    await saveToServer();
    return 'server';
  }
  if (isLocalMode()) return 'device';
  storageSet(DIRTY_KEY, 'yes');
  if (!isSignedIn()) return 'not-yet';
  await saveToDrive();
  return 'drive';
}

// Bring the settings up to date with the account on the server (when
// logged in), otherwise with Google Drive (after signing in, or when a
// page opens while signed in).
// On the server:
// - a change on this device that hasn't reached the server yet: SEND it
// - the account has no settings yet (first login): SEND this device's
// - otherwise: FETCH them (they may have been changed on another device)
// With Google Drive:
// - a change on this device that hasn't reached Drive yet: SEND it
// - otherwise: FETCH the settings from Drive (they may have been changed
//   on another computer) and put them into effect here
// (Not signed in, or used locally: nothing to do.)
export async function syncSettings(): Promise<void> {
  if (isServerSignedIn()) {
    if (storageGet(SERVER_DIRTY_KEY)) {
      await saveToServer();
      return;
    }
    const saved = (await apiRequest<ServerSettings>('/settings')).settings;
    if (!saved) {
      await saveToServer();
      return;
    }
    applySettings(fromFile(saved as Record<string, unknown>, 'server'));
    return;
  }
  if (isLocalMode() || !isSignedIn()) return;
  if (storageGet(DIRTY_KEY)) {
    await saveToDrive();
    return;
  }
  const data = await readSettingsFile();
  if (data) applySettings(fromFile(data, 'drive'));
}
