/* =====================================================================
   LISTS AS .CSV (spreadsheet) FILES
   Each list is saved as a .csv file (in Google Drive, and when it's
   downloaded): one card per line, in the list's order. The columns start
   with a ManaBox collection export's (so card apps can read the file),
   then WUBRG'r's own:
     - Side: which side of a two-sided card was picked (front or back)
     - Mana cost: like {1}{U}{U}
     - Type: like "Creature — Elf Druid"
     - List: the list's name, repeated on every line (like the Binder
       column in a binder's file)
   Plain TypeScript with no React in it.
   ===================================================================== */

import { CARD_BACK } from './cards';
import { parseCsv } from './binderCsv';
import type { CardList, ListCard } from './listStorage';

// Every column, in order
const LIST_COLUMNS = [
  'Name', 'Set code', 'Set name', 'Collector number', 'Foil', 'Rarity', 'Quantity',
  'Scryfall ID', 'Language', 'Added', 'Side', 'Mana cost', 'Type', 'List',
];

// One value made safe for a .csv file: a value with a comma, a quote mark
// or a line break in it goes inside quote marks (and any quote mark
// inside is doubled), which is how .csv files tell those apart from the
// commas between columns
function csvValue(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// The card's Scryfall ID, read from its picture's address (the long code
// at the end of cards.scryfall.io/normal/front/a/b/<ID>.jpg)
function scryfallIdFrom(image: string): string {
  return /\/(?:front|back)\/[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})\./i.exec(image)?.[1] ?? '';
}

// The whole list as the text of a .csv file: the line of column names,
// then one line per card, in the list's order
export function listToCsv(list: CardList): string {
  const lines = [LIST_COLUMNS.join(',')];
  for (const card of list.cards) {
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
      'List': list.name,
    };
    lines.push(LIST_COLUMNS.map((column) => csvValue(values[column])).join(','));
  }
  return lines.join('\n') + '\n';
}

// A list's cards from its .csv file, in order. Lines without a card name
// or set are skipped. (Columns are found by their names, so a file whose
// columns were moved around in a spreadsheet still reads.)
export function listCardsFromCsv(text: string): ListCard[] {
  const [header = [], ...rows] = parseCsv(text);
  const columnOf = new Map(header.map((name, index) => [name.trim().toLowerCase(), index]));
  const cards: ListCard[] = [];
  for (const row of rows) {
    // One value on this line, by its column's name ('' if it's missing)
    const get = (column: string) => (row[columnOf.get(column.toLowerCase()) ?? -1] ?? '').trim();
    const name = get('Name');
    const set = get('Set code').toLowerCase();
    if (!name || !set) continue;
    const face = get('Side').toLowerCase() === 'back' ? 1 : 0;
    const scryfallId = get('Scryfall ID').toLowerCase();
    const card: ListCard = {
      name,
      set,
      number: get('Collector number'),
      face,
      // The picture comes straight from the Scryfall ID (or the back of a
      // Magic card, without one)
      image: /^[0-9a-f-]{36}$/.test(scryfallId)
        ? `https://cards.scryfall.io/normal/${face ? 'back' : 'front'}/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`
        : CARD_BACK,
      manaCost: get('Mana cost'),
      typeLine: get('Type'),
    };
    const lang = get('Language').toLowerCase();
    if (lang && lang !== 'en') card.lang = lang;
    if (['foil', 'etched'].includes(get('Foil').toLowerCase())) card.foil = true;
    const quantity = Math.round(Number(get('Quantity')));
    if (quantity > 1) card.count = quantity;
    if (get('Added')) card.added = get('Added');
    const extra: Record<string, string> = {};
    if (get('Set name')) extra['Set name'] = get('Set name');
    if (get('Rarity')) extra.Rarity = get('Rarity');
    if (Object.keys(extra).length) card.extra = extra;
    cards.push(card);
  }
  return cards;
}
