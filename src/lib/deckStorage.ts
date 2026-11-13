/* =====================================================================
   YOUR DECKS (this device's copy)
   Decks, kept beside your binders and lists on The Shelf tab. Each deck
   has a name, a format (Commander, Modern, ... see deckFormats.ts), and
   its cards in the order they were added. A card in a deck is saved the
   same way as a card in a list: its exact printing and picture, plus its
   casting cost and type line.
   For now decks are kept on this device only (not in Google Drive or on
   the server); saving them to the account comes later.
   This is the first step of decks: the cards are simply a list. The
   commander slot, sideboard and the format's rules come later.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageRemove, storageSet } from './storage';
import { samePrinting } from './binderStorage';
import { needsDetails, withDetails } from './cardDetails';
import type { ScryfallCard } from './scryfall';
import { cleanDeckFormat, DEFAULT_DECK_FORMAT } from './deckFormats';
import type { ListCard } from './listStorage';

// One card in a deck: the same as a card in a list
export type DeckCard = ListCard;

// One deck: its id, name, format code and cards
export type Deck = { id: string; name: string; format: string; cards: DeckCard[] };

// Where the decks are kept on this device
const DECKS_KEY = 'decks';

/* ---------------------------------------------------------------------
   READING AND SAVING
   --------------------------------------------------------------------- */

// Every deck on this device, in order (none if there are none, or if
// what's saved can't be read)
export function loadDecks(): Deck[] {
  try {
    const saved = JSON.parse(storageGet(DECKS_KEY) ?? '[]');
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((d) => d && typeof d.id === 'string' && typeof d.name === 'string')
      .map((d) => ({ id: d.id, name: d.name, format: cleanDeckFormat(d.format), cards: Array.isArray(d.cards) ? d.cards : [] }));
  } catch {
    return [];
  }
}

// Keep every deck on this device. Returns false if the device wouldn't save.
function saveDecks(decks: Deck[]): boolean {
  return storageSet(DECKS_KEY, JSON.stringify(decks));
}

// One deck, by its id (undefined if there's no such deck)
export function findDeck(id: string): Deck | undefined {
  return loadDecks().find((d) => d.id === id);
}

// Change one deck: "change" gets the deck and returns it changed. Returns
// false if there's no such deck, or the device wouldn't save.
function changeDeck(id: string, change: (deck: Deck) => Deck): boolean {
  const decks = loadDecks();
  const index = decks.findIndex((d) => d.id === id);
  if (index < 0) return false;
  decks[index] = change(decks[index]);
  return saveDecks(decks);
}

/* ---------------------------------------------------------------------
   MAKING, RENAMING AND DELETING DECKS
   --------------------------------------------------------------------- */

// The next free name for a new deck: "Deck 1", "Deck 2", ...
export function nextDeckName(): string {
  const decks = loadDecks();
  const taken = new Set(decks.map((d) => d.name));
  let n = decks.length + 1;
  while (taken.has(`Deck ${n}`)) n++;
  return `Deck ${n}`;
}

// Make a new, empty deck at the end, and give back its id
export function addDeck(name: string, format: string = DEFAULT_DECK_FORMAT): string {
  const id = `local-deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  saveDecks([...loadDecks(), { id, name: name.trim() || nextDeckName(), format: cleanDeckFormat(format), cards: [] }]);
  return id;
}

// Give a deck a new name (a blank name keeps the old one)
export function renameDeck(id: string, name: string) {
  const trimmed = name.trim();
  if (trimmed) changeDeck(id, (d) => ({ ...d, name: trimmed }));
}

// Change a deck's format
export function setDeckFormat(id: string, format: string) {
  changeDeck(id, (d) => ({ ...d, format: cleanDeckFormat(format) }));
}

// Delete a deck
export function forgetDeck(id: string) {
  saveDecks(loadDecks().filter((d) => d.id !== id));
}

// Delete every deck (only "Reset phone memory" in Settings would use this)
export function forgetAllDecks() {
  storageRemove(DECKS_KEY);
}

/* ---------------------------------------------------------------------
   CARDS IN A DECK
   --------------------------------------------------------------------- */

// How many copies of a card (by name, whatever the printing) a deck has
export function copiesOf(deck: Deck | undefined, name: string): number {
  const wanted = name.trim().toLowerCase();
  return (deck?.cards ?? []).reduce((sum, card) => sum + (card.name.trim().toLowerCase() === wanted ? card.count ?? 1 : 0), 0);
}

// Add one copy of a card. The same printing already in the deck gets one
// more copy; otherwise the card goes on the end.
export function addCardToDeck(id: string, card: DeckCard): boolean {
  return changeDeck(id, (d) => {
    const at = d.cards.findIndex((c) => samePrinting(c, card));
    if (at < 0) return { ...d, cards: [...d.cards, oneCopyIsNoCount(card)] };
    return { ...d, cards: d.cards.map((c, i) => (i === at ? { ...c, count: (c.count ?? 1) + 1 } : c)) };
  });
}

// One copy is saved as no count at all, the same as a binder's cards
function oneCopyIsNoCount(card: DeckCard): DeckCard {
  if (card.count !== undefined && card.count > 1) return card;
  const { count: _count, ...rest } = card;
  return rest as DeckCard;
}

// Change how many copies of the card at this spot (0 is the first) the
// deck has; 0 takes it out
export function setDeckCardCount(id: string, index: number, count: number): boolean {
  return changeDeck(id, (d) => ({
    ...d,
    cards: d.cards
      .map((card, i) => (i === index ? (count > 1 ? { ...card, count } : count === 1 ? oneCopyIsNoCount(card) : null) : card))
      .filter((card): card is DeckCard => card !== null),
  }));
}

// Save the details sorting needs (colors, type, rarity, mana value, release
// date: see cardDetails.ts) with the cards of a deck that don't have them
// yet, from their printings (by "set/number" in lowercase). Returns true if
// anything was filled in.
export function fillDeckDetails(id: string, printings: Map<string, ScryfallCard>): boolean {
  const deck = findDeck(id);
  if (!deck) return false;
  let changed = false;
  const cards = deck.cards.map((card) => {
    const print = needsDetails(card) ? printings.get(`${card.set}/${card.number}`.toLowerCase()) : undefined;
    if (!print) return card;
    changed = true;
    return withDetails(card, print) as DeckCard;
  });
  return changed && changeDeck(id, (d) => ({ ...d, cards }));
}
