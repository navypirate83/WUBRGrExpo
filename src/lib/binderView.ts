/* =====================================================================
   HOW A BINDER IS SHOWN (List, Grid or Binder) AND HOW IT IS SORTED
   An opened binder can be looked at three ways:
   - "list":   one line per card (picture, name, set, copies)
   - "grid":   card pictures side by side
   - "binder": the pages of pockets, like a real binder
   This remembers the choice on this device (the same for every binder),
   so it's the same next time. List is what you get to start with.
   The list and the grid can be sorted by name or by newest added.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageSet } from './storage';

export type BinderViewMode = 'list' | 'grid' | 'binder';
export type BinderSort = 'name' | 'added';

// The names the choices are saved under
const VIEW_KEY = 'binderViewMode';
const SORT_KEY = 'binderViewSort';

// Screens listening for a change (the switch and the cards under it)
const listeners = new Set<() => void>();
const tellListeners = () => listeners.forEach((listener) => listener());

// The view chosen (List if nothing valid was saved)
export function binderViewMode(): BinderViewMode {
  const saved = storageGet(VIEW_KEY);
  return saved === 'grid' || saved === 'binder' ? saved : 'list';
}

// The sort chosen (by name if nothing valid was saved)
export function binderSort(): BinderSort {
  return storageGet(SORT_KEY) === 'added' ? 'added' : 'name';
}

// Choose a view or a sort, remember it, and tell the listening screens
export function setBinderViewMode(mode: BinderViewMode): void {
  storageSet(VIEW_KEY, mode);
  tellListeners();
}
export function setBinderSort(sort: BinderSort): void {
  storageSet(SORT_KEY, sort);
  tellListeners();
}

// Ask to be told when either choice changes. Returns the function that
// stops listening. (Used with React's useSyncExternalStore.)
export function onBinderViewChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
