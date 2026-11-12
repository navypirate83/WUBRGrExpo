/* =====================================================================
   SORTING A BINDER'S CARDS (the List and Grid views)
   The ways to sort, and the sorting itself. Each sort puts the cards in
   a set order, and cards that tie are put in name order (A to Z):
   - name:   A to Z                       (tap again: Z to A)
   - added:  newest added first           (tap again: oldest first)
   - price:  most valuable first          (tap again: cheapest first)
             (what the copies are worth at the store chosen in Settings;
             cards with no price always go last)
   - color:  White, Blue, Black, Red, Green (one color each), then Gold
             (every card of two or more colors, together), then colorless
   - set:    in the order the sets came out, oldest first (tap again:
             newest first)
   - type:   Creatures, Enchantments, Artifacts, Sorceries, Instants,
             Battles, Planeswalkers, Lands (then anything else). A card
             with two types goes by the first one in that list, so an
             Artifact Creature is a Creature. The exception: anything
             that is a Land is a Land, whatever else it is (an Artifact
             Land, or a Land Creature, goes under Lands)
   - rarity: Mythic, Rare, Uncommon, Common, Special (tap again: Common
             first)
   - value:  mana value (the casting cost's total), lowest first (tap
             again: highest first)
   Color and Type have no reverse. Tapping the sort already in use
   reverses the ones that can be reversed; picking a different sort starts
   it in its usual direction.
   The colors, type, rarity, set date and mana value come from the details
   saved WITH each card (see cardDetails.ts). A card that somehow doesn't
   have one yet falls back on the card's details looked up from Scryfall if
   they've arrived; a card with neither always goes last.
   Plain TypeScript with no React in it.
   ===================================================================== */

import type { ScryfallCard } from './scryfall';
import type { BinderCard } from './binderStorage';
import { colorsOf, manaValueOf, storedDetails, typeLineOf, type StoredDetails } from './cardDetails';

// A card in the list, and the pocket it's in
export type SortEntry = { key: string; card: BinderCard };

export type BinderSort = 'name' | 'added' | 'price' | 'color' | 'set' | 'type' | 'rarity' | 'value';

// The sorts, in the order the menu lists them. Each has its name in the
// menu and the short word on the Sort button, in its usual direction and
// (for the ones that can be reversed) in the reversed one.
export type SortOption = {
  value: BinderSort;
  name: string;
  short: string;
  reversedName?: string;     // none: this sort can't be reversed
  reversedShort?: string;
};
export const BINDER_SORTS: SortOption[] = [
  { value: 'name', name: 'Name (A to Z)', short: 'A–Z', reversedName: 'Name (Z to A)', reversedShort: 'Z–A' },
  { value: 'added', name: 'Newest added', short: 'Newest', reversedName: 'Oldest added', reversedShort: 'Oldest' },
  { value: 'price', name: 'Price (highest first)', short: 'Priciest', reversedName: 'Price (lowest first)', reversedShort: 'Cheapest' },
  { value: 'color', name: 'Color', short: 'Color' },
  { value: 'set', name: 'Set (oldest first)', short: 'Old sets', reversedName: 'Set (newest first)', reversedShort: 'New sets' },
  { value: 'type', name: 'Type', short: 'Type' },
  { value: 'rarity', name: 'Rarity (rarest first)', short: 'Rarest', reversedName: 'Rarity (most common first)', reversedShort: 'Common' },
  { value: 'value', name: 'Mana value (lowest first)', short: 'Low mana', reversedName: 'Mana value (highest first)', reversedShort: 'High mana' },
];
export const DEFAULT_BINDER_SORT: BinderSort = 'name';

// Keep only a real sort name (anything else becomes the default)
export function cleanBinderSort(value: unknown): BinderSort {
  return BINDER_SORTS.some((sort) => sort.value === value) ? (value as BinderSort) : DEFAULT_BINDER_SORT;
}

// Can this sort be reversed?
export function canReverse(sort: BinderSort): boolean {
  return BINDER_SORTS.find((s) => s.value === sort)?.reversedName !== undefined;
}

// What the sorting can look at besides the cards themselves: each card's
// details from Scryfall (by "set/number" in lowercase), and what each
// card's copies are worth (by pocket key)
export type SortContext = {
  printings?: Map<string, ScryfallCard>;
  prices?: Map<string, number | null>;
};

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
function typeRank(typeLine: string): number {
  const types = typeLine.toLowerCase().split('//')[0].split('—')[0];
  const has = (type: string) => new RegExp(`\\b${type}\\b`).test(types);
  if (has('land')) return TYPE_ORDER.indexOf('land');
  const found = TYPE_ORDER.findIndex(has);
  return found === -1 ? TYPE_ORDER.length : found;
}

// Rarity: Mythic 0, Rare 1, Uncommon 2, Common 3, Special (and anything
// else, like "bonus") 4
const RARITY_ORDER = ['mythic', 'rare', 'uncommon', 'common'];
function rarityRank(rarity: string): number {
  const found = RARITY_ORDER.indexOf(rarity.toLowerCase());
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

// A card's details for sorting: what's saved with the card, and for
// anything not saved, what the lookup found
function detailsFor(entry: SortEntry, context: SortContext): StoredDetails {
  const saved = storedDetails(entry.card);
  const print = context.printings?.get(`${entry.card.set}/${entry.card.number}`.toLowerCase());
  return {
    rarity: saved.rarity ?? print?.rarity,
    colors: saved.colors ?? (print ? colorsOf(print) : undefined),
    type: saved.type ?? (print ? typeLineOf(print) : undefined),
    cmc: saved.cmc ?? (print ? manaValueOf(print) : undefined),
    released: saved.released ?? print?.released_at,
  };
}

// A new list of the cards, in the order chosen ("reversed": the other way
// round, for the sorts that can be; ignored for the others). The cards given
// aren't changed. A card the sort has nothing to go by (a missing detail, or
// no price) always goes last, whichever way round, and ties are in name order.
export function sortEntries(entries: SortEntry[], sort: BinderSort, reversed = false, context: SortContext = {}): SortEntry[] {
  const direction = reversed && canReverse(sort) ? -1 : 1;
  const list = entries.map((entry) => ({ entry, details: detailsFor(entry, context) }));

  // Sort by something found for each card: a number or text (undefined =
  // nothing to go by, so last)
  const by = (value: (item: (typeof list)[number]) => number | string | undefined, flip = 1) => list.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === undefined || vb === undefined) return (va === undefined ? 1 : 0) - (vb === undefined ? 1 : 0) || byName(a.entry, b.entry);
    const compared = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return compared * direction * flip || byName(a.entry, b.entry);
  });

  switch (sort) {
    case 'added':
      // Newest first (so the dates compare backwards); no date counts as oldest
      by((item) => item.entry.card.added ?? '', -1);
      break;
    case 'price':
      // Most valuable first; no price (or not loaded) last
      by((item) => context.prices?.get(item.entry.key) ?? undefined, -1);
      break;
    case 'color':
      by((item) => (item.details.colors ? colorGroup(item.details.colors) : undefined));
      break;
    case 'set':
      // Oldest set first; sets from the same day by set code, then collector number
      by((item) => (item.details.released ? `${item.details.released} ${item.entry.card.set} ${item.entry.card.number.padStart(6, '0')}` : undefined));
      break;
    case 'type':
      by((item) => (item.details.type !== undefined ? typeRank(item.details.type) : undefined));
      break;
    case 'rarity':
      by((item) => (item.details.rarity !== undefined ? rarityRank(item.details.rarity) : undefined));
      break;
    case 'value':
      by((item) => item.details.cmc);
      break;
    default:
      list.sort((a, b) => byName(a.entry, b.entry) * direction);
  }
  return list.map((item) => item.entry);
}
