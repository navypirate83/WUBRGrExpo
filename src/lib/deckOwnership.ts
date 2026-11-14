/* =====================================================================
   WHAT YOU OWN, FOR A DECK
   A deck marks each card by what's in your binders (cards on lists don't
   count: a list is for cards you want, not cards you own):
     - 'card':     you don't own the card at all           -> solid red border
     - 'printing': you own the card, but not this printing -> dashed red border
                   (tap it to pick one of the printings you own)
     - false:      you own this printing                   -> no border
   A "printing" is one version of a card: a set and a collector number.
   Foil and language don't count as a different printing here.

   If a deck holds more copies of a printing than you own, the extra copies
   are split off as their own entry (so each entry can have its own border),
   but the deck still counts every copy. Different printings are always
   separate entries. None of this goes in the .CSV: it's only a hint for
   the player, from the binders they have so far.
   ===================================================================== */

import { cardCount, loadBinder, loadBinderList, MAX_COPIES, samePrinting, type BinderCard } from './binderStorage';
import { zoneOf, type DeckCard } from './deckStorage';

// One printing you own: its key ("set/number" in lowercase), a sample of
// the card (for its picture), and how many copies you own in all
export type OwnedPrint = { key: string; card: BinderCard; count: number };

// Everything you own, by card name (lowercase)
export type OwnedMap = Map<string, OwnedPrint[]>;

// A border to draw: false is none
export type Mark = false | 'card' | 'printing';

export const printKey = (card: { set: string; number: string }): string => `${card.set}/${card.number}`.toLowerCase();
const nameKey = (name: string): string => name.trim().toLowerCase();

// Read your binders: each card name with the printings you own and how many
// copies of each
export function loadOwned(): OwnedMap {
  const owned: OwnedMap = new Map();
  for (const binder of loadBinderList()) {
    for (const card of Object.values(loadBinder(binder.id))) {
      const name = nameKey(card.name);
      const key = printKey(card);
      const prints = owned.get(name) ?? [];
      const found = prints.find((p) => p.key === key);
      if (found) {
        found.count += cardCount(card);
      } else {
        const { count: _count, ...sample } = card;
        prints.push({ key, card: sample, count: cardCount(card) });
      }
      owned.set(name, prints);
    }
  }
  return owned;
}

// A card with this many copies (one copy is saved with no count at all)
function withCount(card: DeckCard, copies: number): DeckCard {
  if (copies > 1) return { ...card, count: copies };
  const { count: _count, ...rest } = card;
  return rest as DeckCard;
}

// The border for each card in the deck (by its place in the list). Your
// copies are handed out in order: each entry uses up the copies you own of
// its printing, so a printing you own only twice covers two copies in all.
export function marksFor(cards: DeckCard[], owned: OwnedMap): Mark[] {
  const left = new Map<string, number>();
  for (const prints of owned.values()) for (const p of prints) left.set(p.key, p.count);
  return cards.map((card) => {
    const prints = owned.get(nameKey(card.name));
    if (!prints?.length) return 'card';
    const key = printKey(card);
    if (!prints.some((p) => p.key === key)) return 'printing';
    const have = left.get(key) ?? 0;
    const need = cardCount(card);
    if (have >= need) { left.set(key, have - need); return false; }
    // Used up: pick another printing you own, or (if there's none) it's not owned
    return prints.some((p) => p.key !== key) ? 'printing' : 'card';
  });
}

// Tidy a deck's cards for what you own: copies of the same printing in the
// same place are joined, then, for a printing you own fewer copies of than the
// deck holds, the copies you own stay as one entry and the rest are split off
// as another. Gives back the very same list when nothing needs changing.
export function normalizeOwnership(cards: DeckCard[], owned: OwnedMap): DeckCard[] {
  // Join entries that are the same printing in the same place
  const joined: DeckCard[] = [];
  for (const card of cards) {
    const at = card.zone === 'command' ? -1
      : joined.findIndex((c) => c.zone !== 'command' && samePrinting(c, card) && zoneOf(c) === zoneOf(card));
    if (at < 0) joined.push(card);
    else joined[at] = withCount(joined[at], Math.min(MAX_COPIES, cardCount(joined[at]) + cardCount(card)));
  }
  // Split off the copies you don't own
  const left = new Map<string, number>();
  for (const prints of owned.values()) for (const p of prints) left.set(p.key, p.count);
  const result: DeckCard[] = [];
  for (const card of joined) {
    const key = printKey(card);
    const have = left.get(key);
    const need = cardCount(card);
    if (have === undefined || card.zone === 'command') {
      result.push(card);
    } else if (have >= need) {
      left.set(key, have - need);
      result.push(card);
    } else if (have > 0) {
      left.set(key, 0);
      result.push(withCount(card, have), withCount(card, need - have));
    } else {
      result.push(card);
    }
  }
  const same = result.length === cards.length && result.every((card, i) => JSON.stringify(card) === JSON.stringify(cards[i]));
  return same ? cards : result;
}

// The printings you own that the card at this spot could be switched to, each
// with how many copies of it are free for this card: what you own of it,
// less what the deck's other entries already use. Printings with none free,
// and the printing it already is, are left out.
export function choicesFor(cards: DeckCard[], index: number, owned: OwnedMap): { print: OwnedPrint; free: number }[] {
  const card = cards[index];
  if (!card) return [];
  const here = printKey(card);
  const choices: { print: OwnedPrint; free: number }[] = [];
  for (const print of owned.get(nameKey(card.name)) ?? []) {
    if (print.key === here) continue;
    const used = cards.reduce((sum, c, i) => (i !== index && nameKey(c.name) === nameKey(card.name) && printKey(c) === print.key ? sum + cardCount(c) : sum), 0);
    if (print.count - used > 0) choices.push({ print, free: print.count - used });
  }
  return choices;
}

// Switch the card at this spot to a printing you own. As many copies as you
// have free of that printing switch (up to all of them); any left over stay
// as they were, just after it. Gives back the new list of cards, whether
// every copy switched, or null if none could.
export function assignPrinting(cards: DeckCard[], index: number, print: OwnedPrint, owned: OwnedMap): { cards: DeckCard[]; all: boolean } | null {
  const before = cards[index];
  const choice = choicesFor(cards, index, owned).find((c) => c.print.key === print.key);
  if (!before || !choice) return null;
  const need = cardCount(before);
  const take = Math.min(need, choice.free);
  // The same card, as the printing you own: its picture and details come from
  // the binder card; its place in the deck, cost and type stay
  const switched: DeckCard = {
    ...before,
    set: print.card.set,
    number: print.card.number,
    face: print.card.face,
    image: print.card.image,
    lang: print.card.lang,
    foil: print.card.foil,
    extra: { ...before.extra, ...print.card.extra },
  };
  if (print.card.lang === undefined) delete switched.lang;
  if (print.card.foil === undefined) delete switched.foil;
  const next = [...cards];
  if (take >= need) {
    next[index] = withCount(switched, need);
  } else {
    next[index] = withCount(before, need - take);
    next.splice(index + 1, 0, withCount(switched, take));
  }
  return { cards: normalizeOwnership(next, owned), all: take >= need };
}
