/* =====================================================================
   DOWNLOADING A BINDER OR A LIST AS A .CSV FILE (on the web)
   Saves one binder to the computer as a .csv file: its cards
   (one per line, with the page and pocket each is in) and its name,
   cover symbol, cover color and pages, the same as its Google Drive file
   (see binderCsv.ts). Used by the download button beside the binder's
   name at the top of a binder's page (and its D key), and the one at
   the top of a list's page (a list's file: see listCsv.ts).
   (Phones have their own version, binderDownload.ts, which opens the
   phone's Share menu instead.)
   Plain TypeScript with no React in it.
   ===================================================================== */

import { binderDetails, loadBinder } from './binderStorage';
import { binderToCsv } from './binderCsv';
import { findList } from './listStorage';
import { listToCsv } from './listCsv';

// Save the binder as it is in this browser (its newest copy: every change
// is saved here first). The file is named like "Binder 1 2026-10-16.csv".
export async function downloadBinderCsv(id: string): Promise<void> {
  const details = binderDetails(id);
  saveCsv(details.name, binderToCsv(details, loadBinder(id)));
}

// The same for a list
export async function downloadListCsv(id: string): Promise<void> {
  const list = findList(id);
  if (list) saveCsv(list.name, listToCsv(list));
}

// Have the browser save a .csv file with this name (before the date) and text
function saveCsv(name: string, text: string) {
  const file = new Blob([text], { type: 'text/csv' });
  // The browser saves files from a link, so make an invisible link to the
  // file's contents, "click" it, then clean up.
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  // The name (characters not allowed in file names removed), and today's date
  link.download = `${name.replace(/[\\/:*?"<>|]/g, '')} ${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);   // free the memory the file was using
}
