/* =====================================================================
   HOW A BINDER IS SHOWN (List, Grid or Binder) AND HOW IT IS SORTED
   An opened binder can be looked at three ways: a list, a grid of card
   pictures, or its pages of pockets (see binderViewTypes.ts). The choice
   is remembered separately for a narrow window (a phone) and a wide one
   (a computer or tablet), and starts as the Binder view. The sort of
   the list and grid (see binderSort.ts) is one choice for both.
   These aren't on the Settings page: tapping the switch inside a binder
   changes them. But they ARE settings underneath, so they're saved with
   the account (or Google Drive) and follow you to your other devices
   (see settings.ts).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { changeSettings, onSettingsChange, savedBinderSort, savedBinderView } from './settings';
import { currentSizeClass } from './pageLayout';
import type { BinderViewMode } from './binderViewTypes';
import type { BinderSort } from './binderSort';

// The view for this window's size (narrow or wide)
export function binderViewMode(): BinderViewMode {
  return savedBinderView(currentSizeClass() === 'phone');
}

// The sort chosen
export function binderSort(): BinderSort {
  return savedBinderSort();
}

// Choose a view for this window's size, or a sort. It takes effect at once;
// if the account can't be reached the choice is kept on this device and
// sent the next time the app syncs (so a failure is nothing to tell anyone).
export function setBinderViewMode(mode: BinderViewMode): void {
  changeSettings(currentSizeClass() === 'phone' ? { phoneView: mode } : { wideView: mode }).catch(() => { /* kept on this device */ });
}
export function setBinderSort(sort: BinderSort): void {
  changeSettings({ binderSort: sort }).catch(() => { /* kept on this device */ });
}

// Ask to be told when either choice changes. Returns the function that
// stops listening. (Used with React's useSyncExternalStore.)
export const onBinderViewChange = onSettingsChange;
