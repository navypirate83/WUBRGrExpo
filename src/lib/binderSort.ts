/* =====================================================================
   SORTING A BINDER'S CARDS (the List and Grid views)
   The ways to sort, and the sorting itself. Each sort puts the cards in
   a set order, and cards that tie are put in name order (A to Z):
   - name:   A to Z
   - added:  newest added first
   - price:  most valuable first (what the copies are worth at the store
             chosen in Settings); cards with no price go last
   - color:  White, Blue, Black, Red, Green (one color each), then Gold
             (every card of two or more colors, together), then colorless
   - set:    in the order the sets came out, oldest first
   - type:   Creatures, Enchantments, Artifacts, Sorceries, Instants,
             Battles, Planeswalkers, Lands (then anything else). A card
             with two types goes by the first one in that list, so an
             Artifact Creature is a Creature. The exception: anything
             that is a Land is a Land, whatever else it is (an Artifact
             Land, or a Land Creature, goes under Lands).
   - rarity: Mythic, Rare, Uncommon, Common, Special
   - value:  mana value (the casting cost's total), lowest first
   Most of these need the card's details from Scryfall (its colors, type,
   rarity, and so on), which a binder doesn't save: they come from the
   lookup in hooks/useBinderPrices.ts. Until they've arrived, the cards
   are in name order.
   Plain TypeScript with no React in it.
   ===================================================================== */

import type { ScryfallCard } from './scryfall';
import type { BinderCard } from './binderStorage';

// A card in the list, and the pocket it's in
export type SortEntry = { key: string; card: BinderCard };

export type BinderSort = 'name' | 'added' | 'price' | 'color' | 'set' | 'type' | 'rarity' | 'value';

// The sorts, in the order the Sort window lists them: what each is called
// there, and the short word on the Sort button
export const BINDER_SORTS: { value: BinderSort; name: string; short: string }[] = [
  { value: 'name', name: 'Name (A to Z)', short: 'A–Z' },
  { value: 'added', name: 'Newest added', short: 'Newest' },
  { value: 'price', name: 'Price (highest first)', short: 'Price' },
  { value: 'color', name: 'Color', short: 'Color' },
  { value: 'set', name: 'Set (oldest first)', short: 'Set' },
  { value: 'type', name: 'Type', short: 'Type' },
  { value: 'rarity', name: 'Rarity', short: 'Rarity' },
  { value: 'value', name: 'Mana value (lowest first)', short: 'Mana' },
];
export const DEFAULT_BINDER_SORT: BinderSort = 'name';

// Keep only a real sort name (anything else becomes the default)
export function cleanBinderSort(value: unknown): BinderSort {
  return BINDER_SORTS.some((sort) => sort.value === value) ? (value as BinderSort) : DEFAULT_BINDER_SORT;
}

// What the sorting can look at besides the cards themselves: each card's
// details from Scryfall (by "set/number" in lowercase), and what each
// card's copies are worth (by pocket key)
export type SortContext = {
  printings?: Map<string, ScryfallCard>;
  prices?: Map<string, number | null>;
};

/* ---------------------------------------------------------------------
   READING A CARD'S DETAILS
   --------------------------------------------------------------------- */

// The casting cost's symbols, like "{1}{U}{U}" -> ["1", "U", "U"]
function symbolsOf(cost: string | undefined): string[] {
  return [...(cost ?? '').matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
}

// The card's mana cost (a two-sided card's is on its front side)
function costOf(print: ScryfallCard): string | undefined {
  return print.mana_cost || print.card_faces?.[0]?.mana_cost;
}

// The card's colors, like ["W", "U"]. Scryfall's own list if the card has
// it; otherwise worked out from the casting cost (which misses the rare
// card with a color but no cost).
export function colorsOf(print: ScryfallCard): string[] {
  const given = print.colors ?? print.card_faces?.[0]?.colors;
  if (given) return given;
  const found = new Set<string>();
  for (const symbol of symbolsOf(costOf(print))) {
    for (const letter of symbol.split('/')) if ('WUBRG'.includes(letter) && letter.length === 1) found.add(letter);
  }
  return [...found];
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
function typeLineOf(print: ScryfallCard): string {
  return (print.type_line ?? print.card_faces?.[0]?.type_line ?? '').split('//')[0].toLowerCase();
}

/* ---------------------------------------------------------------------
   THE ORDERS (each gives a number to compare: lower comes first)
   --------------------------------------------------------------------- */

// Color: 0–4 for White, Blue, Black, Red, Green alone; 5 for "Gold" (two
// or more colors, all in one group); 6 for colorless.
function colorGroup(colors: string[]): number {
  if (colors.length === 0) return 6;
  if (colors.length > 1) return 5;
  return 'WUBRG'.indexOf(colors[0]);
}

// Type: Creatures 0, Enchantments 1, Artifacts 2, Sorceries 3, Instants 4,
// Battles 5, Planeswalkers 6, Lands 7, anything else 8. A card with more
// than one type counts as the first of its types in this list, EXCEPT a
// Land, which is always a Land. Only the types before the dash are
// looked at ("Creature", not the "Island" in "Land — Island").
const TYPE_ORDER = ['creature', 'enchantment', 'artifact', 'sorcery', 'instant', 'battle', 'planeswalker', 'land'];
function typeRank(print: ScryfallCard): number {
  const types = typeLineOf(print).split('—')[0];
  const has = (type: string) => new RegExp(`\\b${type}\\b`).test(types);
  if (has('land')) return TYPE_ORDER.indexOf('land');
  const found = TYPE_ORDER.findIndex(has);
  return found === -1 ? TYPE_ORDER.length : found;
}

// Rarity: Mythic 0, Rare 1, Uncommon 2, Common 3, Special (and anything
// else, like "bonus") 4
const RARITY_ORDER = ['mythic', 'rare', 'uncommon', 'common'];
function rarityRank(print: ScryfallCard): number {
  const found = RARITY_ORDER.indexOf(print.rarity ?? '');
  return found === -1 ? RARITY_ORDER.length : found;
}

/* ---------------------------------------------------------------------
   SORTING
   --------------------------------------------------------------------- */

// A to Z by name, then by set and collector number so equal names come out
// in a steady order
function byName(a: SortEntry, b: SortEntry): number {
  return a.card.name.localeCompare(b.card.name) || a.card.set.localeCompare(b.card.set)
    || a.card.number.localeCompare(b.card.number, undefined, { numeric: true });
}

// A new list of the cards, in the order chosen. (The cards given aren't
// changed.) Where a sort needs a card's details and they haven't arrived,
// the card goes last for that sort.
export function sortEntries(entries: SortEntry[], sort: BinderSort, context: SortContext = {}): SortEntry[] {
  const list = [...entries];
  const printOf = (entry: SortEntry) => context.printings?.get(`${entry.card.set}/${entry.card.number}`.toLowerCase());

  // Sort by a number found from the card's details (details missing = last)
  const byRank = (rank: (print: ScryfallCard) => number) => list.sort((a, b) => {
    const pa = printOf(a);
    const pb = printOf(b);
    const ra = pa ? rank(pa) : Infinity;
    const rb = pb ? rank(pb) : Infinity;
    return (ra === rb ? 0 : ra < rb ? -1 : 1) || byName(a, b);
  });

  switch (sort) {
    case 'added':
      return list.sort((a, b) => (b.card.added ?? '').localeCompare(a.card.added ?? '') || byName(a, b));
    case 'price':
      // Most valuable first; no price (or not loaded) last
      return list.sort((a, b) => {
        const pa = context.prices?.get(a.key) ?? -1;
        const pb = context.prices?.get(b.key) ?? -1;
        return pb - pa || byName(a, b);
      });
    case 'color':
      return list.sort((a, b) => {
        const pa = printOf(a);
        const pb = printOf(b);
        const ca = pa ? colorsOf(pa) : null;
        const cb = pb ? colorsOf(pb) : null;
        // Details missing: last
        if (!ca || !cb) return (ca ? -1 : cb ? 1 : 0) || byName(a, b);
        return colorGroup(ca) - colorGroup(cb) || byName(a, b);
      });
    case 'set':
      // Oldest set first; sets from the same day by set code, then collector number
      return list.sort((a, b) => {
        const pa = printOf(a);
        const pb = printOf(b);
        const da = pa?.released_at ?? '9999';
        const db = pb?.released_at ?? '9999';
        return da.localeCompare(db) || a.card.set.localeCompare(b.card.set)
          || a.card.number.localeCompare(b.card.number, undefined, { numeric: true }) || byName(a, b);
      });
    case 'type':
      return byRank(typeRank);
    case 'rarity':
      return byRank(rarityRank);
    case 'value':
      return byRank(manaValueOf);
    default:
      return list.sort(byName);
  }
}
