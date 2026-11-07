/* =====================================================================
   THE "WHICH WAY TO SYNC?" QUESTION (what the code asks, and the answer)
   When this phone and Google Drive don't match, driveSync.ts has to ask
   which one wins. A question with three choices ("Phone to Drive",
   "Drive to phone", "Not now") can't be shown with the phone's plain
   message box (and the browser's box only has OK and Cancel), so the
   app draws its own window (components/SyncChoiceHost.tsx).
   This file is the go-between: the sync code calls askSyncDirection()
   and waits; the window shows the question and calls
   answerSyncQuestion() when a button is tapped.
   Plain TypeScript with no React in it.
   ===================================================================== */

// How many binders and lists are in one place
export type Counts = { binders: number; lists: number };

// Everything the window needs to explain the difference
export type SyncQuestion = {
  phone: Counts;        // what's on this phone
  drive: Counts;        // what's in Google Drive
  onlyDrive: number;    // items in Drive that this phone doesn't have
  onlyPhone: number;    // items on this phone that Drive doesn't have
  changed: number;      // items that were changed in Drive (say, on the website) since the last sync
};

// The answer: which side wins, or null for "Not now"
export type SyncAnswer = 'phone-to-drive' | 'drive-to-phone' | null;

// The question being shown right now (null if none), with the way to
// give the answer back to the code that's waiting
type Pending = { question: SyncQuestion; resolve: (answer: SyncAnswer) => void };
let pending: Pending | null = null;
const listeners = new Set<() => void>();

// The window listens here so it can show or hide itself
export function onSyncQuestionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function currentSyncQuestion(): Pending | null {
  return pending;
}

// Ask the question and wait for the answer. (If one is already showing,
// it's closed with "Not now" first, so two never pile up.)
export function askSyncDirection(question: SyncQuestion): Promise<SyncAnswer> {
  if (pending) answerSyncQuestion(null);
  return new Promise((resolve) => {
    pending = { question, resolve };
    listeners.forEach((listener) => listener());
  });
}

// The window's buttons call this with the person's answer
export function answerSyncQuestion(answer: SyncAnswer): void {
  const done = pending;
  pending = null;
  listeners.forEach((listener) => listener());
  done?.resolve(answer);
}
