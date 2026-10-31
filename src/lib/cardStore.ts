/* =====================================================================
   WHERE EACH BINDER'S CARDS ARE KEPT ON THIS DEVICE
   The device's working copy of every binder's cards (see
   binderStorage.ts for what it's for). Each binder's cards are saved
   with AsyncStorage (see storage.ts) as one value, named
   "binderCards:" plus the binder's id, written as JSON text.
   Turning JSON text back into cards takes a moment for a big binder, so
   each binder's cards are also kept here, ready to use, the first time
   they're read.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageRemove, storageSet } from './storage';
import type { BinderCards } from './binderStorage';

// The saved names: "binderCards:" plus the binder's id
export const CARDS_KEY_PREFIX = 'binderCards:';

// Binders' cards already turned back from JSON, by binder id
const cardsInMemory = new Map<string, BinderCards>();

// One binder's cards, read from memory (or from storage the first time).
// null if this device has no copy of it.
function cardsFor(id: string): BinderCards | null {
  const ready = cardsInMemory.get(id);
  if (ready) return ready;
  const text = storageGet(CARDS_KEY_PREFIX + id);
  if (text === null) return null;
  try {
    const cards = JSON.parse(text) as BinderCards;
    cardsInMemory.set(id, cards);
    return cards;
  } catch {
    return null;
  }
}

// One binder's cards, or null if this device has no copy of it. It's a
// copy ("structuredClone"), so changing it can't change the saved cards
// by accident; only writeCards does that.
export function readCards(id: string): BinderCards | null {
  const cards = cardsFor(id);
  return cards ? structuredClone(cards) : null;
}

// How many cards a binder has (without copying them)
export function countCards(id: string): number {
  return Object.keys(cardsFor(id) ?? {}).length;
}

// Does this device have a copy of this binder's cards (even an empty one)?
export function hasCards(id: string): boolean {
  return storageGet(CARDS_KEY_PREFIX + id) !== null;
}

// Save one binder's cards. Returns false if saving isn't working, so the
// page can say so.
export function writeCards(id: string, cards: BinderCards): boolean {
  const copy = structuredClone(cards);
  cardsInMemory.set(id, copy);
  return storageSet(CARDS_KEY_PREFIX + id, JSON.stringify(copy));
}

// Forget one binder's cards (after it's deleted, or uploaded to Drive).
export function deleteCards(id: string): void {
  cardsInMemory.delete(id);
  storageRemove(CARDS_KEY_PREFIX + id);
}

// Forget every binder's cards (signing out, so the next person on this
// device doesn't see them).
export function clearCards(ids: string[]): void {
  for (const id of ids) deleteCards(id);
  cardsInMemory.clear();
}
