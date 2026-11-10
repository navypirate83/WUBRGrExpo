/* =====================================================================
   BINDERS AS .CSV FILES (server side)
   The same columns the app writes (ManaBox's, plus Page, Pocket, Side,
   Binder, Cover symbol, Cover color, Pages, Page layout), so a file
   exported here opens in ManaBox and spreadsheets, and one exported
   from the app can be uploaded here.
   ===================================================================== */

import { parse } from 'csv-parse/sync';

// Every column, in order (must match CSV_COLUMNS in the app's binderCsv.ts)
export const CSV_COLUMNS = [
  'Name', 'Set code', 'Set name', 'Collector number', 'Foil', 'Rarity', 'Quantity',
  'Scryfall ID', 'Purchase price', 'Condition', 'Language', 'Proxy',
  'Purchase price currency', 'Added',
  'Page', 'Pocket', 'Side', 'Binder', 'Cover symbol', 'Cover color', 'Pages', 'Page layout',
];

// The ManaBox columns WUBRG'r doesn't use itself: kept in a card's "extra"
export const KEPT_COLUMNS = {
  'Set name': '',
  'Rarity': '',
  'Purchase price': '',
  'Condition': 'near_mint',
  'Proxy': 'false',
  'Purchase price currency': 'USD',
};

// Other names other apps (Moxfield, Archidekt...) use for the same columns,
// compared in lowercase with spaces and underscores taken out
const OTHER_NAMES = {
  'Quantity': ['count', 'qty', 'amount'],
  'Set code': ['edition', 'set', 'editioncode', 'setcode'],
  'Collector number': ['cardnumber', 'number', 'collectornumber', 'cn'],
  'Scryfall ID': ['scryfallid'],
  'Added': ['dateadded'],
  'Set name': ['editionname'],
  'Foil': ['finish', 'printing'],
};

// A column name with case, spaces and underscores ignored
const plain = (name) => name.toLowerCase().replace(/[\s_]+/g, '');

// A value made safe for a .csv file. A value with a comma, quote mark or
// line break goes inside quote marks. A value starting with = + - or @
// could run as a formula when opened in Excel, so it gets an apostrophe
// in front (a spreadsheet shows it as plain text).
function csvValue(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// The picture's Scryfall ID, read from its address
function scryfallIdFrom(image) {
  return /\/(?:front|back)\/[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})\./i.exec(image)?.[1] ?? '';
}

// A binder and its cards as the text of a .csv file
export function binderToCsv(binder, cards) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const card of cards) {
    const extra = card.extra ?? {};
    const values = {
      'Name': card.name,
      'Set code': (card.set ?? '').toUpperCase(),
      'Collector number': card.number ?? '',
      'Foil': card.foil ? (extra.Foil === 'etched' ? 'etched' : 'foil') : 'normal',
      'Quantity': String(card.count ?? 1),
      'Scryfall ID': scryfallIdFrom(card.image ?? ''),
      'Language': card.lang ?? 'en',
      'Added': card.added ? new Date(card.added).toISOString() : '',
      'Page': String(card.page),
      'Pocket': String(card.pocket),
      'Side': card.face === 1 ? 'back' : 'front',
      'Binder': binder.name,
      'Cover symbol': binder.color ?? '',
      'Cover color': binder.cover,
      'Pages': String(binder.pages),
      'Page layout': binder.pageLayout ?? '4x4',
    };
    for (const [column, usual] of Object.entries(KEPT_COLUMNS)) values[column] = extra[column] ?? usual;
    lines.push(CSV_COLUMNS.map((column) => csvValue(values[column])).join(','));
  }
  return lines.join('\n') + '\n';
}

// Reads .csv text into rows of { column name: value }, with other apps'
// column names turned into ours. Throws a short message if it can't be read.
export function readCsvRows(text) {
  let table;
  try {
    table = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true, columns: false });
  } catch {
    throw new Error('That is not a readable .csv file');
  }
  if (table.length === 0) return [];
  const [header, ...rows] = table;
  // Which of our column names each column of the file means
  const nameFor = header.map((raw) => {
    const key = plain(String(raw));
    const exact = CSV_COLUMNS.find((column) => plain(column) === key);
    if (exact) return exact;
    for (const [column, others] of Object.entries(OTHER_NAMES)) if (others.includes(key)) return column;
    return String(raw).trim();
  });
  return rows.map((row) => {
    const record = {};
    nameFor.forEach((column, index) => {
      let value = (row[index] ?? '').trim();
      // Undo the apostrophe our own export adds in front of = + - @
      if (/^'[=+\-@]/.test(value)) value = value.slice(1);
      if (!(column in record)) record[column] = value;
    });
    return record;
  });
}
