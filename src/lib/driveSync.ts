/* =====================================================================
   COMPARING THIS PHONE WITH GOOGLE DRIVE (and "Reset phone memory")
   The rules:
   1. THIS DEVICE KEEPS YOUR COLLECTION FOR GOOD. An expired Google
      pass, signing out, or Drive looking empty never removes anything
      from the phone. Only resetPhoneMemory() (Settings → "Reset phone
      memory") does.
   2. reconcileWithDrive() runs whenever the app reads Drive: connecting
      to Google, opening The Shelf or Lists, and pulling down to refresh.
      It compares the phone's binders and lists with Drive's:
      - NOTHING DIFFERENT: it just sends any waiting phone changes to
        Drive. No question.
      - ANYTHING DIFFERENT: something is only in Drive (a first install
        with a collection already in Drive, or one made on the website),
        something is only on the phone, or a file was changed in Drive
        since the last sync (see driveSnapshot.ts). Then it ASKS which
        way to sync, for the whole collection at once (syncChoice.ts):
          Phone to Drive: Drive becomes a copy of the phone (files only
            in Drive go to the Drive trash)
          Drive to phone: the phone becomes a copy of Drive (things only
            on the phone are removed from it)
          Not now: nothing changes
   Plain TypeScript with no React in it.
   ===================================================================== */

import {
  DriveError, createBinderFile, createListFile, disconnectGoogle, listBinderFiles, listListFiles,
  nameFromFileName, overwriteBinderFile, readBinderFile, readListFile, syncBinder, syncList,
  trashBinderFile, trashListFile, writeListFile, type BinderFile,
} from './googleDrive';
import {
  binderDirtyStamp, binderPages, clearAllBinders, clearBinderDirty, cleanCover, cleanPageCount,
  forgetBinder, hasBinderCopy, loadBinder, isCoverSymbol, loadBinderList, saveBinder, saveBinderList,
  setLocalMode, isLocalMode, type Binder,
} from './binderStorage';
import { deleteCards } from './cardStore';
import {
  clearAllListDirty, forgetAllLists, listDirtyStamp, loadLists, saveLists, type CardList,
} from './listStorage';
import { clearSnapshot, readSnapshot, writeSnapshot, type Snapshot } from './driveSnapshot';
import { askSyncDirection, type SyncQuestion } from './syncChoice';
import { storageRemove } from './storage';
import { clearSaved } from './cardCache';
import { forgetServerLinks } from './serverSync';

// How a reconcile ended: nothing to do, one of the two directions, or
// "Not now"
export type SyncResult = 'in-sync' | 'phone-to-drive' | 'drive-to-phone' | 'declined';

// Is a reconcile running right now? (Callers that arrive meanwhile share
// it, so only one question is ever asked.) And did the person say "Not
// now"? (Then screens that load by themselves don't ask again; refreshing
// or signing in does.)
let running: Promise<SyncResult> | null = null;
let declined = false;

// The times Drive last changed these files, by file id
function timesOf(files: BinderFile[]): Snapshot {
  const times: Snapshot = {};
  for (const file of files) if (file.modifiedTime) times[file.id] = file.modifiedTime;
  return times;
}

// Compare the phone with Drive, and sync (asking first when they differ).
// "fromUser" is true when the person asked for it (signing in, pulling
// down to refresh): then a "Not now" from before is forgotten and the
// question is asked again. Throws a DriveError if Drive can't be reached.
export function reconcileWithDrive(options: { fromUser?: boolean } = {}): Promise<SyncResult> {
  if (running) return running;
  if (declined && !options.fromUser) return Promise.resolve('declined');
  const run = doReconcile().finally(() => { running = null; });
  running = run;
  return run;
}

async function doReconcile(): Promise<SyncResult> {
  const wasLocal = isLocalMode();

  // What Drive has. (One after the other, not together: both ask for the
  // "MTG Card Binder" folder, which may need making.)
  const binderFiles = await listBinderFiles();
  const listFiles = await listListFiles();
  const driveFiles = [...binderFiles, ...listFiles];

  // What the phone has
  const phoneBinders = loadBinderList();
  const phoneLists = loadLists();

  // What's different
  const driveIds = new Set(driveFiles.map((file) => file.id));
  const phoneIds = new Set([...phoneBinders.map((b) => b.id), ...phoneLists.map((l) => l.id)]);
  const onlyDrive = driveFiles.filter((file) => !phoneIds.has(file.id)).length;
  const onlyPhone = [...phoneIds].filter((id) => !driveIds.has(id)).length;
  const snapshot = readSnapshot();
  // Files on both sides whose Drive time isn't the one remembered: changed
  // elsewhere. (A file the phone has no remembered time for isn't counted.)
  const changed = snapshot
    ? driveFiles.filter((file) => phoneIds.has(file.id) && snapshot[file.id] !== undefined && snapshot[file.id] !== file.modifiedTime).length
    : 0;

  // Nothing different: just send what's waiting on the phone
  if (onlyDrive === 0 && onlyPhone === 0 && changed === 0) {
    writeSnapshot(timesOf(driveFiles));
    // (The phone has never synced before, so there's no way to know the
    // files match: take Drive's version of every binder and list with no
    // waiting changes, the way the app always did before this check
    // existed.)
    if (!snapshot) await refreshCleanItems(phoneBinders, phoneLists);
    await sendWaitingChanges();
    if (wasLocal) setLocalMode(false);
    return 'in-sync';
  }

  // Something differs: ask which way to sync
  const question: SyncQuestion = {
    phone: { binders: phoneBinders.length, lists: phoneLists.length },
    drive: { binders: binderFiles.length, lists: listFiles.length },
    onlyDrive, onlyPhone, changed,
  };
  const answer = await askSyncDirection(question);
  if (!answer) { declined = true; return 'declined'; }
  declined = false;

  if (answer === 'drive-to-phone') await driveToPhone(binderFiles, listFiles);
  else await phoneToDrive(binderFiles, listFiles);
  if (wasLocal) setLocalMode(false);
  return answer;
}

/* ---------------------------------------------------------------------
   THE QUIET PARTS (no differences)
   --------------------------------------------------------------------- */

// Send every binder and list with changes waiting on the phone to Drive
async function sendWaitingChanges(): Promise<void> {
  for (const binder of loadBinderList()) if (binderDirtyStamp(binder.id)) await syncBinder(binder.id);
  for (const list of loadLists()) if (listDirtyStamp(list.id)) await syncList(list.id);
}

// Take Drive's cards for every binder and list the phone has no waiting
// changes for (only used the very first time, when nothing has been
// remembered). The phone's copy is only replaced after the download.
async function refreshCleanItems(binders: Binder[], lists: CardList[]): Promise<void> {
  for (const binder of binders) {
    if (binderDirtyStamp(binder.id) && hasBinderCopy(binder.id)) continue;
    saveBinder(await readBinderFile(binder.id), binder.id, { dirty: false });
  }
  const fresh = new Map<string, CardList['cards']>();
  for (const list of lists) if (!listDirtyStamp(list.id)) fresh.set(list.id, await readListFile(list.id));
  if (fresh.size) saveLists(loadLists().map((l) => (fresh.has(l.id) ? { ...l, cards: fresh.get(l.id)! } : l)));
}

/* ---------------------------------------------------------------------
   DRIVE TO PHONE
   --------------------------------------------------------------------- */

// Make the phone a copy of Drive. Everything is downloaded FIRST; only
// when all of it has arrived is the phone's copy changed, so a dropped
// connection can't leave the phone half-empty.
async function driveToPhone(binderFiles: BinderFile[], listFiles: BinderFile[]): Promise<void> {
  // The binders, in the order they were arranged (a binder with no saved
  // position goes after the others, oldest first)
  const rows = binderFiles.map((file) => {
    const labels = file.appProperties ?? {};
    return {
      order: labels.order !== undefined ? Number(labels.order) : Infinity,
      binder: {
        id: file.id,
        name: nameFromFileName(file.name),
        color: isCoverSymbol(labels.color) ? labels.color : null,
        cover: cleanCover(labels.cover),
        pages: cleanPageCount(labels.pages),
      } as Binder,
    };
  }).sort((a, b) => a.order - b.order);
  const ordered = rows.map((row) => row.binder);

  // Download everything
  const cards = await Promise.all(ordered.map((binder) => readBinderFile(binder.id)));
  const lists: CardList[] = await Promise.all(listFiles.map(async (file) => (
    { id: file.id, name: nameFromFileName(file.name), cards: await readListFile(file.id) })));

  // All here: now change the phone. First, remove what Drive doesn't have.
  const driveBinderIds = new Set(ordered.map((binder) => binder.id));
  for (const binder of loadBinderList()) if (!driveBinderIds.has(binder.id)) forgetBinder(binder.id);
  saveBinderList(ordered);
  ordered.forEach((binder, index) => {
    saveBinder(cards[index], binder.id, { dirty: false });
    clearBinderDirty(binder.id);
  });
  saveLists(lists);
  clearAllListDirty();

  writeSnapshot(timesOf([...binderFiles, ...listFiles]));
}

/* ---------------------------------------------------------------------
   PHONE TO DRIVE
   --------------------------------------------------------------------- */

// Make Drive a copy of the phone: send every binder and list (new ones
// are made in Drive), then move to the Drive trash whatever Drive has
// that the phone doesn't. Each new file's Drive id is saved on the phone
// straight away, so if something goes wrong part way, trying again
// carries on instead of making copies.
async function phoneToDrive(binderFiles: BinderFile[], listFiles: BinderFile[]): Promise<void> {
  const wasLocal = isLocalMode();
  setLocalMode(false);   // so the Drive functions really change Drive
  try {
    // Binders
    const driveBinderIds = new Set(binderFiles.map((file) => file.id));
    const phoneBinders = loadBinderList();
    for (const [index, binder] of phoneBinders.entries()) {
      if (driveBinderIds.has(binder.id)) {
        // (A binder this phone has no cards for is left alone in Drive:
        // sending nothing would empty it.)
        if (hasBinderCopy(binder.id)) await overwriteBinderFile(binder.id, index);
      } else {
        const cards = loadBinder(binder.id);
        const created = await createBinderFile(binder.name, cards, binder.color, index,
          cleanCover(binder.cover), binderPages(binder.id));
        saveBinder(cards, created.id, { dirty: false });
        saveBinderList(loadBinderList().map((b) => (b.id === binder.id ? { ...b, id: created.id } : b)));
        deleteCards(binder.id);
      }
      clearBinderDirty(binder.id);
    }
    const phoneBinderIds = new Set(phoneBinders.map((binder) => binder.id));
    for (const file of binderFiles) if (!phoneBinderIds.has(file.id)) await trashBinderFile(file.id);

    // Lists
    const driveListIds = new Set(listFiles.map((file) => file.id));
    const phoneLists = loadLists();
    for (const list of phoneLists) {
      if (driveListIds.has(list.id)) await writeListFile(list);
      else {
        const created = await createListFile(list.name, list.cards);
        saveLists(loadLists().map((l) => (l.id === list.id ? { ...l, id: created.id } : l)));
      }
    }
    clearAllListDirty();
    const phoneListIds = new Set(phoneLists.map((list) => list.id));
    for (const file of listFiles) if (!phoneListIds.has(file.id)) await trashListFile(file.id);

    // Remember how Drive looks now (read again, to get the new times)
    const binderFilesNow = await listBinderFiles();
    const listFilesNow = await listListFiles();
    writeSnapshot(timesOf([...binderFilesNow, ...listFilesNow]));
  } catch (err) {
    setLocalMode(wasLocal);
    if (err instanceof DriveError) throw err;
    throw new Error(`Couldn't finish sending your collection to Google Drive. ${(err as Error).message}`);
  }
}

/* ---------------------------------------------------------------------
   RESET PHONE MEMORY
   --------------------------------------------------------------------- */

// Clear this phone's collection and Google sign-in: every binder and
// list, their waiting-changes markers, the "using the app locally" mode,
// and the memory of the last sync, plus the card information saved for
// offline use (it downloads again when needed). Settings (theme, page
// layout...) stay.
// Google Drive is NOT touched. Afterwards the app is like a fresh
// install: connecting to Google asks which way to sync if Drive has files.
export async function resetPhoneMemory(): Promise<void> {
  try {
    await disconnectGoogle();
  } catch { /* couldn't tell Google: the pass is forgotten here anyway */ }
  clearAllBinders();
  forgetAllLists();
  setLocalMode(false);
  clearSnapshot();
  storageRemove('lastBinderId');
  // Forget which binders matched which on the WUBRG'r server. Otherwise
  // the next sync would take the now-empty device to mean "everything was
  // deleted here" and delete it all on the server. Instead, your binders
  // come back down from the server when you're logged in.
  forgetServerLinks();
  await clearSaved();
  declined = false;
}
