/* =====================================================================
   CARD HELPERS
   Small jobs about one printing of a card: its picture, its version
   label, its foil choices, its languages and format legality, grouping
   printings by set, and a link to share it. Plain TypeScript with no
   React in it (the binder pages will use some of these too).
   ===================================================================== */

import type { ImageUris, ScryfallCard } from './scryfall';

// The back of a Magic card: shown before a search, and instead of a card
// picture that's missing or won't download
export const CARD_BACK = 'https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';
export const CARD_BACK_ALT = 'Back of a Magic: The Gathering card';

// "1 set", "2 sets": add an "s" unless the count is exactly 1
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/* ---------------------------------------------------------------------
   SETS
   --------------------------------------------------------------------- */

// One set and the card's printings in it
export type SetGroup = {
  code: string;
  name: string;
  released: string;
  icon: string | null;
  prints: ScryfallCard[];
};

// Sort printings into groups, one group per set, newest set first.
// Inside each set, sort by collector number (1, 2, 10 — not 1, 10, 2).
// "icons" gives each set's symbol picture (if it has loaded yet).
export function groupBySet(prints: ScryfallCard[], icons?: Map<string, string>): SetGroup[] {
  const groups = new Map<string, SetGroup>();
  for (const print of prints) {
    let group = groups.get(print.set);
    if (!group) {
      group = {
        code: print.set,
        name: print.set_name,
        released: print.released_at,
        icon: icons?.get(print.set) ?? null,
        prints: [],
      };
      groups.set(print.set, group);
    }
    group.prints.push(print);
  }
  const list = [...groups.values()];
  list.sort((a, b) => b.released.localeCompare(a.released));
  for (const group of list) {
    group.prints.sort((a, b) =>
      a.collector_number.localeCompare(b.collector_number, undefined, { numeric: true }));
  }
  return list;
}

/* ---------------------------------------------------------------------
   VERSIONS
   --------------------------------------------------------------------- */

// Readable names for Scryfall's "frame effect" codes we want to show
const FRAME_EFFECT_NAMES: Record<string, string> = {
  showcase: 'Showcase',
  extendedart: 'Extended Art',
  inverted: 'Inverted',
};

// Build a readable label for one printing, e.g.
// "#287 · Borderless, Showcase · Nonfoil / Foil"
export function versionLabel(print: ScryfallCard): string {
  // Special looks this printing has
  const looks: string[] = [];
  if (print.border_color === 'borderless') looks.push('Borderless');
  if (print.full_art) looks.push('Full Art');
  if (print.textless) looks.push('Textless');
  // An old-style frame on a card printed after 2003 means a deliberate
  // "retro" reprint (original old cards just have the old frame normally).
  const oldFrame = print.frame === '1993' || print.frame === '1997';
  if (oldFrame && Number(print.released_at.slice(0, 4)) > 2003) looks.push('Retro Frame');
  for (const effect of print.frame_effects ?? []) {
    if (FRAME_EFFECT_NAMES[effect]) looks.push(FRAME_EFFECT_NAMES[effect]);
  }
  if (print.promo) looks.push('Promo');

  // Finishes it was printed in: "nonfoil" -> "Nonfoil", etc.
  const finishes = (print.finishes ?? []).map((f) => f[0].toUpperCase() + f.slice(1));

  // Join the pieces with " · ", skipping any that are empty.
  const parts = [`#${print.collector_number}`];
  if (looks.length) parts.push(looks.join(', '));
  if (finishes.length) parts.push(finishes.join(' / '));
  if (print.lang && print.lang !== 'en') parts.push(print.lang.toUpperCase());
  return parts.join(' · ');
}

/* ---------------------------------------------------------------------
   PICTURES AND SIDES
   --------------------------------------------------------------------- */

// Does this printing have a separate picture for its back side?
export function isDoubleSided(print: ScryfallCard): boolean {
  const faces = print.card_faces ?? [];
  return !print.image_uris && faces.length > 1 && Boolean(faces[1].image_uris);
}

// Find the picture address for one side of a printing (0 = front,
// 1 = back). Returns null when Scryfall has no real picture, so the card
// back can be shown instead. "sizes" says which picture size to use, in
// order of preference: the Search page uses "large" (or else "normal");
// binder pockets will use "normal".
export function imageFor(
  print: ScryfallCard,
  face: number,
  sizes: (keyof ImageUris)[] = ['large', 'normal'],
): string | null {
  if (print.image_status === 'missing' || print.image_status === 'placeholder') return null;
  // Single-sided cards keep their picture on the card itself;
  // double-sided cards keep one picture per side in card_faces.
  const uris = print.image_uris ?? print.card_faces?.[face]?.image_uris;
  if (!uris) return null;
  const size = sizes.find((s) => uris[s]);
  return size ? uris[size]! : null;
}

// The name of the side showing (double-sided cards), or the card's name
export function faceName(print: ScryfallCard, face: number): string {
  return isDoubleSided(print) ? print.card_faces![face].name : print.name;
}

// The casting cost (like "{1}{U}{U}") and type line (like "Creature — Elf
// Druid") of the side showing. A two-sided card keeps these on each side;
// a split card (like Fire // Ice) has both halves' costs on the card
// itself, joined with " // ". Empty text if Scryfall doesn't give one
// (a land has no casting cost).
export function costAndType(print: ScryfallCard, face: number): { manaCost: string; typeLine: string } {
  const side = isDoubleSided(print) ? print.card_faces?.[face] : undefined;
  return {
    manaCost: side?.mana_cost ?? print.mana_cost ?? '',
    typeLine: side?.type_line ?? print.type_line ?? '',
  };
}

// A casting cost as Scryfall's symbol pictures: "{2}{W/U}" becomes the
// pictures for "2" and "WU" (the "/" is left out of the picture's name).
// A split card's halves come back as separate groups.
export function manaSymbolGroups(cost: string): { symbol: string; url: string }[][] {
  return cost.split(' // ').filter(Boolean).map((half) =>
    [...half.matchAll(/\{([^}]+)\}/g)].map(([, symbol]) => ({
      symbol,
      url: `https://svgs.scryfall.io/card-symbols/${encodeURIComponent(symbol.replace(/\//g, ''))}.svg`,
    })));
}

/* ---------------------------------------------------------------------
   FINISHES: NOT FOIL, FOIL AND ETCHED
   Scryfall lists the finishes each printing was made in ("finishes"):
   "nonfoil", "foil" and/or "etched" (etched foil, a special silvery foil).
   There's no separate foil picture, so the Foil button just records which
   finish you have. Tapping it steps through the finishes the printing
   really comes in: not foil, foil, etched, and back round. A printing that
   comes in only one finish can't be changed.
   --------------------------------------------------------------------- */

export type Finish = 'nonfoil' | 'foil' | 'etched';

// The finishes a printing comes in, in the order the button steps through them
const FINISH_ORDER: Finish[] = ['nonfoil', 'foil', 'etched'];
export function finishChoices(print: ScryfallCard): Finish[] {
  const made = FINISH_ORDER.filter((finish) => (print.finishes ?? []).includes(finish));
  return made.length ? made : ['nonfoil'];
}

// The finish to use for this printing when you'd like "wanted". If the
// printing doesn't come in it: a printing with no plain version is always
// one of its foils; otherwise it's not foil.
export function finishFor(print: ScryfallCard, wanted: Finish): Finish {
  const made = finishChoices(print);
  if (made.includes(wanted)) return wanted;
  return made.includes('nonfoil') ? 'nonfoil' : made[0];
}

// The finish a Card Finder address asks for ("foil=1" is foil, "foil=etched"
// is etched, anything else is not foil)
export function finishFromParam(value: string | null | undefined): Finish {
  return value === 'etched' ? 'etched' : value === '1' ? 'foil' : 'nonfoil';
}

// The next finish when the button is tapped
export function nextFinish(print: ScryfallCard, current: Finish): Finish {
  const made = finishChoices(print);
  return made[(made.indexOf(current) + 1) % made.length];
}

/* ---------------------------------------------------------------------
   LANGUAGES
   --------------------------------------------------------------------- */

// Scryfall's language codes and the names we show for them.
// Any code not listed here is just shown in capitals (e.g. "XX").
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ja: 'Japanese', ko: 'Korean', ru: 'Russian',
  zhs: 'Chinese (Simplified)', zht: 'Chinese (Traditional)', he: 'Hebrew',
  la: 'Latin', grc: 'Ancient Greek', ar: 'Arabic', sa: 'Sanskrit',
  ph: 'Phyrexian', qya: 'Quenya',
};

// The name to show for a language code
export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? String(code).toUpperCase();
}

/* ---------------------------------------------------------------------
   FORMAT LEGALITY
   Scryfall's card details include "legalities": for each format (way of
   playing), whether the card is "legal", "not_legal", "banned" or
   "restricted" (allowed, but only one copy). It's the same for every
   printing of a card.
   --------------------------------------------------------------------- */

// The formats to show, in this order, with the names people know them by.
// Any format Scryfall adds later that isn't listed here still shows, at
// the end, under its code. (The Settings page lists these too, so each
// can be hidden.)
export const FORMAT_NAMES: [string, string][] = [
  ['standard', 'Standard'],          ['future', 'Future Standard'],
  ['pioneer', 'Pioneer'],            ['modern', 'Modern'],
  ['legacy', 'Legacy'],              ['vintage', 'Vintage'],
  ['pauper', 'Pauper'],              ['commander', 'Commander'],
  ['oathbreaker', 'Oathbreaker'],    ['paupercommander', 'Pauper Commander'],
  ['duel', 'Duel Commander'],        ['predh', 'PreDH'],
  ['tlr', 'Tiny Leaders: Reborn'],   ['brawl', 'Brawl'],
  ['standardbrawl', 'Standard Brawl'], ['competitivebrawl', 'Competitive Brawl'],
  ['historic', 'Historic'],          ['timeless', 'Timeless'],
  ['alchemy', 'Alchemy'],            ['gladiator', 'Gladiator'],
  ['penny', 'Penny Dreadful'],       ['premodern', 'Premodern'],
  ['oldschool', 'Old School 93/94'],
];

// The words shown on each status label
const LEGALITY_WORDS: Record<string, string> = {
  legal: 'Legal',
  not_legal: 'Not Legal',
  banned: 'Banned',
  restricted: 'Restricted',
};

// One line of the Format Legality box. "status" is one of the four
// known ones (an unknown status gets the grey "not_legal" look), and
// "word" is what its label says.
export type LegalityRow = { code: string; name: string; status: string; word: string };

// The Format Legality lines for a printing: our list first, then any
// formats we don't know the name of yet. "hidden" lists the codes of
// formats not to show (chosen in Settings).
export function legalityRows(print: ScryfallCard, hidden: string[] = []): LegalityRow[] {
  const legalities = print.legalities ?? {};
  const known = new Set(FORMAT_NAMES.map(([code]) => code));
  const formats = [
    ...FORMAT_NAMES.filter(([code]) => code in legalities),
    ...Object.keys(legalities).filter((code) => !known.has(code)).map((code): [string, string] => [code, code]),
  ];
  return formats.filter(([code]) => !hidden.includes(code)).map(([code, name]) => {
    const status = legalities[code];
    return {
      code,
      name,
      status: LEGALITY_WORDS[status] ? status : 'not_legal',
      word: LEGALITY_WORDS[status] ?? String(status),
    };
  });
}

/* ---------------------------------------------------------------------
   RULINGS
   --------------------------------------------------------------------- */

// Who published a ruling: Scryfall marks official ones as "wotc"
const RULING_SOURCES: Record<string, string> = { wotc: 'Wizards of the Coast', scryfall: 'Scryfall' };
export function rulingSource(source: string): string {
  return RULING_SOURCES[source] ?? source;
}

// Turn "2011-09-22" into a friendly date like "Sep 22, 2011".
// (timeZone UTC stops the date shifting a day in some time zones.)
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined,
    { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* ---------------------------------------------------------------------
   SHARING
   --------------------------------------------------------------------- */

// The parts of the address that pick one exact card on the Search page:
//   ?set=isd&number=51            (front side)
//   ?set=isd&number=51&face=back  (back side)
//   ?set=isd&number=51&lang=ja    (in Japanese)
//   ?set=isd&number=51&foil=1     (the foil copy)
//   ?set=isd&number=51&foil=etched (the etched foil copy)
// The set code + collector number pin down one specific printing.
// "lang" is only added when it isn't the printing's own language.
export function cardSearchParams(print: ScryfallCard, face: number, lang: string, finish: Finish): URLSearchParams {
  const params = new URLSearchParams();
  params.set('set', print.set);
  params.set('number', print.collector_number);
  if (face === 1) params.set('face', 'back');
  if (lang !== print.lang) params.set('lang', lang);
  if (finish === 'etched') params.set('foil', 'etched');
  else if (finish === 'foil') params.set('foil', '1');
  return params;
}
