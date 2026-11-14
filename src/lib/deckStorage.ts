/* =====================================================================
   YOUR DECKS (this device's copy)
   Decks, kept beside your binders and lists on The Shelf tab. Each deck
   has a name, a format (Commander, Modern, ... see deckFormats.ts), and
   its cards in the order they were added. A card in a deck is saved the
   same way as a card in a list: its exact printing and picture, plus its
   casting cost and type line.
   Decks are kept on this device first (so the app works with no internet),
   and when you're signed in they are also kept in your WUBRG'r account, so
   they follow you to your other devices (see serverSync.ts). They aren't
   saved to Google Drive.
   This is the first step of decks: the cards are simply a list. The
   commander slot, sideboard and the format's rules come later.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageRemove, storageSet } from './storage';
import { MAX_COPIES, samePrinting } from './binderStorage';
import { needsDetails, withDetails } from './cardDetails';
import type { ScryfallCard } from './scryfall';
import { cleanDeckFormat, DEFAULT_DECK_FORMAT } from './deckFormats';
import type { ListCard } from './listStorage';

// Where a card is kept: in the main deck (the start), in the sideboard, or in
// the command zone (a commander, a partner, an Oathbreaker...). A command zone
// card also has its "slot": 0 is the first spot (the commander or Oathbreaker),
// 1 the second (the partner, Background or signature spell).
export type Zone = 'main' | 'side' | 'command';

// One card in a deck: the same as a card in a list, and where it's kept
export type DeckCard = ListCard & { zone?: 'side' | 'command'; slot?: 0 | 1 };

// A card's zone (a card with none is in the main deck)
export const zoneOf = (card: DeckCard): Zone => card.zone ?? 'main';

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

// Keep every deck on this device, just as given. Returns false if the device
// wouldn't save. (The server sync uses this too: see serverSync.ts.)
export function saveDecks(decks: Deck[]): boolean {
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

// A new id for a deck kept on this device
export function newLocalDeckId(): string {
  return `local-deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// Make a new, empty deck at the end, and give back its id
export function addDeck(name: string, format: string = DEFAULT_DECK_FORMAT): string {
  const id = newLocalDeckId();
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

// Add one copy of a card, to the main deck or (with "zone") the sideboard.
// The same printing already there gets one more copy; otherwise the card
// goes on the end.
export function addCardToDeck(id: string, card: DeckCard, zone: 'main' | 'side' = 'main'): boolean {
  const wanted = zone === 'side' ? { ...card, zone: 'side' as const } : stripZone(card);
  return changeDeck(id, (d) => {
    const at = d.cards.findIndex((c) => samePrinting(c, wanted) && zoneOf(c) === zone);
    if (at < 0) return { ...d, cards: [...d.cards, oneCopyIsNoCount(wanted)] };
    return { ...d, cards: d.cards.map((c, i) => (i === at ? { ...c, count: Math.min(MAX_COPIES, (c.count ?? 1) + 1) } : c)) };
  });
}

// One copy is saved as no count at all, the same as a binder's cards: the
// card with its count taken off
function oneCopyIsNoCount(card: DeckCard): DeckCard {
  const { count: _count, ...rest } = card;
  return rest as DeckCard;
}

// Swap the card at this spot (0 is the first) for another printing or card,
// keeping its place in the deck and how many copies there are. Returns
// false if there's no card at that spot.
export function replaceDeckCard(id: string, index: number, card: DeckCard): boolean {
  const before = findDeck(id)?.cards[index];
  if (!before) return false;
  const copies = before.count ?? 1;
  // It stays in the same list (the sideboard or the command zone spot), and a
  // command zone card keeps what its abilities allow (when it's the same card)
  const place: Partial<DeckCard> = before.zone ? { zone: before.zone, slot: before.slot } : {};
  if (before.zone === 'command' && before.name === card.name) {
    place.extra = { ...card.extra, Pairing: before.extra?.Pairing ?? '[]', 'Color identity': before.extra?.['Color identity'] ?? 'C' };
  }
  const swapped = { ...card, ...place } as DeckCard;
  const next = copies > 1 ? { ...swapped, count: copies } : oneCopyIsNoCount(swapped);
  return changeDeck(id, (d) => ({ ...d, cards: d.cards.map((c, i) => (i === index ? next : c)) }));
}

// Replace all of a deck's cards with this list (used when what you own
// changes how the copies are split into entries: see deckOwnership.ts)
export function setDeckCards(id: string, cards: DeckCard[]): boolean {
  return changeDeck(id, (d) => ({ ...d, cards }));
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

/* ---------------------------------------------------------------------
   ZONES: THE MAIN DECK, THE SIDEBOARD AND THE COMMAND ZONE
   --------------------------------------------------------------------- */

// A card with no zone and no slot (as it is in the main deck)
function stripZone(card: DeckCard): DeckCard {
  const { zone: _zone, slot: _slot, ...rest } = card;
  return rest as DeckCard;
}

// The card in a command zone spot (undefined if the spot is empty)
export function commandCard(deck: Deck | undefined, slot: 0 | 1): DeckCard | undefined {
  return deck?.cards.find((c) => c.zone === 'command' && c.slot === slot);
}

// Put the card at this spot in the deck back into the main deck, as one
// copy (joining the same printing there, if there is one). Returns false
// if there's no card at that spot.
export function moveToMain(id: string, index: number): boolean {
  const deck = findDeck(id);
  const card = deck?.cards[index];
  if (!deck || !card) return false;
  const back = stripZone(card);
  return changeDeck(id, (d) => {
    const without = d.cards.filter((_, i) => i !== index);
    const at = without.findIndex((c) => samePrinting(c, back) && zoneOf(c) === 'main');
    const copies = card.count ?? 1;
    if (at < 0) return { ...d, cards: [...without, copies > 1 ? { ...back, count: copies } : oneCopyIsNoCount(back)] };
    return { ...d, cards: without.map((c, i) => (i === at ? { ...c, count: Math.min(MAX_COPIES, (c.count ?? 1) + copies) } : c)) };
  });
}

// Move the card at this spot into the sideboard (all its copies)
export function moveToSideboard(id: string, index: number): boolean {
  const deck = findDeck(id);
  const card = deck?.cards[index];
  if (!deck || !card) return false;
  const there = { ...stripZone(card), zone: 'side' as const };
  return changeDeck(id, (d) => {
    const without = d.cards.filter((_, i) => i !== index);
    const at = without.findIndex((c) => samePrinting(c, there) && zoneOf(c) === 'side');
    const copies = card.count ?? 1;
    if (at < 0) return { ...d, cards: [...without, copies > 1 ? { ...there, count: copies } : oneCopyIsNoCount(there)] };
    return { ...d, cards: without.map((c, i) => (i === at ? { ...c, count: Math.min(MAX_COPIES, (c.count ?? 1) + copies) } : c)) };
  });
}

// Put a card into a command zone spot. "from" is the spot in the deck of a
// card already there (one copy of it moves; any others stay), or leave it
// out to add a new card. A card already in that command zone spot goes back
// into the main deck. "extra" is saved with the card (what its pairing
// abilities and colors are: see deckZones.ts).
export function placeInCommandZone(id: string, slot: 0 | 1, card: DeckCard, from?: number, extra?: Record<string, string>): boolean {
  const deck = findDeck(id);
  if (!deck) return false;
  // The card moving in, remembered by what it is (the spots shift when the old
  // card in this spot goes back into the main deck)
  const source = from !== undefined ? deck.cards[from] : undefined;
  const old = commandCard(deck, slot);
  if (old) moveToMain(id, deck.cards.indexOf(old));
  const { count: _count, ...plain } = stripZone(card);
  const placed = { ...plain, zone: 'command' as const, slot, extra: { ...card.extra, ...extra } } as DeckCard;
  return changeDeck(id, (d) => {
    let cards = d.cards;
    if (source) {
      const at = cards.findIndex((c) => samePrinting(c, source) && zoneOf(c) === zoneOf(source));
      if (at >= 0) {
        const copies = cards[at].count ?? 1;
        cards = copies > 1
          ? cards.map((c, i) => (i === at ? (copies - 1 > 1 ? { ...c, count: copies - 1 } : oneCopyIsNoCount(c)) : c))
          : cards.filter((_, i) => i !== at);
      }
    }
    return { ...d, cards: [...cards, placed] };
  });
}
