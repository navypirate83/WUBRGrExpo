/* =====================================================================
   CARD PICTURES SAVED ON THIS PHONE
   Every card picture the app shows is also saved on the phone, in the
   app's own folder ("pictures"). The next time that picture is needed
   it comes from the phone: instant, no data used, and it works with no
   internet. (Pictures come straight from Scryfall's picture server;
   our own server never stores or sends them.)

   HOW IT WORKS
   - pictureSource() in http.ts asks localPictureFor() about every
     picture. If it's saved, it answers with the saved file. If not, it
     answers "not yet" (so the picture is shown from the internet as
     usual) and puts the picture in a short line to be saved in the
     background, two at a time.
   - THE LIMIT: all saved pictures together may take up to MAX_BYTES
     (3 GB). Past that, the pictures used LONGEST AGO are deleted first,
     so the ones you look at keep their place. Downloading also stops
     when the phone is nearly out of space, so it never fills the phone.
   - To know what was used when, the app remembers the last time each
     picture was shown. That notebook ("index.json") is written to the
     folder every so often, not on every picture.
   Only Scryfall's card pictures and card backs are saved (not the small
   symbol drawings).
   The website has its own, much simpler version: pictureCache.web.ts
   (browsers manage their own picture storage and don't allow a limit).
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Directory, File, Paths } from 'expo-file-system';
import { APP_HEADERS, setLocalPictureLookup } from './http';

// The most all the saved pictures may take together: 3 GB
export const MAX_PICTURE_BYTES = 3 * 1024 * 1024 * 1024;

// When the pictures go over the limit, delete down to this much, so the
// trimming doesn't have to run again after every single picture
const TRIM_TO_BYTES = Math.floor(MAX_PICTURE_BYTES * 0.9);

// Don't save any more pictures when the phone has less than this free (500 MB)
const KEEP_FREE_BYTES = 500 * 1024 * 1024;

// A picture bigger than this is not saved (a card picture is a few hundred KB)
const BIGGEST_PICTURE_BYTES = 8 * 1024 * 1024;

// How many pictures are downloaded at the same time
const DOWNLOADS_AT_ONCE = 2;

// After a picture fails to download, don't try it again for 10 minutes
const RETRY_AFTER_MS = 10 * 60 * 1000;

// How often the "last used" notebook is written (20 seconds, and only if it changed)
const SAVE_NOTEBOOK_EVERY_MS = 20 * 1000;

// Only these two picture servers of Scryfall's are saved
const SAVED_ADDRESS = /^https:\/\/(cards|backs)\.scryfall\.io\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;

// The folder, and the notebook inside it
const FOLDER = new Directory(Paths.document, 'pictures');
const NOTEBOOK_NAME = 'index.json';

// One saved picture: its file's name, how big it is, when it was last shown
type Entry = { uri: string; size: number; usedAt: number };

// Every saved picture, by file name (a copy in memory, so asking "is it
// saved?" is instant), and how many bytes they add up to
const saved = new Map<string, Entry>();
let totalBytes = 0;

// Pictures waiting to be saved (by file name, with their address), the
// ones being downloaded now, and the ones that failed recently
const waiting = new Map<string, string>();
const downloading = new Set<string>();
const failedAt = new Map<string, number>();

// Has the notebook changed since it was last written? Is a write planned?
let notebookChanged = false;
let notebookTimer: ReturnType<typeof setTimeout> | null = null;

// Has the folder been read yet? (Until then nothing counts as saved.)
let loaded = false;

// A short file name made from the picture's address. (A "hash": the same
// address always gives the same name, and different ones almost never do.)
function fileNameFor(url: string): string {
  let a = 0xdeadbeef;
  let b = 0x41c6ce57;
  for (let i = 0; i < url.length; i += 1) {
    const code = url.charCodeAt(i);
    a = Math.imul(a ^ code, 2654435761);
    b = Math.imul(b ^ code, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return `${(b >>> 0).toString(16)}${(a >>> 0).toString(16)}-${url.length}.img`;
}

/* ---------------------------------------------------------------------
   STARTING UP
   --------------------------------------------------------------------- */

// Read what's saved: the folder's files, and the notebook of when each
// was last used. Called once when the app starts (it doesn't hold the
// app up; pictures simply load from the internet until it's done).
export async function loadPictureCache(): Promise<void> {
  try {
    if (!FOLDER.exists) FOLDER.create({ intermediates: true, idempotent: true });

    // The notebook: { fileName: lastUsed }
    let lastUsed: Record<string, number> = {};
    try {
      const notebook = new File(FOLDER, NOTEBOOK_NAME);
      if (notebook.exists) lastUsed = JSON.parse(await notebook.text()) as Record<string, number>;
    } catch { /* unreadable notebook: the files' own dates are used instead */ }

    for (const item of FOLDER.list()) {
      if (!(item instanceof File) || item.name === NOTEBOOK_NAME) continue;
      const size = item.size ?? 0;
      if (size <= 0) { item.delete(); continue; }
      saved.set(item.name, { uri: item.uri, size, usedAt: lastUsed[item.name] ?? item.modificationTime ?? 0 });
      totalBytes += size;
    }
    loaded = true;
    trimIfNeeded();
  } catch {
    loaded = true;
  }
}

/* ---------------------------------------------------------------------
   ASKING FOR A PICTURE
   --------------------------------------------------------------------- */

// Where a picture is saved on this phone, or null if it isn't (yet).
// Either way, asking marks it as just used, and a picture that isn't
// saved is put in line to be.
export function localPictureFor(url: string): string | null {
  if (!loaded || !SAVED_ADDRESS.test(url)) return null;
  const name = fileNameFor(url);
  const entry = saved.get(name);
  if (entry) {
    entry.usedAt = Date.now();
    notebookChanged = true;
    planNotebookWrite();
    return entry.uri;
  }
  queuePicture(name, url);
  return null;
}

// Put a picture in line to be saved (unless it already is, or failed lately)
function queuePicture(name: string, url: string): void {
  if (waiting.has(name) || downloading.has(name)) return;
  const failed = failedAt.get(name);
  if (failed !== undefined && Date.now() - failed < RETRY_AFTER_MS) return;
  waiting.set(name, url);
  startDownloads();
}

// Start downloads until DOWNLOADS_AT_ONCE are running
function startDownloads(): void {
  while (downloading.size < DOWNLOADS_AT_ONCE && waiting.size > 0) {
    const [name, url] = waiting.entries().next().value as [string, string];
    waiting.delete(name);
    downloading.add(name);
    void download(name, url).finally(() => {
      downloading.delete(name);
      startDownloads();
    });
  }
}

// Is there room for more pictures (under the limit, and the phone not
// nearly full)?
function roomForMore(): boolean {
  try {
    return totalBytes < MAX_PICTURE_BYTES && Paths.availableDiskSpace > KEEP_FREE_BYTES;
  } catch {
    return totalBytes < MAX_PICTURE_BYTES;
  }
}

// Download one picture into the folder, and note it as saved. Returns
// true if it's saved now. Never throws: a picture that can't be saved
// just keeps loading from the internet.
async function download(name: string, url: string): Promise<boolean> {
  if (saved.has(name)) return true;
  if (!roomForMore()) return false;
  try {
    const file = new File(FOLDER, name);
    await File.downloadFileAsync(url, file, { headers: APP_HEADERS, idempotent: true });
    const size = file.size ?? 0;
    if (size <= 0 || size > BIGGEST_PICTURE_BYTES) {
      file.delete();
      failedAt.set(name, Date.now());
      return false;
    }
    saved.set(name, { uri: file.uri, size, usedAt: Date.now() });
    totalBytes += size;
    notebookChanged = true;
    planNotebookWrite();
    trimIfNeeded();
    return true;
  } catch {
    failedAt.set(name, Date.now());
    return false;
  }
}

/* ---------------------------------------------------------------------
   KEEPING UNDER THE LIMIT
   --------------------------------------------------------------------- */

// Over the limit? Delete the pictures used longest ago until the total
// is down to TRIM_TO_BYTES.
function trimIfNeeded(): void {
  if (totalBytes <= MAX_PICTURE_BYTES) return;
  const oldestFirst = [...saved.entries()].sort((x, y) => x[1].usedAt - y[1].usedAt);
  for (const [name, entry] of oldestFirst) {
    if (totalBytes <= TRIM_TO_BYTES) break;
    try { new File(FOLDER, name).delete(); } catch { /* already gone */ }
    saved.delete(name);
    totalBytes -= entry.size;
  }
  notebookChanged = true;
  planNotebookWrite();
}

// Write the "last used" notebook soon (once, however many pictures were
// shown in the meantime)
function planNotebookWrite(): void {
  if (notebookTimer) return;
  notebookTimer = setTimeout(() => {
    notebookTimer = null;
    if (!notebookChanged) return;
    notebookChanged = false;
    try {
      const notebook: Record<string, number> = {};
      for (const [name, entry] of saved) notebook[name] = entry.usedAt;
      const file = new File(FOLDER, NOTEBOOK_NAME);
      if (!file.exists) file.create();
      file.write(JSON.stringify(notebook));
    } catch { /* the notebook is a nicety: the files' own dates still work */ }
  }, SAVE_NOTEBOOK_EVERY_MS);
}

/* ---------------------------------------------------------------------
   WHAT SETTINGS CAN DO
   --------------------------------------------------------------------- */

// How much is saved: how many pictures and how many bytes, and the limit
export function pictureCacheStats(): { count: number; bytes: number; limit: number } {
  return { count: saved.size, bytes: totalBytes, limit: MAX_PICTURE_BYTES };
}

// Save every one of these pictures now (the ones not saved yet), a few at
// a time, telling onProgress how far along it is. Stops early when the
// limit is reached or the phone is nearly full. Returns how many are
// saved and how many couldn't be.
export async function savePicturesNow(
  urls: string[],
  onProgress: (done: number, total: number) => void,
): Promise<{ saved: number; failed: number; stoppedEarly: boolean }> {
  const todo = [...new Set(urls)]
    .filter((url) => SAVED_ADDRESS.test(url))
    .map((url) => ({ url, name: fileNameFor(url) }))
    .filter(({ name }) => !saved.has(name));
  let done = 0;
  let savedCount = 0;
  let failed = 0;
  let stoppedEarly = false;
  onProgress(0, todo.length);

  // Several workers each take the next picture from the list
  let next = 0;
  async function worker() {
    while (next < todo.length) {
      if (!roomForMore()) { stoppedEarly = true; return; }
      const { url, name } = todo[next++];
      // If it's already in the background line, that line must not do it too
      waiting.delete(name);
      if (await download(name, url)) savedCount += 1; else failed += 1;
      done += 1;
      onProgress(done, todo.length);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  return { saved: savedCount, failed, stoppedEarly };
}

// Delete every saved picture
export async function clearPictureCache(): Promise<void> {
  waiting.clear();
  try {
    if (FOLDER.exists) FOLDER.delete();
    FOLDER.create({ intermediates: true, idempotent: true });
  } catch { /* can't clear: the next start tries again to read what's left */ }
  saved.clear();
  failedAt.clear();
  totalBytes = 0;
  notebookChanged = false;
}

// Plug in to pictureSource() in http.ts (done once, when this file loads)
setLocalPictureLookup(localPictureFor);
