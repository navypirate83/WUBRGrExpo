/* =====================================================================
   MOUSE OR FINGER? (on the website)
   A "hook" that says whether the website is being used with a mouse or
   with a finger (a phone or tablet's touch screen) right now. Dragging
   works differently for each (see binders/[id].tsx and the shelf).
   It starts with a guess from the browser (does the device's main
   pointer aim finely, like a mouse?), then watches what's actually used:
   a mouse moving over the page, or a finger touching it. (A laptop with
   a touch screen can switch between the two at any time.) A mouse moves
   over the page before it clicks, so the answer is always ready before
   a drag starts.
   ===================================================================== */

import { useEffect, useState } from 'react';

// "mouse" or "touch" (a finger or a pen)
export type PointerKind = 'mouse' | 'touch';

// The browser's first guess
function firstGuess(): PointerKind {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches ? 'mouse' : 'touch';
}

// The pointer being used right now
export function usePointerKind(): PointerKind {
  const [kind, setKind] = useState<PointerKind>(firstGuess);

  // Every pointer event says what made it ("mouse", "touch" or "pen").
  // Listen to them all over the page while this screen is showing, and
  // switch when it changes. (The function returned at the end stops
  // listening when the screen goes.)
  useEffect(() => {
    function onPointer(event: PointerEvent) {
      setKind(event.pointerType === 'mouse' ? 'mouse' : 'touch');
    }
    window.addEventListener('pointermove', onPointer, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('pointermove', onPointer, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);

  return kind;
}
