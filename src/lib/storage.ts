/* =====================================================================
   SAVED VALUES (AsyncStorage)
   Everything the app keeps on this device (the list of binders, each
   binder's cards, settings, the theme...) is saved with AsyncStorage:
   React Native's simple store of named text values. It works on phones
   (a small database inside the app) and on the web (the browser's
   localStorage).
   AsyncStorage answers "a moment later" (asynchronously), but most of
   the app wants answers straight away. So:
     - when the app starts, loadStorage() reads every saved value into
       memory (the app waits for it before drawing anything)
     - reading then comes straight from memory
     - saving changes memory straight away, and writes to AsyncStorage
       in the background
   Every name is saved with "wubrgrexpo:" in front. On the web, this app
   and the original WUBRG'r site live at the same address
   (navypirate83.github.io), so they share the browser's localStorage;
   the prefix keeps each app's values apart.
   Plain TypeScript with no React in it.
   ===================================================================== */

import AsyncStorage from '@react-native-async-storage/async-storage';

// What goes in front of every saved name
const PREFIX = 'wubrgrexpo:';

// Every saved value, by name (without the prefix): the copy in memory
const values = new Map<string, string>();

// Did the last background save fail (e.g. the device is out of space)?
// Then storageSet says so, so the page can warn.
let lastWriteFailed = false;

// Read every saved value into memory. Called once, when the app starts.
// If AsyncStorage can't be read at all, the app starts with nothing saved.
export async function loadStorage(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [key, value] of pairs) {
      if (value !== null) values.set(key.slice(PREFIX.length), value);
    }
  } catch {
    /* storage unreadable: start empty */
  }
}

// Read a saved value, or null if there isn't one.
export function storageGet(key: string): string | null {
  return values.get(key) ?? null;
}

// Save a value: in memory straight away, then in AsyncStorage. Returns
// false if the last background save failed, so the page can warn.
export function storageSet(key: string, value: string): boolean {
  values.set(key, value);
  AsyncStorage.setItem(PREFIX + key, value).then(
    () => { lastWriteFailed = false; },
    () => { lastWriteFailed = true; },
  );
  return !lastWriteFailed;
}

// Forget a saved value.
export function storageRemove(key: string): void {
  values.delete(key);
  AsyncStorage.removeItem(PREFIX + key).catch(() => { /* already gone */ });
}

// Every saved name that starts with some text (like every binder's
// cards, "binderCards:..."), without the prefix.
export function storageKeys(startingWith: string): string[] {
  return [...values.keys()].filter((key) => key.startsWith(startingWith));
}
