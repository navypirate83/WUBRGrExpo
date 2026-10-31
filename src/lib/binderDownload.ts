/* =====================================================================
   SAVING A BINDER AS A .CSV FILE (on phones)
   Saves one binder as a .csv file: its cards (one per line, with the
   page and pocket each is in) and its name, cover symbol, cover color
   and pages, the same as its Google Drive file (see binderCsv.ts).
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

// The file name: the binder's name (characters not allowed in file
// names removed) and today's date, like "Binder 1 2026-10-16.csv"
function fileNameFor(name: string): string {
  return `${name.replace(/[\\/:*?"<>|]/g, '')} ${new Date().toISOString().slice(0, 10)}.csv`;
}

// Save the binder as it is on this device (its newest copy: every change
// is saved here first), then open the Share menu for it.
export async function downloadBinderCsv(id: string): Promise<void> {
  const details = binderDetails(id);
  const file = new File(Paths.cache, fileNameFor(details.name));
  // A file of the same name from earlier would make "create" fail, so
  // remove it first
  if (file.exists) file.delete();
  file.create();
  file.write(binderToCsv(details, loadBinder(id)));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { dialogTitle: `Save ${details.name}`, mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  }
}
