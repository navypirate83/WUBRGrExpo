/* =====================================================================
   CARD INFORMATION SAVED IN THIS BROWSER (the website)
   The same job as cardCache.ts (see there), done the browser's way:
   IndexedDB, a small database every browser has. It is used instead of
   localStorage because the card names list alone is almost a megabyte
   and localStorage has only about 5 for everything.
   To keep this from growing forever, once there are more than
   MAX_ANSWERS saved answers the oldest are deleted.
   Plain TypeScript with no React in it.
   ===================================================================== */

export type SavedAnswer<T = unknown> = { key: string; savedAt: number; data: T };

const DATABASE = 'wubrgr-card-data';
const STORE = 'answers';
const MAX_ANSWERS = 3000;

// How many saves between checks of the count
const CHECK_EVERY = 50;
let savesSinceCheck = 0;

// Open the database (making the shelf for answers the first time).
// IndexedDB answers "a moment later", so this is wrapped in a promise.
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Wait for one database request to finish and give back its result
function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Read a saved answer, or null if there isn't one (or it can't be read)
export async function readSaved<T>(key: string): Promise<SavedAnswer<T> | null> {
  try {
    const database = await openDatabase();
    const saved = await done(database.transaction(STORE).objectStore(STORE).get(key));
    database.close();
    return (saved as SavedAnswer<T> | undefined) ?? null;
  } catch {
    return null;
  }
}

// Save an answer (replacing an older one for the same key). Never throws.
export async function writeSaved(key: string, data: unknown, savedAt: number): Promise<void> {
  try {
    const database = await openDatabase();
    await done(database.transaction(STORE, 'readwrite').objectStore(STORE).put({ key, savedAt, data }));
    database.close();
    savesSinceCheck += 1;
    if (savesSinceCheck >= CHECK_EVERY) {
      savesSinceCheck = 0;
      await trimOldAnswers();
    }
  } catch {
    /* private browsing or no space: carry on without saving */
  }
}

// Delete the oldest answers while there are more than MAX_ANSWERS
async function trimOldAnswers(): Promise<void> {
  try {
    const database = await openDatabase();
    const store = database.transaction(STORE, 'readwrite').objectStore(STORE);
    const all = (await done(store.getAll())) as SavedAnswer[];
    if (all.length > MAX_ANSWERS) {
      all.sort((x, y) => x.savedAt - y.savedAt);
      for (const old of all.slice(0, all.length - MAX_ANSWERS)) store.delete(old.key);
    }
    database.close();
  } catch {
    /* trimming is a nicety: ignore trouble */
  }
}

// Delete every saved answer (used by "Reset device memory")
export async function clearSaved(): Promise<void> {
  try {
    const database = await openDatabase();
    await done(database.transaction(STORE, 'readwrite').objectStore(STORE).clear());
    database.close();
  } catch {
    /* nothing to clear, or can't: ignore */
  }
}
