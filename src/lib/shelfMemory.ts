/* =====================================================================
   WHERE YOU WERE IN THE SHELF
   The shelf has three sections: Binders, Lists and Decks. Each page you
   open inside it is remembered, so coming back puts you where you left
   off instead of at the top:
   - the Binders / Lists / Decks buttons (in the header on a phone, in the
     side menu on a wide screen) go to the last place in THAT section: if
     you were inside the Colorless binder, then went to Lists and back, the
     Binders button opens Colorless again (not the shelf of binders)
   - the Shelf button (the tab along the bottom, or "The Shelf" in the side
     menu) goes to the last place in the shelf at all, whichever section,
     so after a trip to Settings or the Card Finder you're back at it. The
     exception is the bottom tab on a phone while you're ALREADY inside a
     binder, list or deck: then it goes to that section's main page
     (shelfRootHref below)
   - an opened binder also remembers which page it was on
   A binder or list that has been deleted since is forgotten: its button
   goes to the section's first page instead.
   It's remembered while the app is open (not after it's closed).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { findBinder } from './binderStorage';
import { findList } from './listStorage';

export type ShelfSection = 'binders' | 'lists' | 'decks';

// Each section's first page
const FIRST_PAGE: Record<ShelfSection, string> = {
  binders: '/binders',
  lists: '/binders/lists',
  decks: '/binders/decks',
};

// The last place in each section, and which section was the last one in
const lastIn: Record<ShelfSection, string> = { ...FIRST_PAGE };
let lastSection: ShelfSection = 'binders';

// The page each binder was showing
const binderPages = new Map<string, number>();

// Which section an address is in, if it's in the shelf at all
function sectionOf(pathname: string): ShelfSection | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/binders') return 'binders';
  if (path === '/binders/lists' || /^\/binders\/list\/[^/]+$/.test(path)) return 'lists';
  if (path === '/binders/decks') return 'decks';
  if (/^\/binders\/[^/]+$/.test(path)) return 'binders';   // one binder
  return null;
}

// Note where the person is. Called with the address every time it changes;
// anything outside the shelf (Settings, the Card Finder...) is ignored.
export function rememberShelfPlace(pathname: string): void {
  const section = sectionOf(pathname);
  if (!section) return;
  lastIn[section] = pathname.replace(/\/+$/, '');
  lastSection = section;
}

// Is the remembered place still there? (A deleted binder or list isn't.)
function stillThere(href: string): boolean {
  const binder = /^\/binders\/([^/]+)$/.exec(href)?.[1];
  if (binder && !['lists', 'decks'].includes(binder)) return findBinder(binder) !== undefined;
  const list = /^\/binders\/list\/([^/]+)$/.exec(href)?.[1];
  if (list) return findList(list) !== undefined;
  return true;
}

// Where a section's button should go: the last place in it
export function sectionHref(section: ShelfSection): string {
  return stillThere(lastIn[section]) ? lastIn[section] : FIRST_PAGE[section];
}

// Where the Shelf button should go: the last place in the whole shelf
export function shelfHref(): string {
  return sectionHref(lastSection);
}

// If this address is inside the shelf, the main page of the section it's in
// (the shelf of binders, the lists page, or the decks page); otherwise
// null. The bottom Shelf tab on a phone uses it: pressed while you're inside
// a binder or list, it goes up to the main page; when you're already on the
// main page it stays there.
export function shelfRootHref(pathname: string): string | null {
  const section = sectionOf(pathname);
  return section ? FIRST_PAGE[section] : null;
}

// An opened binder's page number, remembered so it opens on the same page
export function rememberBinderPage(binderId: string, page: number): void {
  binderPages.set(binderId, page);
}
export function rememberedBinderPage(binderId: string): number | undefined {
  return binderPages.get(binderId);
}
