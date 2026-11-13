/* =====================================================================
   DECKS AS .CSV (spreadsheet) FILES
   A deck is downloaded as a .csv file: one card per line, in the deck's
   order. The columns are a list's (see listCsv.ts: they start with a
   ManaBox collection export's, so card apps can read the file), with the
   deck's own three at the end instead of "List":
     - Deck: the deck's name, repeated on every line
     - Format: the deck's format, like Commander
     - Zone: where the card is kept: main, sideboard, or command (a commander,
       partner, Oathbreaker or signature spell)
   Plain TypeScript with no React in it.
   ===================================================================== */

import { csvValue, scryfallIdFrom } from './listCsv';
import { deckFormat } from './deckFormats';
import type { Deck } from './deckStorage';

// Every column, in order
const DECK_COLUMNS = [
  'Name', 'Set code', 'Set name', 'Collector number', 'Foil', 'Rarity', 'Quantity',
  'Scryfall ID', 'Language', 'Added', 'Side', 'Mana cost', 'Type', 'Deck', 'Format', 'Zone',
];

// The whole deck as the text of a .csv file: the line of column names,
// then one line per card, in the deck's order
export function deckToCsv(deck: Deck): string {
  const lines = [DECK_COLUMNS.join(',')];
  const format = deckFormat(deck.format).name;
  for (const card of deck.cards) {
    const extra = card.extra ?? {};
    const values: Record<string, string> = {
      'Name': card.name,
      'Set code': card.set.toUpperCase(),
      'Set name': extra['Set name'] ?? '',
      'Collector number': card.number,
      'Foil': card.foil ? 'foil' : 'normal',
      'Rarity': extra.Rarity ?? '',
      'Quantity': String(card.count ?? 1),
      'Scryfall ID': scryfallIdFrom(card.image),
      'Language': card.lang ?? 'en',
      'Added': card.added ?? '',
      'Side': card.face === 1 ? 'back' : 'front',
      'Mana cost': card.manaCost,
      'Type': card.typeLine,
      'Deck': deck.name,
      'Format': format,
      'Zone': card.zone === 'side' ? 'sideboard' : card.zone === 'command' ? 'command' : 'main',
    };
    lines.push(DECK_COLUMNS.map((column) => csvValue(values[column])).join(','));
  }
  return lines.join('\n') + '\n';
}
