/* =====================================================================
   SHORTCUT KEYS (on the web)
   A "hook" (a reusable piece of React behavior) that lets a screen react
   to single keys pressed anywhere on it, like "?" or "/". The key is
   left alone (so it types normally, or does its usual job) when:
     - you're typing in a box (a text box, drop-down or text area)
     - Ctrl, Alt or Cmd is held (those shortcuts belong to the browser)
     - a pop-up window is open (it has its own keys)
   (Phones use useShortcutKeys.ts, which does nothing: no keyboard.)
     - a pop-up list has the keyboard (like the Set list: it uses the
       arrow keys and Enter itself)
     - something else already handled it ("defaultPrevented")
   ===================================================================== */

import { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';

// Narrower than this (in points), the website is treated like the phone
// app: it's a phone's browser, or a window squeezed to phone size
const PHONE_WIDTH = 600;

// "onKey" gets each key press that's left over; it calls
// event.preventDefault() for the keys it uses.
export function useShortcutKeys(onKey: (event: KeyboardEvent) => void): void {
  // Keep the newest onKey in a "ref" (a box that survives redraws), so
  // the listener below always calls the latest version without being
  // removed and added again on every redraw.
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;

  // Listen for key presses on the whole page while the page is showing.
  // The function returned at the end removes the listener when it goes.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="listbox"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      onKeyRef.current(event);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}

// Should screens mention keyboard keys (the "Keys" and "Keyboard
// shortcuts" buttons, and the keyboard parts of Help)? Only on a
// computer-sized screen with a mouse or trackpad. A phone or tablet's
// browser (touch only: no "fine" pointer like a mouse) and phone-sized
// windows leave them out, like the phone app. The keys themselves still
// work for anyone with a keyboard.
export function useShowKeyHints(): boolean {
  const { width } = useWindowDimensions();
  const hasMouse = typeof window !== 'undefined' && window.matchMedia?.('(any-pointer: fine)').matches;
  return Boolean(hasMouse) && width >= PHONE_WIDTH;
}
