/* =====================================================================
   THE DETAILS SAVED WITH EACH CARD
   Sorting a binder by color, rarity, type, set age or mana value needs
   to know those things about every card. They're saved WITH the card, in
   its "extra" notes (the same place a .csv file's Rarity and Set name
   go), so they travel in the binder's .csv and .json files and on the
   server, and a sort never has to wait for a lookup on the internet:
     - Set name     the set's full name        like "Dominaria United"
     - Rarity       common, uncommon, rare, mythic, special or bonus
     - Colors       the card's colors as letters in W U B R G order,
                    like "WU", or "C" for colorless
     - Type         the front side's type line  like "Artifact Creature — Golem"
     - Mana value   the casting cost's total    like "4" (0 for a land)
     - Released     when the set came out       like "2022-09-09"
   A card added in the Card Finder, or from a Scryfall picture dropped on
   a pocket, gets them at once. A card made before this (or from an
   uploaded file) gets them filled in the first time its binder is opened,
   from one lookup on Scryfall (see fillDetails).
   Plain TypeScript with no React in it.
   ===================================================================== */

import type { ScryfallCard } from './scryfall';
import type { BinderCard, BinderCards } from './binderStorage';

/* ---------------------------------------------------------------------
   READING A PRINTING'S DETAILS
   --------------------------------------------------------------------- */

// The casting cost's symbols, like "{1}{U}{U}" -> ["1", "U", "U"]
function symbolsOf(cost: string | undefined): string[] {
  return [...(cost ?? '').matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

// The card's mana cost (a two-sided card's is on its front side)
function costOf(print: ScryfallCard): string | undefined {
  return print.mana_cost || print.card_faces?.[0]?.mana_cost;
}

// The card's colors, like ["W", "U"], in W U B R G order. Scryfall's own
// list if the card has it; otherwise worked out from the casting cost
// (which misses the rare card with a color but no cost).
export function colorsOf(print: ScryfallCard): string[] {
  let found = print.colors ?? print.card_faces?.[0]?.colors;
  if (!found) {
    const letters = new Set<string>();
    for (const symbol of symbolsOf(costOf(print))) {
      for (const letter of symbol.split('/')) if (letter.length === 1 && 'WUBRG'.includes(letter)) letters.add(letter);
    }
    found = [...letters];
  }
  return [...found].sort((a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b));
}

// The mana value: Scryfall's own number if the card has it; otherwise
// added up from the cost (a number counts as itself, a color as 1, X as 0,
// and a "2/W" choice as 2)
export function manaValueOf(print: ScryfallCard): number {
  if (typeof print.cmc === 'number') return print.cmc;
  let total = 0;
  for (const symbol of symbolsOf(costOf(print))) {
    if (/^\d+$/.test(symbol)) total += Number(symbol);
    else if (/^[XYZ]$/.test(symbol)) total += 0;
    else if (symbol.startsWith('2/')) total += 2;
    else total += 1;
  }
  return total;
}

// The card's type line, front side only, like "Artifact Creature — Golem"
export function typeLineOf(print: ScryfallCard): string {
  return (print.type_line ?? print.card_faces?.[0]?.type_line ?? '').split('//')[0].trim();
}

/* ---------------------------------------------------------------------
   THE DETAILS AS SAVED WITH A CARD (all text, like the rest of "extra")
   --------------------------------------------------------------------- */

// The notes a card should carry, from its printing
export function detailsOf(print: ScryfallCard): Record<string, string> {
  const details: Record<string, string> = { 'Set name': print.set_name };
  if (print.rarity) details.Rarity = print.rarity;
  details.Colors = colorsOf(print).join('') || 'C';
  const type = typeLineOf(print);
  if (type) details.Type = type.slice(0, 190);
  details['Mana value'] = String(manaValueOf(print));
  if (print.released_at) details.Released = print.released_at;
  return details;
}

// The ones sorting needs: does this card have all of them?
const NEEDED = ['Rarity', 'Colors', 'Type', 'Mana value', 'Released'] as const;
export function needsDetails(card: BinderCard): boolean {
  return NEEDED.some((name) => !card.extra?.[name]);
}

// What's saved with a card, read back as numbers and lists for sorting
// (anything not saved is left out)
export type StoredDetails = { rarity?: string; colors?: string[]; type?: string; cmc?: number; released?: string };
export function storedDetails(card: BinderCard): StoredDetails {
  const extra = card.extra ?? {};
  const out: StoredDetails = {};
  if (extra.Rarity) out.rarity = extra.Rarity.toLowerCase();
  if (extra.Colors) out.colors = extra.Colors === 'C' ? [] : extra.Colors.split('').filter((c) => 'WUBRG'.includes(c));
  if (extra.Type) out.type = extra.Type;
  if (extra['Mana value'] !== undefined && extra['Mana value'] !== '' && Number.isFinite(Number(extra['Mana value']))) out.cmc = Number(extra['Mana value']);
  if (extra.Released) out.released = extra.Released;
  return out;
}

// A card with its details added from its printing. What the card already
// has is kept (like a Rarity from an uploaded file); only what's missing
// is filled in.
export function withDetails(card: BinderCard, print: ScryfallCard): BinderCard {
  return { ...card, extra: { ...detailsOf(print), ...card.extra } };
}

// Fill in the missing details of a binder's cards from their printings
// (looked up by "set/number" in lowercase). Returns the new set of cards,
// or null if nothing needed filling (or no printing was found for the
// cards that did).
export function fillDetails(cards: BinderCards, printings: Map<string, ScryfallCard>): BinderCards | null {
  let changed = false;
  const next: BinderCards = {};
  for (const [key, card] of Object.entries(cards)) {
    const print = needsDetails(card) ? printings.get(`${card.set}/${card.number}`.toLowerCase()) : undefined;
    if (print) {
      next[key] = withDetails(card, print);
      changed = true;
    } else {
      next[key] = card;
    }
  }
  return changed ? next : null;
}
