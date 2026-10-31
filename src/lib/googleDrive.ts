/* =====================================================================
   GOOGLE SIGN-IN AND GOOGLE DRIVE
   How it works (the same as the original site):
   - "Sign in with Google" uses Google's own sign-in library (loaded from
     accounts.google.com). Google shows its own window where the person
     picks an account and agrees to let this site use Drive. In the phone
     app, the phone's own Google account picker does the same job (see
     phoneGoogleSignIn.ts).
   - Google hands back an "access token": a temporary pass (it lasts about
     an hour) that lets this site talk to that person's Google Drive.
   - We only ask for the "drive.file" permission: this site can see and
     change ONLY the files it created itself, nothing else in their Drive.
   - Each binder is one .csv file (a spreadsheet-style card list: see
     binderCsv.ts) inside a folder called "MTG Card Binder" in their
     Drive. The file's Drive id is also the binder's id. Binders saved
     before were .json files: those are turned into .csv files (see
     convertOldBinderFiles), and a backup copy of the .json is kept.
   - Each card list is a .csv file too (see listCsv.ts), in a "Lists"
     folder inside "MTG Card Binder" (so lists never show up among the
     binders, here or on the original site).
   - On the website, the access token is kept in sessionStorage, which is
     wiped when the browser tab closes, so the pass doesn't stay on the
     computer. In the phone app it's kept in the app's own storage, so
     the app stays signed in like other apps; when the pass runs out, the
     app quietly gets a new one from the phone's Google account.
   - LOCAL USE ONLY: the functions below that would change Drive (make,
     rename, delete or save a binder) just skip Drive, so the pages don't
     need to know the difference.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Platform } from 'react-native';
import { fetchOrExplain } from './http';
import { storageGet, storageRemove, storageSet } from './storage';
import { PHONE_SIGN_IN_AVAILABLE, phoneSignIn, phoneSignOut } from './phoneGoogleSignIn';
import { accountChanged } from './accountEvents';
import {
  DEFAULT_COVER, DEFAULT_PAGES,
  binderDetails, binderDirtyStamp, binderPages, cleanCards, cleanCover, cleanPageCount, clearAllBinders,
  forgetBinder, isLocalMode, loadBinder, loadBinderList, manaColor, markBinderSaved, newLocalBinderId,
  saveBinder, setLocalMode, type Binder, type BinderCards,
} from './binderStorage';
import { binderToCsv, cardsFromCsv } from './binderCsv';
import {
  addListToDevice, findList, forgetAllLists, forgetList, listDirtyStamp, loadLists, markListSaved,
  newLocalListId, saveLists, type CardList, type ListCard,
} from './listStorage';
import { listCardsFromCsv, listToCsv } from './listCsv';
import { askYesNo } from './dialogs';

// The site's Google Client ID: it tells Google which site is asking to
// sign in (it comes from Google Cloud Console, and isn't a secret).
// It's the same one as the original site, so the same Google setup works.
const GOOGLE_CLIENT_ID = '595038767611-a97c7o5tcg348tis5pcbul562n1k0tnl.apps.googleusercontent.com';

// The permission we ask for: only files this site creates (see above)
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// The folder the binders live in, inside the person's Google Drive. It
// keeps the original name on purpose: it's how the site finds people's
// binders, so changing it would make existing binders seem to disappear.
const DRIVE_FOLDER_NAME = 'MTG Card Binder';

// Where the access token and the folder's id are kept (see "session" below)
const TOKEN_KEY = 'googleToken';
const FOLDER_KEY = 'driveFolderId';

// Google Drive's web addresses for its API (the way programs talk to it)
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// Google's sign-in library, loaded from Google's own website
const GOOGLE_LIBRARY_URL = 'https://accounts.google.com/gsi/client';

/* ---------------------------------------------------------------------
   WHAT GOOGLE'S LIBRARY LOOKS LIKE
   The parts of Google's sign-in library this file uses, described for
   TypeScript ("declare global" adds them to "window").
   --------------------------------------------------------------------- */
type TokenResponse = { access_token: string; expires_in: number | string; error?: string };
type TokenClient = { requestAccessToken: () => void };
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback: (error: { type?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

// An error that knows whether it means "not signed in (or the sign-in
// ran out)". Pages check "signedOut" to send the person back to sign in.
export class DriveError extends Error {
  signedOut: boolean;
  constructor(message: string, signedOut = false) {
    super(message);
    this.signedOut = signedOut;
  }
}
function signedOutError() {
  return new DriveError('Your Google sign-in has expired. Please sign in again.', true);
}

/* ---------------------------------------------------------------------
   THE ACCESS TOKEN
   --------------------------------------------------------------------- */

// Where the sign-in pass and the remembered Drive folder ids are kept:
// on the website, sessionStorage (wiped when the tab closes); in the
// phone app, the app's own storage (phones keep apps signed in)
const session = Platform.OS === 'web'
  ? {
      get: (key: string) => sessionStorage.getItem(key),
      set: (key: string, value: string) => sessionStorage.setItem(key, value),
      remove: (key: string) => sessionStorage.removeItem(key),
    }
  : {
      get: (key: string) => storageGet(key),
      set: (key: string, value: string) => { storageSet(key, value); },
      remove: (key: string) => storageRemove(key),
    };

// Keep a new access token, and when it runs out (in this many seconds)
function keepAccessToken(accessToken: string, expiresInSeconds: number) {
  try {
    session.set(TOKEN_KEY, JSON.stringify({ accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 }));
  } catch { /* storage blocked: it still works until the page closes */ }
  accountChanged();
}

// The current access token, or null if there isn't one or it's about to
// run out (within a minute), in which case the person must sign in again.
function getAccessToken(): string | null {
  try {
    const saved = JSON.parse(session.get(TOKEN_KEY) ?? 'null');
    if (saved && saved.expiresAt > Date.now() + 60 * 1000) return saved.accessToken;
  } catch { /* nothing saved, or storage blocked */ }
  return null;
}

// Are we connected to Google Drive right now?
export function isSignedIn(): boolean {
  return getAccessToken() !== null;
}

// Forget the access token (it expired, or the person signed out).
function forgetAccessToken(): void {
  try {
    session.remove(TOKEN_KEY);
    session.remove(FOLDER_KEY);
    session.remove('settingsFileId');     // the settings file's id (see THE SETTINGS FILE)
    session.remove('driveListFolderId');  // the Lists folder's id (see LISTS)
  } catch { /* storage blocked: nothing to forget */ }
  accountChanged();
}

// Is someone using the binders? True when signed in to Google in this
// tab, OR when using the site locally, OR when their binders are still
// kept in this browser (the Google pass may have run out, but they
// haven't signed out: Sign out is what clears the binders).
export function isUsingBinders(): boolean {
  return isSignedIn() || isLocalMode() || loadBinderList().length > 0;
}

/* ---------------------------------------------------------------------
   SIGNING IN AND OUT
   --------------------------------------------------------------------- */

// Google's sign-in helper (made once the library has loaded), the
// getting-ready step (kept so it only runs once), and the sign-in in
// progress (so Google's answer can finish it)
let tokenClient: TokenClient | null = null;
let googleSignInReady: Promise<void> | null = null;
let pendingSignIn: { resolve: () => void; reject: (err: Error) => void } | null = null;

// Load Google's sign-in library (once), and wait until it's ready.
// Gives up after 10 seconds.
function loadGoogleLibrary(): Promise<void> {
  // Phones have no web page ("document") to load it into: Google sign-in
  // there needs the full app build, so say so instead of crashing
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Google sign-in isn\'t available in this version of the app yet.'));
  }
  if (!document.querySelector(`script[src="${GOOGLE_LIBRARY_URL}"]`)) {
    const script = document.createElement('script');
    script.src = GOOGLE_LIBRARY_URL;
    script.async = true;
    document.head.appendChild(script);
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    (function check() {
      if (window.google?.accounts?.oauth2) resolve();
      else if (Date.now() - started > 10000) {
        reject(new Error('Google sign-in didn\'t load. Check your internet connection and reload the page.'));
      } else setTimeout(check, 100);
    })();
  });
}

// Get Google's sign-in helper ready. Pages call this as soon as they
// open, so clicking "Sign in" can open Google's window straight away
// (browsers only allow pop-up windows right after a click). Calling it
// again just waits for the first call to finish.
export function initGoogleSignIn(): Promise<void> {
  // The phone app's sign-in needs nothing loaded first
  if (Platform.OS !== 'web') return Promise.resolve();
  if (!googleSignInReady) {
    googleSignInReady = loadGoogleLibrary().then(() => {
      tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        // Google's answer when the person finishes in the sign-in window
        callback: (response) => {
          const done = pendingSignIn;
          pendingSignIn = null;
          if (!done) return;
          if (response.error) {
            done.reject(new Error('Google sign-in didn\'t finish. Please try again.'));
            return;
          }
          // Keep the pass, and when it runs out (Google says how many seconds).
          keepAccessToken(response.access_token, Number(response.expires_in));
          done.resolve();
        },
        // The sign-in window was closed, or couldn't open (pop-up blocked)
        error_callback: (error) => {
          const done = pendingSignIn;
          pendingSignIn = null;
          if (!done) return;
          done.reject(new Error(error?.type === 'popup_closed'
            ? 'Sign-in was cancelled.'
            : 'Google\'s sign-in window couldn\'t open. Allow pop-ups for this site and try again.'));
        },
      });
    });
    // If loading fails, let a later call try again.
    googleSignInReady.catch(() => { googleSignInReady = null; });
  }
  return googleSignInReady;
}

// How long the phone app treats a new pass as good for (seconds). Google's
// passes last an hour; this is a little less, so a new one is fetched
// before the old one is refused.
const PHONE_TOKEN_SECONDS = 55 * 60;

// In the phone app: get a pass from the phone's Google account and keep
// it ("quiet": only if that needs no questions)
async function phoneSignInAndKeep(quiet: boolean): Promise<void> {
  keepAccessToken(await phoneSignIn(GOOGLE_CLIENT_ID, DRIVE_SCOPE, quiet), PHONE_TOKEN_SECONDS);
}

// Open Google's sign-in window (in the phone app, the phone's account
// picker). Call this straight from a button click. Resolves when signed
// in; rejects with a message if not.
export function signInWithGoogle(): Promise<void> {
  if (Platform.OS !== 'web') return phoneSignInAndKeep(false);
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google sign-in is still loading. Please try again in a moment.'));
      return;
    }
    pendingSignIn = { resolve, reject };
    tokenClient.requestAccessToken();
  });
}

// The full "Sign out" (the link at the bottom right of every page):
//  1. save any binder changes that haven't reached Google Drive yet (if
//     that fails, ask before throwing those changes away)
//  2. tell Google to cancel the pass, and forget it here
//  3. forget the binders and lists kept in this browser, so the next
//     person on this computer doesn't see them
// Returns true if signed out, false if the person chose to stay signed in.
export async function signOutAndForget(): Promise<boolean> {
  const unsaved = loadBinderList().filter((b) => binderDirtyStamp(b.id));
  const unsavedLists = loadLists().filter((l) => listDirtyStamp(l.id));
  try {
    await Promise.all([...unsaved.map((b) => syncBinder(b.id)), ...unsavedLists.map((l) => syncList(l.id))]);
  } catch {
    // (askYesNo shows the phone's or browser's own yes/no box: see dialogs.ts)
    const signOutAnyway = await askYesNo('Sign out anyway?',
      'Some changes couldn\'t be saved to Google Drive and will be lost if you sign out.', 'Sign out', 'Cancel');
    if (!signOutAnyway) return false;
  }
  const token = getAccessToken();
  if (Platform.OS === 'web') { if (token) window.google?.accounts?.oauth2?.revoke(token, () => {}); }
  else await phoneSignOut();
  forgetAccessToken();
  clearAllBinders();
  forgetAllLists();
  return true;
}

/* ---------------------------------------------------------------------
   TALKING TO GOOGLE DRIVE
   --------------------------------------------------------------------- */

// Send a request to Google Drive with the access token attached. Throws
// a "signed out" error if the token is missing or Google rejects it, and
// a normal error (with Google's message) for any other problem.
async function driveRequest(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();
  // The phone app: the pass ran out, so quietly get a new one from the
  // phone's Google account (someone who signed in before)
  if (!token && PHONE_SIGN_IN_AVAILABLE) {
    try {
      await phoneSignInAndKeep(true);
      token = getAccessToken();
    } catch { /* not signed in on this phone: carry on to "signed out" */ }
  }
  if (!token) throw signedOutError();
  const response = await fetchOrExplain(url, {
    ...options,
    headers: { ...(options.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
  }, 'Google Drive');
  if (response.status === 401) {           // 401 = "not allowed": the pass ran out
    forgetAccessToken();
    throw signedOutError();
  }
  if (!response.ok) {
    let message = `Google Drive error (${response.status}).`;
    try {
      const body = await response.json();
      if (body.error?.message) message = `Google Drive: ${body.error.message}`;
    } catch { /* the error had no readable details */ }
    throw new DriveError(message);
  }
  return response;
}

// Who is signed in: { displayName, emailAddress }
export async function getDriveUser(): Promise<{ displayName?: string; emailAddress?: string }> {
  const response = await driveRequest(`${DRIVE_API}/about?fields=user(displayName,emailAddress)`);
  return (await response.json()).user;
}

// Find the "MTG Card Binder" folder in their Drive, or make it if it's
// not there yet. Its id is remembered for this tab so we only look once.
async function getBinderFolderId(): Promise<string> {
  try {
    const remembered = session.get(FOLDER_KEY);
    if (remembered) return remembered;
  } catch { /* storage blocked: just look it up */ }

  // Drive's search language: a folder with this exact name, not in the trash.
  const query = `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`);
  let folderId: string | undefined = (await found.json()).files[0]?.id;

  if (!folderId) {
    const created = await driveRequest(`${DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    });
    folderId = (await created.json()).id as string;
  }

  try { session.set(FOLDER_KEY, folderId); } catch { /* fine */ }
  return folderId;
}

// One binder file in Drive: its id, its file name ("Binder 1.csv"), and
// the small labels this site stores on it, like { color: "U", pages:
// "10", order: "2" } (see createBinderFile and updateBinderDetails).
// The labels let the shelf show every binder's cover and order without
// opening every file.
export type BinderFile = { id: string; name: string; appProperties?: Record<string, string> };

// The file type Drive is told a binder file is (a .csv file)
const CSV_TYPE = 'text/csv';

// The label put on the backup copy of an old .json binder, so it's never
// turned into a .csv file itself: { wubrgr: "backup", backupOf: <the
// binder's id> }
const BACKUP_LABEL = 'backup';

// A file's details and its contents together in one "multipart" message
// (how Drive takes both at once): two parts separated by a "boundary"
// line that appears nowhere else. Returns what to send: the body, and
// the header saying where the boundary is.
function multipart(details: Record<string, unknown>, contentType: string, contents: string) {
  const boundary = `wubrgr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body:
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(details)}\r\n` +
      `--${boundary}\r\nContent-Type: ${contentType}; charset=UTF-8\r\n\r\n` +
      `${contents}\r\n` +
      `--${boundary}--`,
  };
}

// Every file in the folder that matches a Drive search, oldest first.
// Drive hands lists back in batches (up to 1000 files each) with a
// "nextPageToken" when there are more, so keep asking until there's none.
async function listFiles(query: string): Promise<BinderFile[]> {
  const files: BinderFile[] = [];
  let pageToken = '';
  do {
    const response = await driveRequest(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}` +
      '&fields=nextPageToken,files(id,name,appProperties)&orderBy=createdTime&pageSize=1000' +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''));
    const batch = await response.json();
    files.push(...batch.files);
    pageToken = batch.nextPageToken ?? '';
  } while (pageToken);
  return files;
}

// Turn the binders saved before as .json files into .csv files. For each
// old binder file (once):
//  1. make a backup copy of it, still a .json file, labeled as a backup
//     (the original card-binder site can still open these copies)
//  2. replace the file's contents with the same binder as a .csv file,
//     and rename it ("Binder 1.json" → "Binder 1.csv")
// The binder keeps the same file, so its id (and links to it), labels and
// shelf position stay the same. A file that can't be read is left alone.
async function convertOldBinderFiles(folderId: string): Promise<void> {
  const oldFiles = await listFiles(`'${folderId}' in parents and mimeType='application/json' and trashed=false`);
  const isBackup = (file: BinderFile) => file.appProperties?.wubrgr === BACKUP_LABEL;
  // The binders that already have a backup copy (if a change was cut off
  // part way, trying again doesn't make a second copy)
  const backedUp = new Set(oldFiles.filter(isBackup).map((file) => file.appProperties?.backupOf));

  for (const file of oldFiles.filter((f) => !isBackup(f))) {
    let data: { cards?: unknown };
    try {
      const response = await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`);
      data = await response.json();
    } catch (err) {
      if ((err as DriveError).signedOut) throw err;
      continue;   // unreadable: leave this one as it is
    }

    // 1. The backup copy (keeping the same name)
    if (!backedUp.has(file.id)) {
      await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(file.id)}/copy?fields=id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, parents: [folderId], appProperties: { wubrgr: BACKUP_LABEL, backupOf: file.id } }),
      });
    }

    // 2. The same binder as a .csv file: its cards, and its name, cover
    //    and pages (from the file's name and labels)
    const labels = file.appProperties ?? {};
    const details: Omit<Binder, 'id'> = {
      name: nameFromFileName(file.name),
      color: manaColor(labels.color) ? labels.color : null,
      cover: cleanCover(labels.cover),
      pages: cleanPageCount(labels.pages),
    };
    const { cards } = cleanCards(data?.cards);
    await driveRequest(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(file.id)}?uploadType=multipart`, {
      method: 'PATCH',
      ...multipart({ name: `${details.name}.csv`, mimeType: CSV_TYPE }, CSV_TYPE, binderToCsv(details, cards)),
    });
  }
}

// List the binder files in the folder, oldest first (after turning any
// old .json binder files into .csv ones).
export async function listBinderFiles(): Promise<BinderFile[]> {
  const folderId = await getBinderFolderId();
  await convertOldBinderFiles(folderId);
  return listFiles(`'${folderId}' in parents and mimeType='${CSV_TYPE}' and trashed=false`);
}

// Read one binder file's cards. A file that can't be read (damaged)
// gets a clear message instead of a confusing one.
async function readBinderFile(fileId: string): Promise<BinderCards> {
  const response = await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
  try {
    return cardsFromCsv(await response.text());
  } catch {
    throw new DriveError('This binder\'s file in Google Drive can\'t be read. It may have been edited or damaged.');
  }
}

// Replace one binder file's contents with the binder as it is in this
// browser: its cards, name, cover and pages, as a .csv file.
async function writeBinderFile(fileId: string): Promise<void> {
  await driveRequest(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': `${CSV_TYPE}; charset=UTF-8` },
    body: binderToCsv(binderDetails(fileId), loadBinder(fileId)),
  });
}

// Make a new binder file in the folder, holding these cards (often none).
// Returns { id }. Its cover symbol ("color", or null), shelf position
// ("order"), cover color and pages are also stored as labels on the
// file, so the shelf can show them without opening every binder.
// Local use only: nothing goes to Drive; the binder just gets a new
// "local-..." id.
export async function createBinderFile(
  name: string,
  cards: BinderCards = {},
  color: string | null = null,
  order: number | null = null,
  cover: string = DEFAULT_COVER,
  pages: number = DEFAULT_PAGES,
): Promise<{ id: string }> {
  if (isLocalMode()) return { id: newLocalBinderId() };
  const folderId = await getBinderFolderId();
  const details: Record<string, unknown> = { name: `${name}.csv`, mimeType: CSV_TYPE, parents: [folderId] };
  const labels: Record<string, string> = {};
  if (color) labels.color = color;
  if (cover !== DEFAULT_COVER) labels.cover = cover;           // black is the default: no label needed
  if (pages !== DEFAULT_PAGES) labels.pages = String(pages);   // (and so is DEFAULT_PAGES)
  if (order !== null) labels.order = String(order);
  if (Object.keys(labels).length) details.appProperties = labels;
  const response = await driveRequest(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name`, {
    method: 'POST',
    ...multipart(details, CSV_TYPE, binderToCsv({ name, color, cover, pages }, cards)),
  });
  return response.json();
}

// Change a binder file's details. Only the details passed in change:
//   { name: "Modern Decks" }  renames it (the file becomes "Modern Decks.csv")
//   { color: "R" } / { color: null }  sets or removes the cover symbol
//   { cover: "gold" }  the cover's color     { pages: 20 }  its pages
//   { order: 3 }  its spot on the shelf (0 = first)
// The name, cover and pages are also written in the .csv file itself, so
// changing one of those rewrites the file too. It first brings the
// binder up to date (so cards added on another computer aren't lost).
// The page must already have saved the change in the binder list.
// (Local use only: nothing to do; the page has already saved the change.)
export async function updateBinderDetails(
  fileId: string,
  { name, color, cover, pages, order }: { name?: string; color?: string | null; cover?: string; pages?: number; order?: number },
): Promise<void> {
  if (isLocalMode()) return;
  const details: Record<string, unknown> = {};
  const labels: Record<string, string | null> = {};
  if (name !== undefined) details.name = `${name}.csv`;
  if (color !== undefined) labels.color = color;            // null removes the label
  if (cover !== undefined) labels.cover = cover;
  if (pages !== undefined) labels.pages = String(pages);    // labels are always text
  if (order !== undefined) labels.order = String(order);
  if (Object.keys(labels).length) details.appProperties = labels;

  // Only the shelf position changed: just the labels
  if (name === undefined && color === undefined && cover === undefined && pages === undefined) {
    await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    });
    return;
  }
  // Otherwise the labels and the file's contents, together
  await syncBinder(fileId);
  const binder = { ...binderDetails(fileId), ...(name !== undefined && { name }),
    ...(color !== undefined && { color }), ...(cover !== undefined && { cover }), ...(pages !== undefined && { pages }) };
  await driveRequest(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?uploadType=multipart`, {
    method: 'PATCH',
    ...multipart(details, CSV_TYPE, binderToCsv(binder, loadBinder(fileId))),
  });
}

// "Delete" a binder: move its file to the Google Drive trash (it can be
// restored from there for 30 days). (Local use only: nothing to do.)
export async function trashBinderFile(fileId: string): Promise<void> {
  if (isLocalMode()) return;
  await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

/* ---------------------------------------------------------------------
   THE SETTINGS FILE
   The site's settings (see settings.ts) are kept in one file in the same
   "MTG Card Binder" folder as the binders. It's a .json file, but it's
   stored in Drive as plain text ("text/plain"): the binder list only
   picks up .csv files (and the original site, which shares the folder,
   only files stored as JSON), so the settings file never shows up as a
   binder, here or there.
   --------------------------------------------------------------------- */

// The settings file's name, and where its Drive id is remembered for this tab
const SETTINGS_FILE_NAME = 'WUBRGr settings.json';
const SETTINGS_ID_KEY = 'settingsFileId';

// Find the settings file's id, or null if there isn't one yet.
async function findSettingsFile(): Promise<string | null> {
  try {
    const remembered = session.get(SETTINGS_ID_KEY);
    if (remembered) return remembered;
  } catch { /* storage blocked: just look it up */ }
  const folderId = await getBinderFolderId();
  const query = `'${folderId}' in parents and name='${SETTINGS_FILE_NAME}' and trashed=false`;
  const found = await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`);
  const id: string | null = (await found.json()).files[0]?.id ?? null;
  if (id) { try { session.set(SETTINGS_ID_KEY, id); } catch { /* fine */ } }
  return id;
}

// Read the settings from Drive: the file's contents, or null if there's
// no settings file yet (or it can't be read).
export async function readSettingsFile(): Promise<Record<string, unknown> | null> {
  const id = await findSettingsFile();
  if (!id) return null;
  const response = await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`);
  try {
    const data = JSON.parse(await response.text());
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;   // damaged or edited by hand: treat it as no settings
  }
}

// Save the settings to Drive: replace the file's contents, or make the
// file if it isn't there yet (its details and contents sent together in
// one "multipart" message, like a new binder file).
export async function writeSettingsFile(data: Record<string, unknown>): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  const id = await findSettingsFile();
  if (id) {
    await driveRequest(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(id)}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    });
    return;
  }
  const folderId = await getBinderFolderId();
  const boundary = `settings-${Date.now()}`;
  const details = { name: SETTINGS_FILE_NAME, mimeType: 'text/plain', parents: [folderId] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(details)}\r\n` +
    `--${boundary}\r\nContent-Type: text/plain\r\n\r\n` +
    `${text}\r\n` +
    `--${boundary}--`;
  const response = await driveRequest(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const created = await response.json();
  try { session.set(SETTINGS_ID_KEY, created.id); } catch { /* fine */ }
}

// The binder's display name from its file name ("Binder 1.csv" → "Binder 1",
// and the same for an old "Binder 1.json")
export function nameFromFileName(fileName: string): string {
  return fileName.replace(/\.(csv|json)$/i, '');
}

// Bring one binder up to date between this browser and Google Drive:
//  - if this browser has changes Drive doesn't have yet, SEND them
//  - otherwise, FETCH the binder from Drive (it may have been changed on
//    another computer) and keep it as this browser's working copy
// Returns the binder's cards as they now stand.
// (Local use only: this device's copy is the only one, so just return it.)
export async function syncBinder(id: string): Promise<BinderCards> {
  if (isLocalMode()) return loadBinder(id);
  const stamp = binderDirtyStamp(id);
  if (stamp) {
    await writeBinderFile(id);
    markBinderSaved(id, stamp);
    return loadBinder(id);
  }
  const cards = await readBinderFile(id);
  saveBinder(cards, id, { dirty: false });
  return cards;
}

// Signing in after using the site locally: upload every binder made on
// this device to the person's Google Drive, after the binders already
// there (so they come at the end of the shelf, in the same order), then
// switch "local use only" off. Each binder is forgotten here as soon as
// it's safely uploaded, so if something goes wrong part way, trying
// again only uploads the rest (and the site stays in local use).
export async function uploadLocalBinders(): Promise<void> {
  const localBinders = loadBinderList();
  setLocalMode(false);   // so createBinderFile really saves to Drive
  try {
    const alreadyInDrive = (await listBinderFiles()).length;
    for (const [index, binder] of localBinders.entries()) {
      await createBinderFile(binder.name, loadBinder(binder.id), binder.color,
        alreadyInDrive + index, cleanCover(binder.cover), binderPages(binder.id));
      forgetBinder(binder.id);
    }
    // Then the lists, the same way (each forgotten here once it's in Drive)
    for (const list of loadLists()) {
      const file = await createListFile(list.name, list.cards);
      forgetList(list.id);
      addListToDevice(file.id, list.name, list.cards);
    }
  } catch (err) {
    setLocalMode(true);
    throw new Error(`Couldn't upload all your binders and lists to Google Drive. ${(err as Error).message}`);
  }
}

/* ---------------------------------------------------------------------
   LISTS
   Each list is one .csv file in a "Lists" folder inside "MTG Card
   Binder". Its file name is the list's name ("Trade bait.csv"), and its
   Drive id is the list's id. This device keeps a copy of every list (see
   listStorage.ts); syncList brings one up to date either way.
   LOCAL USE ONLY: these skip Drive, like the binder ones.
   --------------------------------------------------------------------- */

// The "Lists" folder's name, and where its Drive id is remembered for this tab
const LIST_FOLDER_NAME = 'Lists';
const LIST_FOLDER_KEY = 'driveListFolderId';

// Find the "Lists" folder inside "MTG Card Binder", or make it if it's not
// there yet. Its id is remembered for this tab so we only look once.
async function getListFolderId(): Promise<string> {
  try {
    const remembered = session.get(LIST_FOLDER_KEY);
    if (remembered) return remembered;
  } catch { /* storage blocked (or a phone): just look it up */ }

  const parentId = await getBinderFolderId();
  const query = `name='${LIST_FOLDER_NAME}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const found = await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`);
  let folderId: string | undefined = (await found.json()).files[0]?.id;

  if (!folderId) {
    const created = await driveRequest(`${DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: LIST_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    });
    folderId = (await created.json()).id as string;
  }

  try { session.set(LIST_FOLDER_KEY, folderId); } catch { /* fine */ }
  return folderId;
}

// Make a new list file holding these cards (often none). Returns { id }.
// (Local use only: nothing goes to Drive; the list gets a local id.)
export async function createListFile(name: string, cards: ListCard[] = []): Promise<{ id: string }> {
  if (isLocalMode()) return { id: newLocalListId() };
  const folderId = await getListFolderId();
  const response = await driveRequest(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    ...multipart({ name: `${name}.csv`, mimeType: CSV_TYPE, parents: [folderId] }, CSV_TYPE,
      listToCsv({ id: '', name, cards })),
  });
  return response.json();
}

// Replace a list file's name and contents with this device's copy
async function writeListFile(list: CardList): Promise<void> {
  await driveRequest(`${DRIVE_UPLOAD_API}/files/${encodeURIComponent(list.id)}?uploadType=multipart`, {
    method: 'PATCH',
    ...multipart({ name: `${list.name}.csv` }, CSV_TYPE, listToCsv(list)),
  });
}

// Read one list file's cards
async function readListFile(fileId: string): Promise<ListCard[]> {
  const response = await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
  return listCardsFromCsv(await response.text());
}

// "Delete" a list: move its file to the Google Drive trash (it can be
// restored from there for 30 days). (Local use only: nothing to do.)
export async function trashListFile(fileId: string): Promise<void> {
  if (isLocalMode()) return;
  await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

// Bring one list up to date between this device and Google Drive:
//  - if this device has changes Drive doesn't have yet, SEND them
//  - otherwise, FETCH the list from Drive (it may have been changed on
//    another device) and keep it as this device's copy
// (Local use only: this device's copy is the only one, so nothing to do.)
export async function syncList(id: string): Promise<void> {
  if (isLocalMode()) return;
  const list = findList(id);
  if (!list) return;
  const stamp = listDirtyStamp(id);
  if (stamp) {
    await writeListFile(list);
    markListSaved(id, stamp);
    return;
  }
  const cards = await readListFile(id);
  saveLists(loadLists().map((l) => (l.id === id ? { ...l, cards } : l)));
}

// Every list in Drive, oldest first, kept as this device's copy. A list
// with changes Drive doesn't have yet keeps this device's version (it's
// sent the next time it's saved). (Local use only: this device's lists.)
export async function loadListsFromDrive(): Promise<CardList[]> {
  if (isLocalMode()) return loadLists();
  const folderId = await getListFolderId();
  const files = await listFiles(`'${folderId}' in parents and mimeType='${CSV_TYPE}' and trashed=false`);
  const lists = await Promise.all(files.map(async (file): Promise<CardList> => {
    const here = findList(file.id);
    if (here && listDirtyStamp(file.id)) return here;
    return { id: file.id, name: nameFromFileName(file.name), cards: await readListFile(file.id) };
  }));
  saveLists(lists);
  return lists;
}
