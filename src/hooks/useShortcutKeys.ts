/* =====================================================================
   SHORTCUT KEYS (on phones: nothing)
   On a computer, a screen can react to single keys (like "?" or "/"):
   see useShortcutKeys.web.ts. Phones have no keyboard to press them on,
   so this version does nothing. Screens can call it the same way on
   every device.
   ===================================================================== */

// Takes the same "onKey" as the web version, and ignores it
export function useShortcutKeys(_onKey: (event: KeyboardEvent) => void): void {
  /* no keyboard shortcuts on phones */
}

// Should screens mention keyboard keys (the "Keys" and "Keyboard
// shortcuts" buttons, and the keyboard parts of Help)? Never on phones.
export function useShowKeyHints(): boolean {
  return false;
}
