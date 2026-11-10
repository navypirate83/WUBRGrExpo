/* =====================================================================
   THE "SAME NAME ON BOTH" QUESTION (what the code asks, and the answer)
   When this device and your WUBRG'r account each have a binder (or
   list) with the same name but different cards, and they were never
   linked, serverSync.ts doesn't guess: it asks which version to keep.
   A question with several choices can't be shown with the phone's plain
   message box, so the app draws its own window
   (components/MergeChoiceHost.tsx).
   This file is the go-between: the sync code calls askMergeChoice() and
   waits; the window shows the question and calls answerMergeQuestion()
   when a button is tapped. (The same idea as syncChoice.ts.)
   Plain TypeScript with no React in it.
   ===================================================================== */

// What to do with the two copies:
//  - combine:      one binder with the cards from both (a card on both
//                  counts once)
//  - keep-device:  this device's cards replace the account's
//  - keep-account: the account's cards replace this device's
export type MergeChoice = 'combine' | 'keep-device' | 'keep-account';

// Everything the window needs to explain the difference
export type MergeQuestion = {
  kind: 'binder' | 'list';
  name: string;
  device: number;     // how many cards are on this device
  account: number;    // how many cards are in the account
  combined: number;   // how many there would be if combined
};

// The answer. choice is null for "Decide later" (nothing changes now).
// forAll means "do the same for the other ones with this problem".
export type MergeAnswer = { choice: MergeChoice | null; forAll: boolean };

// The question being shown right now (null if none), with the way to
// give the answer back to the code that's waiting
type Pending = { question: MergeQuestion; resolve: (answer: MergeAnswer) => void };
let pending: Pending | null = null;
const listeners = new Set<() => void>();

// The window listens here so it can show or hide itself
export function onMergeQuestionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function currentMergeQuestion(): Pending | null {
  return pending;
}

// Ask the question and wait for the answer. (If one is already showing,
// it's closed with "Decide later" first, so two never pile up.)
export function askMergeChoice(question: MergeQuestion): Promise<MergeAnswer> {
  if (pending) answerMergeQuestion({ choice: null, forAll: false });
  return new Promise((resolve) => {
    pending = { question, resolve };
    listeners.forEach((listener) => listener());
  });
}

// The window's buttons call this with the person's answer
export function answerMergeQuestion(answer: MergeAnswer): void {
  const done = pending;
  pending = null;
  listeners.forEach((listener) => listener());
  done?.resolve(answer);
}
