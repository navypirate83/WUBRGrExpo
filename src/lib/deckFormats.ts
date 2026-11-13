/* =====================================================================
   THE DECK FORMATS (paper Magic only)
   What each way of building a deck asks for, from the project's notes in
   docs/deck-formats.md. Only the parts the app uses so far are here:
   the format's name, which of the two kinds of deck it is, and how many
   copies of one card the deck may have before the app warns about it.
   - "main": a main deck plus a sideboard, up to 4 copies of a card
   - "commander": one or two command cards on top, then a singleton deck
     (one copy of each card), every card inside the commander's colors
   The codes are the same as the format codes in Scryfall's card
   "legalities" (see FORMAT_NAMES in cards.ts), so a card's legality in a
   deck's format can be looked up with them later.
   Plain TypeScript with no React in it.
   ===================================================================== */

// The cards a deck keeps outside its main deck, as the format's rules ask:
// - "commander": a commander, and (if its abilities allow) a second spot for
//   a partner, a Background and the like ("pairs" says whether the format
//   allows that second spot)
// - "oathbreaker": an Oathbreaker (a planeswalker) and its signature spell
// "sideboard" is how many cards the sideboard may hold (0: no sideboard).
export type CommandZone = { kind: 'commander'; pairs: boolean } | { kind: 'oathbreaker' };

export type DeckFormat = {
  code: string;                 // Scryfall's code for the format, like "commander"
  name: string;                 // what it's called on screen
  kind: 'main' | 'commander';
  copyLimit: number;            // copies of one card before the app warns (basic lands never warn)
  command?: CommandZone;        // the spots outside the deck (none for a main + sideboard format)
  sideboard: number;            // the sideboard's size (0: none)
  maxManaValue?: number;        // the highest mana value any card may have (Tiny Leaders: 3)
};

// The formats, in the order they're offered
export const DECK_FORMATS: DeckFormat[] = [
  { code: 'commander', name: 'Commander', kind: 'commander', copyLimit: 1, command: { kind: 'commander', pairs: true }, sideboard: 0 },
  { code: 'oathbreaker', name: 'Oathbreaker', kind: 'commander', copyLimit: 1, command: { kind: 'oathbreaker' }, sideboard: 0 },
  { code: 'duel', name: 'Duel Commander', kind: 'commander', copyLimit: 1, command: { kind: 'commander', pairs: true }, sideboard: 0 },
  { code: 'paupercommander', name: 'Pauper Commander', kind: 'commander', copyLimit: 1, command: { kind: 'commander', pairs: true }, sideboard: 0 },
  { code: 'predh', name: 'PreDH', kind: 'commander', copyLimit: 1, command: { kind: 'commander', pairs: true }, sideboard: 0 },
  // Tiny Leaders: 50 cards with the commander, one copy of each, every card
  // (the commander too) with a mana value of 3 or less, a sideboard of up to 10
  { code: 'tlr', name: 'Tiny Leaders: Reborn', kind: 'commander', copyLimit: 1, command: { kind: 'commander', pairs: false }, sideboard: 10, maxManaValue: 3 },
  { code: 'standard', name: 'Standard', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'pioneer', name: 'Pioneer', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'modern', name: 'Modern', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'legacy', name: 'Legacy', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'vintage', name: 'Vintage', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'pauper', name: 'Pauper', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'penny', name: 'Penny Dreadful', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'premodern', name: 'Premodern', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'oldschool', name: 'Old School 93/94', kind: 'main', copyLimit: 4, sideboard: 15 },
  { code: 'future', name: 'Future Standard', kind: 'main', copyLimit: 4, sideboard: 15 },
];

export const DEFAULT_DECK_FORMAT = 'commander';

// A format by its code (the first one if the code isn't known)
export function deckFormat(code: string | undefined): DeckFormat {
  return DECK_FORMATS.find((f) => f.code === code) ?? DECK_FORMATS[0];
}

// Keep only a real format code (anything else becomes the default)
export function cleanDeckFormat(code: unknown): string {
  return DECK_FORMATS.some((f) => f.code === code) ? (code as string) : DEFAULT_DECK_FORMAT;
}

// The cards that never get the "too many copies" warning: the five basic
// lands, their snow-covered versions, and Wastes
const NO_WARNING_NAMES = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest',
  'snow-covered plains', 'snow-covered island', 'snow-covered swamp', 'snow-covered mountain', 'snow-covered forest',
  'wastes',
]);
export function skipsCopyWarning(name: string): boolean {
  return NO_WARNING_NAMES.has(name.trim().toLowerCase());
}
