/* =====================================================================
   HOW A BINDER IS SHOWN (List, Grid or Binder) AND HOW IT IS SORTED
   An opened binder can be looked at three ways: a list, a grid of card
   pictures, or its pages of pockets (see binderViewTypes.ts). The choice
   is remembered separately for a narrow window (a phone) and a wide one
   (a computer or tablet), and starts as the Binder view. The sort of
   the list and grid (see binderSort.ts) is one choice for both.
   The Grid view can also be zoomed in and out on the website (how big
   each card picture is). That's remembered on this device only.
   These aren't on the Settings page: tapping the switch inside a binder
   changes them. But they ARE settings underneath, so they're saved with
   the account (or Google Drive) and follow you to your other devices
   (see settings.ts).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { changeSettings, onSettingsChange, savedBinderSort, savedBinderView } from './settings';
import { storageGet, storageSet } from './storage';
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

/* ---------------------------------------------------------------------
   THE GRID'S ZOOM
   How wide each card picture is at least, in points, at each zoom step
   (as many pictures fit across as the room allows). The step is kept on
   this device.
   --------------------------------------------------------------------- */
export const GRID_ZOOM_WIDTHS = [64, 80, 100, 130, 170, 220, 300];
const DEFAULT_GRID_ZOOM = 2;
const GRID_ZOOM_KEY = 'binderGridZoom';
const zoomListeners = new Set<() => void>();

// The zoom step now (the middle-ish default if nothing valid was saved)
export function binderGridZoom(): number {
  const text = storageGet(GRID_ZOOM_KEY);
  const saved = text === null ? NaN : Number(text);   // nothing saved yet: not a number, so the default
  return Number.isInteger(saved) && saved >= 0 && saved < GRID_ZOOM_WIDTHS.length ? saved : DEFAULT_GRID_ZOOM;
}

// Zoom in (one step bigger pictures) or out (one step smaller), and stop at the ends
export function zoomBinderGrid(direction: 1 | -1): void {
  const next = Math.min(GRID_ZOOM_WIDTHS.length - 1, Math.max(0, binderGridZoom() + direction));
  storageSet(GRID_ZOOM_KEY, String(next));
  zoomListeners.forEach((listener) => listener());
}

// Ask to be told when the zoom changes (used with useSyncExternalStore)
export function onGridZoomChange(listener: () => void): () => void {
  zoomListeners.add(listener);
  return () => { zoomListeners.delete(listener); };
}

// Ask to be told when either choice changes. Returns the function that
// stops listening. (Used with React's useSyncExternalStore.)
export const onBinderViewChange = onSettingsChange;
