/* =====================================================================
   THE COMMAND ZONE'S RULES: WHICH CARDS GO IN WHICH SPOT
   A deck in a Commander-style format keeps some cards outside the deck
   itself (see deckFormats.ts and deckStorage.ts for where they live):
   - COMMANDER, DUEL COMMANDER, PREDH, PAUPER COMMANDER, TINY LEADERS: the
     first spot takes a commander. For Commander, Duel Commander and PreDH
     that is a legendary creature, or any card that says it can be your
     commander (some planeswalkers do). Pauper Commander takes an uncommon
     creature. Tiny Leaders takes the same as Commander, or a planeswalker, and
     the card's mana value must be 3 or less.
   - A SECOND SPOT appears only if the commander's own abilities call for one
     (and only in the formats that allow it, not Tiny Leaders):
       Partner                 another plain Partner card
       Partner with <name>     only that named card
       Partner—<kind>          another card with the same kind (Survivors, ...)
       Friends forever         another Friends forever card
       Choose a Background     a Background (an Enchantment — Background)
       Doctor's companion      a Time Lord Doctor (and a Time Lord Doctor
                               takes a Doctor's companion)
     A commander with none of these gets no second spot.
   - OATHBREAKER: the first spot takes a planeswalker, the second its
     signature spell: an instant or sorcery inside the planeswalker's color
     identity.
   Each spot's choices come from a Scryfall search ("slotQuery") so the app
   never has to guess from card text. A card's pairing abilities and color
   identity are worked out when it is put in the command zone and saved with
   it ("extra": see pairingsOf and colorIdentityOf).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { CARD_BACK, costAndType, imageFor } from './cards';
import { detailsOf } from './cardDetails';
import { searchCards, type ScryfallCard } from './scryfall';
import type { DeckFormat } from './deckFormats';
import type { DeckCard } from './deckStorage';

/* ---------------------------------------------------------------------
   WHAT A CARD ALLOWS: ITS PAIRING ABILITIES
   --------------------------------------------------------------------- */

// One way a commander can pair with a second card
export type Pairing = {
  kind: 'partner' | 'partner-with' | 'variant' | 'friends' | 'background' | 'companion' | 'doctor';
  value?: string;     // the named card (partner-with) or the kind of partner (variant)
};

// All the rules text of a card (a two-sided card keeps it on each side)
function rulesOf(print: ScryfallCard): string {
  return print.oracle_text ?? (print.card_faces ?? []).map((face) => face.oracle_text ?? '').join('\n');
}

// A card's type line (front side for a two-sided card)
function typeOf(print: ScryfallCard): string {
  return print.type_line ?? print.card_faces?.[0]?.type_line ?? '';
}

// The pairing abilities a card has
export function pairingsOf(print: ScryfallCard): Pairing[] {
  const text = rulesOf(print);
  const keywords = (print.keywords ?? []).map((k) => k.toLowerCase());
  const found: Pairing[] = [];
  const named = /Partner with ([^(\n]+?)(?:\s*\(|\n|$)/.exec(text);
  const variant = /Partner\s?—\s?([^(\n]+?)(?:\s*\(|\n|$)/.exec(text);
  if (named) found.push({ kind: 'partner-with', value: named[1].trim() });
  else if (variant) found.push({ kind: 'variant', value: variant[1].trim() });
  else if (keywords.includes('partner')) found.push({ kind: 'partner' });
  if (keywords.includes('friends forever')) found.push({ kind: 'friends' });
  if (keywords.includes('choose a background')) found.push({ kind: 'background' });
  if (keywords.includes("doctor's companion")) found.push({ kind: 'companion' });
  if (/Time Lord Doctor/i.test(typeOf(print))) found.push({ kind: 'doctor' });
  return found;
}

// A card's color identity, like ["U", "B"] (none: colorless)
export function colorIdentityOf(print: ScryfallCard): string[] {
  return [...(print.color_identity ?? [])].sort((a, b) => 'WUBRG'.indexOf(a) - 'WUBRG'.indexOf(b));
}

// What's saved with a command zone card: its pairings and its color identity
export function zoneExtraOf(print: ScryfallCard): Record<string, string> {
  return { Pairing: JSON.stringify(pairingsOf(print)), 'Color identity': colorIdentityOf(print).join('') || 'C' };
}

// A command zone card's pairings and color identity, read back
function savedPairings(card: DeckCard | undefined): Pairing[] {
  try { return JSON.parse(card?.extra?.Pairing ?? '[]') as Pairing[]; } catch { return []; }
}
function savedIdentity(card: DeckCard | undefined): string {
  const text = card?.extra?.['Color identity'] ?? '';
  return text === 'C' ? '' : text;
}

// A card in the deck's form, as the deck saves it (one copy, this printing)
export function deckCardFromPrint(print: ScryfallCard): DeckCard {
  return {
    name: print.name,
    set: print.set,
    number: print.collector_number,
    face: 0,
    image: imageFor(print, 0, ['normal', 'large']) ?? CARD_BACK,
    added: new Date().toISOString(),
    extra: detailsOf(print),
    ...costAndType(print, 0),
  };
}

/* ---------------------------------------------------------------------
   THE SPOTS
   --------------------------------------------------------------------- */

// Does this format have a command zone at all?
export const hasCommandZone = (format: DeckFormat): boolean => format.command !== undefined;

// Does the second spot show? Commander-style formats: only once the
// commander is chosen and has a pairing ability (and the format allows
// pairs). Oathbreaker: always (the signature spell).
export function secondSpotShows(format: DeckFormat, first: DeckCard | undefined): boolean {
  const zone = format.command;
  if (!zone) return false;
  if (zone.kind === 'oathbreaker') return true;
  return zone.pairs && first !== undefined && savedPairings(first).length > 0;
}

// What a spot is called
export function slotName(format: DeckFormat, slot: 0 | 1, first: DeckCard | undefined): string {
  if (format.command?.kind === 'oathbreaker') return slot === 0 ? 'Oathbreaker' : 'Signature spell';
  if (slot === 0) return 'Commander';
  const kinds = savedPairings(first).map((p) => p.kind);
  if (kinds.includes('background')) return 'Background';
  if (kinds.includes('companion')) return 'Time Lord Doctor';
  if (kinds.includes('doctor')) return "Doctor's companion";
  if (kinds.includes('friends')) return 'Friends forever';
  return 'Partner';
}

// What an empty spot says it needs
export function slotHint(format: DeckFormat, slot: 0 | 1, first: DeckCard | undefined): string {
  if (format.command?.kind === 'oathbreaker') {
    if (slot === 0) return 'A planeswalker';
    if (!first) return 'Choose your Oathbreaker first';
    const colors = savedIdentity(first);
    return `An instant or sorcery${colors ? ` in ${colors}` : ', colorless'}`;
  }
  if (slot === 0) return 'Tap to choose your commander';
  const name = slotName(format, 1, first);
  return name === 'Background' ? 'An Enchantment — Background' : `A card that pairs with your commander`;
}

/* ---------------------------------------------------------------------
   THE SEARCH FOR EACH SPOT (Scryfall's search words)
   --------------------------------------------------------------------- */

// A name inside quote marks for a search
const quoted = (name: string) => `"${name.replace(/"/g, '')}"`;

// The search that finds every card allowed in this spot, or null when the
// spot can't be searched yet (the signature spell, before the Oathbreaker is chosen)
export function slotQuery(format: DeckFormat, slot: 0 | 1, first: DeckCard | undefined): string | null {
  if (format.command?.kind === 'oathbreaker') {
    if (slot === 0) return 't:planeswalker';
    if (!first) return null;
    // The planeswalker's color identity: a card inside it (id<=ub), or only colorless (id<=c)
    return `(t:instant or t:sorcery) id<=${savedIdentity(first).toLowerCase() || 'c'}`;
  }
  if (slot === 0) {
    if (format.code === 'paupercommander') return 't:creature in:uncommon';
    if (format.code === 'tlr') return `(is:commander or t:planeswalker) cmc<=${format.maxManaValue ?? 3}`;
    return `is:commander legal:${format.code}`;
  }
  // The second spot: what the first card's abilities allow (any of them)
  const choices = savedPairings(first).map((p): string => {
    switch (p.kind) {
      case 'partner-with': return `!${quoted(p.value ?? '')}`;
      case 'variant': return `o:${quoted(`Partner—${p.value ?? ''}`)}`;
      case 'friends': return 'keyword:"friends forever"';
      case 'background': return 't:background';
      case 'companion': return 't:"time lord doctor"';
      case 'doctor': return `keyword:${quoted("doctor's companion")}`;
      default: return 'keyword:partner -o:"partner with" -o:"partner—"';
    }
  });
  if (choices.length === 0) return null;
  return choices.length === 1 ? choices[0] : `(${choices.map((c) => `(${c})`).join(' or ')})`;
}

// Is this card allowed in this spot? (Asks the same search, for just this
// card.) A spot that can't be searched yet allows nothing.
export async function allowedInSlot(format: DeckFormat, slot: 0 | 1, first: DeckCard | undefined, name: string): Promise<boolean> {
  const query = slotQuery(format, slot, first);
  if (!query) return false;
  const found = await searchCards(`(${query}) !${quoted(name)}`);
  return found.length > 0;
}
