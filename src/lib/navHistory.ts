/* =====================================================================
   THE TRAIL OF PAGES YOU'VE BEEN TO (for the back arrow)
   The back arrow in the header should work like a browser's Back
   button: it takes you to the page you were just on, and again, and
   again, back to the page you first opened the app on. The app's
   screens are in several separate stacks (each tab has its own), and
   none of them can see pages in the others, so they can't do that
   alone. This keeps ONE list of every page you visit, in order:
     - recordVisit: called (from the app's outermost frame, see
       app/_layout.tsx) every time the page changes, however you got
       there: a tab, the side menu, a button, a link
     - canGoBackInApp: is there an earlier page? (The arrow is grayed
       out when not: you're on the first page you opened.)
     - goBackInApp: go to the earlier page, and forget the one you left
   A page is remembered by its whole address, including what's after the
   "?" (which card the Card Finder shows, which page a binder is open
   at), so going back puts you exactly where you were.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { router } from 'expo-router';

// The most pages remembered (the oldest are forgotten after that)
const MAX_PAGES = 100;

// Pages you only pass through. They're replaced by the next page instead
// of being kept, so after logging in, Back goes to the page you were on
// before, not back to the log-in form.
const PASSING_THROUGH = ['/login'];

// The pages visited, oldest first. The last one is the page you're on.
let pages: string[] = [];

// Set while the back arrow is moving you, to the page it's moving you to,
// so arriving there isn't added to the trail as a new visit
let returningTo: string | null = null;

// Who to tell when the trail changes (the header redraws its arrow)
const listeners = new Set<() => void>();
export function onHistoryChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function changed(): void {
  for (const listener of listeners) listener();
}

// The part of an address before any "?"
function pathOf(href: string): string {
  const mark = href.indexOf('?');
  return mark === -1 ? href : href.slice(0, mark);
}

// A page was arrived at (by any means)
export function recordVisit(href: string): void {
  // Arriving where the back arrow was taking us: the trail already ends
  // here (the page we left was taken off it), so nothing to add
  if (returningTo !== null) {
    const wanted = returningTo;
    returningTo = null;
    if (href !== wanted) {
      // We landed somewhere else (a redirect): the trail ends there
      pages[pages.length - 1] = href;
      changed();
    }
    return;
  }
  const last = pages[pages.length - 1];
  if (last === href) return;
  // Replace a page that was only passed through, otherwise add to the trail
  if (last !== undefined && PASSING_THROUGH.includes(pathOf(last))) pages[pages.length - 1] = href;
  else pages.push(href);
  if (pages.length > MAX_PAGES) pages = pages.slice(pages.length - MAX_PAGES);
  changed();
}

// Is there a page before this one?
export function canGoBackInApp(): boolean {
  return pages.length > 1;
}

// Go to the page before this one (does nothing on the first page)
export function goBackInApp(): void {
  if (pages.length < 2) return;
  pages.pop();
  const target = pages[pages.length - 1];
  returningTo = target;
  // If for some reason we never arrive (nothing changed), don't let this
  // swallow the next real visit
  setTimeout(() => { if (returningTo === target) returningTo = null; }, 1500);
  changed();
  router.navigate(target as never);
}

// The address to remember for a page: its path, plus its "?" parts,
// leaving out
//  - values that are already in the path (a binder's id appears in
//    "/binders/abc" and as the "id" setting: it would be written twice)
//  - "message": the note the Home page shows once ("You're logged out"),
//    which shouldn't come back every time you return to Home
export function hrefFor(pathname: string, params: Record<string, string | string[] | undefined>): string {
  const inPath = new Set(pathname.split('/').map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  }));
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value === undefined || value === '' || key === 'message' || inPath.has(value)) continue;
    query.set(key, value);
  }
  const text = query.toString();
  return text ? `${pathname}?${text}` : pathname;
}
