/* =====================================================================
   CARD INFORMATION SAVED ON THIS DEVICE (on phones)
   When you're logged in, card information (the list of card names, a
   card's details and printings, rulings...) is saved on the phone so
   it's still there with no internet. Each answer is its own small file
   in the app's own folder ("cardData").
   Why files and not AsyncStorage (where binders are kept)? AsyncStorage
   is read into memory every time the app starts, and the list of card
   names alone is almost a megabyte. Files are only read when needed.
   To keep this from growing forever, the oldest files are deleted once
   the folder passes MAX_BYTES. (Card PICTURES are different and are
   kept elsewhere, see pictureCache.ts.)
   The website has its own version: cardCache.web.ts.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Directory, File, Paths } from 'expo-file-system';

// What one saved answer looks like inside its file. The key is saved too,
// so a file that happens to share a name with another key is never
// mistaken for it.
export type SavedAnswer<T = unknown> = { key: string; savedAt: number; data: T };

// The folder for the files (made the first time it's needed)
const FOLDER = new Directory(Paths.document, 'cardData');

// All the saved answers together may take this many bytes (100 MB)
const MAX_BYTES = 100 * 1024 * 1024;

// How many saves between checks of the folder's size
const CHECK_EVERY = 25;
let savesSinceCheck = 0;

// A short, file-name-safe name made from the key. (A "hash": the same
// key always gives the same name, and different keys almost never do.)
function fileNameFor(key: string): string {
  let a = 0xdeadbeef;
  let b = 0x41c6ce57;
  for (let i = 0; i < key.length; i += 1) {
    const code = key.charCodeAt(i);
    a = Math.imul(a ^ code, 2654435761);
    b = Math.imul(b ^ code, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return `${(b >>> 0).toString(16)}${(a >>> 0).toString(16)}-${key.length}.json`;
}

// Read a saved answer, or null if there isn't one (or it can't be read)
export async function readSaved<T>(key: string): Promise<SavedAnswer<T> | null> {
  try {
    const file = new File(FOLDER, fileNameFor(key));
    if (!file.exists) return null;
    const saved = JSON.parse(await file.text()) as SavedAnswer<T>;
    return saved.key === key ? saved : null;
  } catch {
    return null;
  }
}

// Save an answer (replacing an older one for the same key). Never throws:
// being unable to save only means the answer isn't there next time.
export async function writeSaved(key: string, data: unknown, savedAt: number): Promise<void> {
  try {
    if (!FOLDER.exists) FOLDER.create({ intermediates: true, idempotent: true });
    const file = new File(FOLDER, fileNameFor(key));
    if (!file.exists) file.create();
    file.write(JSON.stringify({ key, savedAt, data } satisfies SavedAnswer));
    savesSinceCheck += 1;
    if (savesSinceCheck >= CHECK_EVERY) {
      savesSinceCheck = 0;
      trimOldFiles();
    }
  } catch {
    /* out of space or unwritable: carry on without saving */
  }
}

// Delete the oldest files until the folder is under MAX_BYTES
function trimOldFiles(): void {
  try {
    const files = FOLDER.list().filter((item): item is File => item instanceof File);
    let total = files.reduce((sum, file) => sum + (file.size ?? 0), 0);
    if (total <= MAX_BYTES) return;
    files.sort((x, y) => (x.modificationTime ?? 0) - (y.modificationTime ?? 0));
    for (const file of files) {
      if (total <= MAX_BYTES) break;
      total -= file.size ?? 0;
      file.delete();
    }
  } catch {
    /* trimming is a nicety: ignore trouble */
  }
}

// Delete every saved answer (used by "Reset device memory")
export async function clearSaved(): Promise<void> {
  try {
    if (FOLDER.exists) FOLDER.delete();
  } catch {
    /* nothing to clear, or can't: ignore */
  }
}
