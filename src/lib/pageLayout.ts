/* =====================================================================
   THE PAGE LAYOUT: how many pockets across and down each binder page has
   There are TWO layouts to choose from, on the Settings page (Binders →
   Page layout), each 1 to 6 pockets across and down (like 3 by 3 for
   9-pocket pages, or 3 by 5):
   - the PHONE layout, used when the window is narrower than 600 wide (a
     phone held upright, or the website in a narrow window)
   - the WIDE-SCREEN layout, used when the window is 600 wide or more
   Both start at 4 across by 4 down (16 pockets). Which one is showing
   follows the window's size, even while the app is open.
   They're kept on this device under "phoneLayout" and "wideLayout"
   (settings.ts also saves them to the account, or Google Drive). Changing
   the one in use (or crossing between narrow and wide) moves every
   binder's cards to match (see relayoutAllBinders in binderStorage.ts):
   each card keeps its place in the binder's order (pocket 1, 2, 3…
   counting page by page), so changing back puts every card exactly where
   it was.
   A THIRD layout, the "account layout", is never shown. It's the layout
   the account's cards are stored in on the server, so a phone and a
   computer using different layouts still agree on where each card is
   (see serverSync.ts, which converts between the two on the way).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Dimensions } from 'react-native';
import { storageGet, storageSet } from './storage';
import { SLIM_MENU_MIN_WIDTH } from './layoutSize';

// A layout: pockets across (columns) and down (rows) on each page
export type PageLayout = { across: number; down: number };

// The layout to start with (the same as a real 16-pocket page), and the
// fewest and most pockets each way
export const DEFAULT_LAYOUT: PageLayout = { across: 4, down: 4 };
export const LAYOUT_MIN = 1;
export const LAYOUT_MAX = 6;

// Where the layouts are kept on this device. "pageLayout" is where the one
// layout was kept before there were two: it's still read, once, so nobody's
// binders move when they update (both layouts start as that one).
const OLD_KEY = 'pageLayout';
const PHONE_KEY = 'phoneLayout';
const WIDE_KEY = 'wideLayout';
const ACCOUNT_KEY = 'accountLayout';

// One count made safe: a whole number from 1 to 6 (anything else: the default)
function cleanCount(value: unknown, fallback: number): number {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= LAYOUT_MIN && number <= LAYOUT_MAX ? number : fallback;
}

// Any layout made safe (from this device, a settings file or a .csv file)
export function cleanLayout(value: unknown): PageLayout {
  const layout = (value ?? {}) as Partial<PageLayout>;
  return { across: cleanCount(layout.across, DEFAULT_LAYOUT.across), down: cleanCount(layout.down, DEFAULT_LAYOUT.down) };
}

// A layout written as text, like "3x5" (across, then down), for .csv
// files, and read back from that text (null if it isn't one)
export function layoutToText(layout: PageLayout): string {
  return `${layout.across}x${layout.down}`;
}
export function layoutFromText(text: string): PageLayout | null {
  const match = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(text);
  return match ? cleanLayout({ across: match[1], down: match[2] }) : null;
}

/* ---------------------------------------------------------------------
   PHONE OR WIDE? (follows the window's size)
   --------------------------------------------------------------------- */

// Which of the two layouts goes with a window this wide. The cut-off is
// the same one the app uses to switch from the bottom tabs (narrow) to a
// side menu (wide), so "phone mode" means the same thing everywhere.
export type SizeClass = 'phone' | 'wide';
export function sizeClassFor(width: number): SizeClass {
  return width < SLIM_MENU_MIN_WIDTH ? 'phone' : 'wide';
}

// The size class now. It starts from the window's size when the app opens;
// settings.ts (followScreenSize) keeps it up to date when the window changes.
let sizeClass: SizeClass = sizeClassFor(Dimensions.get('window').width);
export function currentSizeClass(): SizeClass {
  return sizeClass;
}

/* ---------------------------------------------------------------------
   THE LAYOUTS
   --------------------------------------------------------------------- */

// All three layouts: the two to show, and the one the account stores cards in
export type Layouts = { phone: PageLayout; wide: PageLayout; account: PageLayout };

// One saved layout, or null if there isn't a usable one
function readSaved(key: string): PageLayout | null {
  try {
    const text = storageGet(key);
    return text ? cleanLayout(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

// The layouts now. They're read from storage once, then remembered here.
// Anything not saved yet starts as the old single layout (or 4 x 4).
let layouts: Layouts | null = null;
function allLayouts(): Layouts {
  if (!layouts) {
    const old = readSaved(OLD_KEY) ?? { ...DEFAULT_LAYOUT };
    layouts = {
      phone: readSaved(PHONE_KEY) ?? old,
      wide: readSaved(WIDE_KEY) ?? old,
      account: readSaved(ACCOUNT_KEY) ?? old,
    };
  }
  return layouts;
}
export function savedLayouts(): Layouts {
  return { ...allLayouts() };
}

// The layout for one size class
export function layoutFor(size: SizeClass): PageLayout {
  return allLayouts()[size];
}

// The layout showing now: the one for the window's size
export function pageLayout(): PageLayout {
  return layoutFor(sizeClass);
}

// The layout the account's cards are stored in (never shown)
export function accountLayout(): PageLayout {
  return allLayouts().account;
}

// How many pockets each page has with the layout now (or a given one)
export function pocketsPerPage(layout: PageLayout = pageLayout()): number {
  return layout.across * layout.down;
}

// Are two layouts the same?
export function sameLayout(a: PageLayout, b: PageLayout): boolean {
  return a.across === b.across && a.down === b.down;
}

// The functions to call when the layout changes (pages showing a binder
// redraw it), and a short text that changes with it (for React's
// useSyncExternalStore, which redraws when this changes)
const listeners = new Set<() => void>();
export function onLayoutChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function layoutKey(): string {
  return layoutToText(pageLayout());
}

// Keep new layouts on this device, and tell the pages. (Only call this
// after the binders' cards have been moved to match: settings.ts does both.)
export function saveLayouts(next: Layouts): void {
  layouts = { phone: cleanLayout(next.phone), wide: cleanLayout(next.wide), account: cleanLayout(next.account) };
  storageSet(PHONE_KEY, JSON.stringify(layouts.phone));
  storageSet(WIDE_KEY, JSON.stringify(layouts.wide));
  storageSet(ACCOUNT_KEY, JSON.stringify(layouts.account));
  for (const listener of listeners) listener();
}

// The window crossed between narrow and wide: switch to that size's
// layout and tell the pages. (Only call this after the binders' cards
// have been moved to match: settings.ts, followScreenSize, does both.)
export function setSizeClass(next: SizeClass): void {
  if (next === sizeClass) return;
  sizeClass = next;
  for (const listener of listeners) listener();
}
