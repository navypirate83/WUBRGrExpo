/* =====================================================================
   WHETHER YOU COLLAPSED THE SIDE MENU
   On a wide window the side menu normally shows in full (icons and
   words). A button at the bottom of it collapses it to the slim icon
   strip, and another expands it again. This remembers your choice on
   this device, so it's the same next time.
   (The slim menu that small windows get on their own isn't affected:
   this only shrinks a menu that would have been the full one.)
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageSet } from './storage';

// The name the choice is saved under
const KEY = 'sideMenuCollapsed';

// Screens listening for a change (the menu and the page beside it)
const listeners = new Set<() => void>();

// Has the menu been collapsed? (Nothing saved yet means no.)
export function isMenuCollapsed(): boolean {
  return storageGet(KEY) === '1';
}

// Collapse or expand the menu, remember it, and tell the listening screens
export function setMenuCollapsed(collapsed: boolean): void {
  storageSet(KEY, collapsed ? '1' : '0');
  listeners.forEach((listener) => listener());
}

// Ask to be told when the choice changes. Returns the function that stops
// listening. (Used with React's useSyncExternalStore.)
export function onMenuCollapsedChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
