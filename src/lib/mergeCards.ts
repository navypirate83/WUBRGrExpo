/* =====================================================================
   COMBINING TWO COPIES OF THE SAME BINDER OR LIST
   Sometimes two devices (say the phone and the website) each have a
   binder with the same name but different cards, and neither has been
   linked to the account yet. Making a numbered copy ("Red 2") is
   exactly the duplicate nobody wants, and picking one side would throw
   cards away. So the two are COMBINED into one binder:
   - a card that is the same on both sides (same printing, same foil,
     same language) counts once, not twice. If one side moved it to
     another pocket, the account's pocket is kept.
   - a card only one side has is added. It keeps its own pocket if that
     pocket is empty; otherwise it goes in the first empty pocket (the
     binder gets more pages if it needs them).
   Nothing is ever dropped. Plain TypeScript with no React in it, and no
   links to the rest of the app, so it can be tested on its own.
   ===================================================================== */

// The parts of a card this file looks at (a binder card or a list card)
type CardLike = { name?: string; set?: string; number?: string; face?: number; lang?: string; foil?: boolean; count?: number };

// What makes two cards "the same card": the same printing, side, language
// and foil. (The card's name is used when there's no set and number.)
export function cardIdentity(card: CardLike): string {
  const printing = card.set && card.number ? `${card.set}/${card.number}` : `name:${card.name ?? ''}`;
  return `${printing}|${card.face ?? 0}|${card.lang || 'en'}|${card.foil ? 1 : 0}`;
}

// How many copies a card stands for (at least one)
const copies = (card: CardLike): number => Math.max(1, card.count ?? 1);

// "page-pocket" in the order they appear in the binder (page by page)
function pocketOrder(a: string, b: string): number {
  const [pa, sa] = a.split('-').map(Number);
  const [pb, sb] = b.split('-').map(Number);
  return pa - pb || sa - sb;
}

// Combine two binders' cards. "mine" is this device's, "theirs" the
// account's. perPage is how many pockets a page has. Returns the combined
// cards, and how many pages are needed to hold them.
export function mergeBinderCards<T extends CardLike>(
  mine: Record<string, T>,
  theirs: Record<string, T>,
  perPage: number,
): { cards: Record<string, T>; pagesNeeded: number } {
  const merged: Record<string, T> = { ...theirs };
  // Pockets of theirs that one of my cards has already matched
  const claimed = new Set<string>();
  const leftOver: [string, T][] = [];

  // First, the cards that are the same card in the same pocket on both sides
  for (const key of Object.keys(mine).sort(pocketOrder)) {
    const card = mine[key];
    const other = theirs[key];
    if (other && cardIdentity(other) === cardIdentity(card)) {
      claimed.add(key);
      merged[key] = { ...other, ...(copies(card) > 1 || copies(other) > 1 ? { count: Math.max(copies(card), copies(other)) } : {}) };
    } else {
      leftOver.push([key, card]);
    }
  }

  // Then the same card in a different pocket (it was moved on one side)
  const toAdd: [string, T][] = [];
  for (const [key, card] of leftOver) {
    const matchKey = Object.keys(theirs).sort(pocketOrder)
      .find((k) => !claimed.has(k) && cardIdentity(theirs[k]) === cardIdentity(card));
    if (matchKey) {
      claimed.add(matchKey);
      if (copies(card) > copies(theirs[matchKey])) merged[matchKey] = { ...theirs[matchKey], count: copies(card) };
    } else {
      toAdd.push([key, card]);
    }
  }

  // Last, the cards only my side has: their own pocket if it's empty,
  // otherwise the first empty pocket
  for (const [key, card] of toAdd) {
    if (!merged[key]) { merged[key] = card; continue; }
    let slot = 1;
    for (; merged[`${Math.ceil(slot / perPage)}-${((slot - 1) % perPage) + 1}`]; slot += 1);
    merged[`${Math.ceil(slot / perPage)}-${((slot - 1) % perPage) + 1}`] = card;
  }

  const pagesNeeded = Math.max(1, ...Object.keys(merged).map((k) => Number(k.split('-')[0])));
  return { cards: merged, pagesNeeded };
}

// Combine two lists' cards. "theirs" (the account's) come first in their
// order, then any of mine that they don't have. A card both sides have
// counts once (each of their cards can match only one of mine).
export function mergeListCards<T extends CardLike>(mine: T[], theirs: T[]): T[] {
  const available = new Map<string, number>();
  for (const card of theirs) available.set(cardIdentity(card), (available.get(cardIdentity(card)) ?? 0) + 1);
  const added: T[] = [];
  for (const card of mine) {
    const id = cardIdentity(card);
    const left = available.get(id) ?? 0;
    if (left > 0) available.set(id, left - 1);
    else added.push(card);
  }
  return [...theirs, ...added];
}

// Combine two decks' cards, the same way (see mergeListCards), except that a
// card in the sideboard and the same card in the main deck are different
// cards. A card of mine that would take a command zone spot the account's deck
// already uses goes into the main deck instead (a spot holds one card).
type DeckCardLike = CardLike & { zone?: string; slot?: number };
const deckIdentity = (card: DeckCardLike): string => `${cardIdentity(card)}|${card.zone ?? 'main'}|${card.zone === 'command' ? card.slot ?? 0 : ''}`;

export function mergeDeckCards<T extends DeckCardLike>(mine: T[], theirs: T[]): T[] {
  const available = new Map<string, number>();
  for (const card of theirs) available.set(deckIdentity(card), (available.get(deckIdentity(card)) ?? 0) + 1);
  const taken = new Set(theirs.filter((c) => c.zone === 'command').map((c) => c.slot ?? 0));
  const added: T[] = [];
  for (const card of mine) {
    const id = deckIdentity(card);
    const left = available.get(id) ?? 0;
    if (left > 0) { available.set(id, left - 1); continue; }
    if (card.zone === 'command' && taken.has(card.slot ?? 0)) {
      const { zone: _zone, slot: _slot, ...rest } = card;
      added.push(rest as T);
    } else {
      added.push(card);
    }
  }
  return [...theirs, ...added];
}
