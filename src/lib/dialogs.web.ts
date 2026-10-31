/* =====================================================================
   SIMPLE MESSAGES AND YES/NO QUESTIONS (on the web)
   The same as dialogs.ts, using the browser's own message boxes
   ("alert" and "confirm"), since React Native's Alert does nothing in a
   browser.
   Plain TypeScript with no React in it.
   ===================================================================== */

// Show a message with an OK button
export function showMessage(title: string, message?: string): void {
  window.alert(message ? `${title}\n\n${message}` : title);
}

// Ask a question: the browser's box has OK and Cancel (its words can't
// be changed, so "yes" and "no" aren't used here)
export function askYesNo(title: string, message: string, _yes = 'OK', _no = 'Cancel'): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
