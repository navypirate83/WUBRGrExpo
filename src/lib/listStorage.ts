/* =====================================================================
   YOUR LISTS (this device's copy)
   Card lists, kept beside your binders on The Shelf tab: a want list,
   cards to trade, upgrades for a deck, and so on. Each list has a name
   and its cards, in the order they were added. A card in a list is saved
   like a card in a binder (its exact printing and picture), plus its
   casting cost and type line, which the list shows under its name.
   Lists are saved the same way as binders:
   - every change is saved on this device first (all the lists together,
     under "lists"), so nothing is lost if the internet drops
   - when signed in, each list is also a .csv file in Google Drive (see
     listCsv.ts and the list part of googleDrive.ts), and its id is that
     file's id. A changed list gets a "needs saving" marker (the time of
     the change) until Drive has the change.
   - used on this device only, the device's copy is the only one, and
     lists get "local-list-..." ids
   This file only works with this device's copy; googleDrive.ts does the
   Drive part.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageKeys, storageRemove, storageSet } from './storage';
import { samePrinting, type BinderCard } from './binderStorage';

// One card in a list: a binder card, plus its casting cost (like
// "{1}{U}{U}") and type line (like "Creature — Elf Druid")
export type ListCard = BinderCard & { manaCost: string; typeLine: string };

// One list: its id, its name, and its cards
export type CardList = { id: string; name: string; cards: ListCard[] };

// Where the lists are kept on this device, and the start of each list's
// "needs saving to Drive" marker
const LISTS_KEY = 'lists';
const DIRTY_KEY_PREFIX = 'listDirty:';

/* ---------------------------------------------------------------------
   READING AND SAVING
   --------------------------------------------------------------------- */

// Every list on this device, in order (an empty list if there are none,
// or if what's saved can't be read)
export function loadLists(): CardList[] {
  try {
    const saved = JSON.parse(storageGet(LISTS_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((l) => l && typeof l.id === 'string' && typeof l.name === 'string')
      .map((l) => ({ id: l.id, name: l.name, cards: Array.isArray(l.cards) ? l.cards : [] }));
  } catch {
    return [];
  }
}

// Keep every list on this device, just as given (no "needs saving"
// markers: used for lists that came from Drive). Returns false if the
// device wouldn't save.
export function saveLists(lists: CardList[]): boolean {
  return storageSet(LISTS_KEY, JSON.stringify(lists));
}

// One list, by its id (undefined if there's no such list)
export function findList(id: string): CardList | undefined {
  return loadLists().find((l) => l.id === id);
}

// Change one list on this device and mark it "needs saving to Drive".
// "change" gets the list and returns it changed. Returns false if there's
// no such list, or the device wouldn't save.
function changeList(id: string, change: (list: CardList) => CardList): boolean {
  const lists = loadLists();
  const index = lists.findIndex((l) => l.id === id);
  if (index < 0) return false;
  lists[index] = change(lists[index]);
  if (!saveLists(lists)) return false;
  storageSet(DIRTY_KEY_PREFIX + id, String(Date.now()));
  return true;
}

/* ---------------------------------------------------------------------
   "NEEDS SAVING" MARKERS (the same idea as a binder's)
   --------------------------------------------------------------------- */

// When the list was last changed without Drive having the change yet
// (null if Drive is up to date)
export function listDirtyStamp(id: string): string | null {
  return storageGet(DIRTY_KEY_PREFIX + id);
}

// Clear the marker, but only if no newer change has happened since the
// save that just finished started
export function markListSaved(id: string, stamp: string): void {
  if (listDirtyStamp(id) === stamp) storageRemove(DIRTY_KEY_PREFIX + id);
}

/* ---------------------------------------------------------------------
   MAKING, RENAMING AND DELETING LISTS
   --------------------------------------------------------------------- */

// The next free name for a new list: "List 1", "List 2", ...
export function nextListName(): string {
  const lists = loadLists();
  const taken = new Set(lists.map((l) => l.name));
  let n = lists.length + 1;
  while (taken.has(`List ${n}`)) n++;
  return `List ${n}`;
}

// A new id for a list kept on this device only
export function newLocalListId(): string {
  return `local-list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Put a new list at the end, with this id (its Drive file's id, or a
// local one) and name, and these cards (often none)
export function addListToDevice(id: string, name: string, cards: ListCard[] = []) {
  saveLists([...loadLists(), { id, name, cards }]);
}

// Give a list a new name (a blank name keeps the old one)
export function renameList(id: string, name: string) {
  const trimmed = name.trim();
  if (trimmed) changeList(id, (l) => ({ ...l, name: trimmed }));
}

// Forget a list on this device (its Drive file is dealt with separately)
export function forgetList(id: string) {
  saveLists(loadLists().filter((l) => l.id !== id));
  storageRemove(DIRTY_KEY_PREFIX + id);
}

// Clear every list's "needs saving" marker (used when this device's lists
// have just been made the same as Drive's, in either direction)
export function clearAllListDirty() {
  for (const key of storageKeys(DIRTY_KEY_PREFIX)) storageRemove(key);
}

// Forget every list on this device. Only "Reset phone memory" in Settings
// uses this: signing out keeps your lists.
export function forgetAllLists() {
  clearAllListDirty();
  storageRemove(LISTS_KEY);
}

/* ---------------------------------------------------------------------
   CARDS IN A LIST
   --------------------------------------------------------------------- */

// Add a card to the end of a list. A card already in the list (the same
// printing, foil or not) isn't added twice: returns false then.
export function addCardToList(id: string, card: ListCard): boolean {
  const list = findList(id);
  if (!list || list.cards.some((c) => samePrinting(c, card))) return false;
  return changeList(id, (l) => ({ ...l, cards: [...l.cards, card] }));
}

// Take the card at this spot (0 is the first) out of a list
export function removeCardFromList(id: string, index: number) {
  changeList(id, (l) => ({ ...l, cards: l.cards.filter((_, i) => i !== index) }));
}
