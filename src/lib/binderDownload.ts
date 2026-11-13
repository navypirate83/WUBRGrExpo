/* =====================================================================
   SAVING A BINDER OR A LIST AS A .CSV FILE (on phones)
   Saves one binder as a .csv file: its cards (one per line, with the
   page and pocket each is in) and its name, cover symbol, cover color
   and pages, the same as its Google Drive file (see binderCsv.ts). A
   list is saved the same way, as its own Drive file is (see listCsv.ts).
   Phones have no "Downloads" folder like a computer, so the file is
   written to the app's own temporary folder (the "cache"), then the
   phone's Share menu opens, where the person can save it to Files,
   email it, send it to another app, and so on.
   (The web has its own version, binderDownload.web.ts, which downloads
   the file the way browsers do.)
   Plain TypeScript with no React in it.
   ===================================================================== */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { binderDetails, loadBinder } from './binderStorage';
import { binderToCsv } from './binderCsv';
import { findList } from './listStorage';
import { listToCsv } from './listCsv';
import { findDeck } from './deckStorage';
import { deckToCsv } from './deckCsv';

// The file name: the binder's name (characters not allowed in file
// names removed) and today's date, like "Binder 1 2026-10-16.csv"
function fileNameFor(name: string): string {
  return `${name.replace(/[\\/:*?"<>|]/g, '')} ${new Date().toISOString().slice(0, 10)}.csv`;
}

// Write a .csv file with this name (before the date) and text into the
// app's temporary folder, then open the Share menu for it
async function shareCsv(name: string, text: string): Promise<void> {
  const file = new File(Paths.cache, fileNameFor(name));
  // A file of the same name from earlier would make "create" fail, so
  // remove it first
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { dialogTitle: `Save ${name}`, mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  }
}

// Save the binder as it is on this device (its newest copy: every change
// is saved here first), then open the Share menu for it.
export async function downloadBinderCsv(id: string): Promise<void> {
  const details = binderDetails(id);
  await shareCsv(details.name, binderToCsv(details, loadBinder(id)));
}

// The same for a list
export async function downloadListCsv(id: string): Promise<void> {
  const list = findList(id);
  if (list) await shareCsv(list.name, listToCsv(list));
}

// The same for a deck
export async function downloadDeckCsv(id: string): Promise<void> {
  const deck = findDeck(id);
  if (deck) await shareCsv(deck.name, deckToCsv(deck));
}
