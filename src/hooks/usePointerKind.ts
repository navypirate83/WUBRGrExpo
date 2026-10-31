/* =====================================================================
   MOUSE OR FINGER? (in the phone app: always a finger)
   On the website, dragging works differently with a mouse (press the
   button and move: the card or binder moves straight away) than with a
   finger (rest it first, so a quick swipe can turn the page instead).
   See usePointerKind.web.ts for how the website tells them apart. The
   phone app is only ever used with fingers, so this version always says so.
   ===================================================================== */

// "mouse" or "touch" (a finger or a pen)
export type PointerKind = 'mouse' | 'touch';

// The pointer being used right now
export function usePointerKind(): PointerKind {
  return 'touch';
}
