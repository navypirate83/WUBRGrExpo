/* =====================================================================
   WHAT GOOGLE DRIVE LOOKED LIKE AT THE LAST SYNC
   To tell whether something changed in Google Drive since this phone
   last synced (for example, you edited a binder on the website), the
   phone remembers each binder and list file's "modified time" (the time
   Drive last changed that file), by the file's id:
     { "1AbC...": "2026-11-07T10:15:00.000Z", ... }
   When a file's time in Drive is different from the one remembered here,
   the file was changed somewhere else (see driveSync.ts, which asks
   which way to sync when that happens).
   Whenever this phone itself changes a file in Drive, it remembers the
   new time (noteDriveTime), so its own saves never look like changes
   made elsewhere.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { storageGet, storageRemove, storageSet } from './storage';

// Where the remembered times are kept on this device
const SNAPSHOT_KEY = 'driveSnapshot';

// File id → the time Drive last changed that file
export type Snapshot = Record<string, string>;

// The remembered times, or null if this phone has never synced (or the
// memory was reset)
export function readSnapshot(): Snapshot | null {
  try {
    const saved = JSON.parse(storageGet(SNAPSHOT_KEY) ?? 'null');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? (saved as Snapshot) : null;
  } catch {
    return null;
  }
}

// Remember these times (replacing everything remembered before)
export function writeSnapshot(snapshot: Snapshot): void {
  storageSet(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

// This phone just changed (or made) a file in Drive: remember its new
// time. (If the phone has never synced there's nothing to keep up to date.)
export function noteDriveTime(fileId: string, modifiedTime: string | undefined): void {
  if (!modifiedTime) return;
  const snapshot = readSnapshot();
  if (!snapshot) return;
  snapshot[fileId] = modifiedTime;
  writeSnapshot(snapshot);
}

// Forget everything (used by "Reset phone memory")
export function clearSnapshot(): void {
  storageRemove(SNAPSHOT_KEY);
}
