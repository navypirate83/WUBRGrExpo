/* =====================================================================
   HOLDING CTRL TO PICK SEVERAL THINGS (on the web)
   A "hook" (a reusable piece of React behavior) for choosing several
   binders at once on a computer: hold Ctrl (or Cmd on a Mac) and click
   the binders you want. It gives the screen:
     - "ctrlHeld": a box that says whether Ctrl is down right now, so a
       click can tell "pick this one" from "open this one"
     - "onRelease": called when Ctrl is let go. The screen uses that to
       ask what to do with the binders picked.
     - "onEscape": called when Esc is pressed, to drop the picks
   (Phones use useCtrlSelect.ts, which does nothing: no keyboard.)
   ===================================================================== */

import { useEffect, useRef, type MutableRefObject } from 'react';

export function useCtrlSelect(onRelease: () => void, onEscape: () => void): { ctrlHeld: MutableRefObject<boolean> } {
  // Whether Ctrl (or Cmd) is down right now. A "ref" is a box that
  // survives redraws and can be read at any moment.
  const ctrlHeld = useRef(false);

  // Keep the newest functions in refs, so the listeners below always call
  // the latest version without being removed and added on every redraw
  const releaseRef = useRef(onRelease);
  releaseRef.current = onRelease;
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    const isCtrl = (event: KeyboardEvent) => event.key === 'Control' || event.key === 'Meta';
    function down(event: KeyboardEvent) {
      if (isCtrl(event)) ctrlHeld.current = true;
      else if (event.key === 'Escape') escapeRef.current();
    }
    function up(event: KeyboardEvent) {
      if (!isCtrl(event) || !ctrlHeld.current) return;
      ctrlHeld.current = false;
      releaseRef.current();
    }
    // Clicking away from the page while Ctrl is down: its release is never
    // seen, so just forget that it was held
    function lost() {
      ctrlHeld.current = false;
    }
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    window.addEventListener('blur', lost);
    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
      window.removeEventListener('blur', lost);
    };
  }, []);

  return { ctrlHeld };
}
