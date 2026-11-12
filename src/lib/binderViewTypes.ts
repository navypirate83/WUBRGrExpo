/* =====================================================================
   THE THREE WAYS TO LOOK AT A BINDER
   - "list":   one line per card (picture, name, set, copies, price)
   - "grid":   card pictures side by side
   - "binder": the pages of pockets, like a real binder
   Just the names and the check, kept apart so settings.ts and
   binderView.ts can both use them. Binder is what you get to start with.
   Plain TypeScript with no React in it.
   ===================================================================== */

export type BinderViewMode = 'list' | 'grid' | 'binder';
export const DEFAULT_BINDER_VIEW: BinderViewMode = 'binder';

// Keep only a real view name (anything else becomes the default)
export function cleanBinderView(value: unknown): BinderViewMode {
  return value === 'list' || value === 'grid' || value === 'binder' ? value : DEFAULT_BINDER_VIEW;
}

// A card LIST (not a binder) can be shown as a list or a grid, but has no
// pockets, so no Binder view. It starts as the list.
export type ListViewMode = 'list' | 'grid';
export const DEFAULT_LIST_VIEW: ListViewMode = 'list';
export function cleanListView(value: unknown): ListViewMode {
  return value === 'grid' ? 'grid' : DEFAULT_LIST_VIEW;
}
