/* =====================================================================
   DROPPING CARD PICTURES FROM OTHER WEBSITES (on the web)
   Drag a card picture (or a card's link) from Scryfall or EDHREC in
   another browser window onto an EMPTY pocket, and that pocket gets the
   card (lib/cardDrop.ts works out which card it is).
   This listens for the browser's drag-and-drop events on the binder:
   - "dragover": something is being dragged over the binder; outline the
     empty pocket under it (and tell the browser a drop is allowed)
   - "drop": it was let go over an empty pocket
   Anywhere else on the page, a dropped picture would make the browser
   leave the app to show it, so that's stopped too.
   (Phones use useCardDrop.ts, which does nothing.)
   ===================================================================== */

import { useEffect, useRef, type RefObject } from 'react';
import { isOutsideDrag } from '@/lib/cardDrop';

export type CardDropOptions = {
  // The binder (on the web, React Native draws it as a page element)
  binderRef: RefObject<unknown>;
  // The empty pocket at a point inside the binder (or null)
  emptyPocketAt: (x: number, y: number) => string | null;
  // Something is over this empty pocket (null: over none)
  onOver: (key: string | null) => void;
  // Something was dropped on this empty pocket
  onDrop: (dataTransfer: DataTransfer, key: string) => void;
};

export function useCardDrop(options: CardDropOptions): void {
  // Keep the newest options in a "ref" (a box that survives redraws), so
  // the listeners below always use the latest ones
  const latest = useRef(options);
  latest.current = options;

  // Listen on the whole page while the binder screen is open (and stop
  // when it closes). The binder itself is looked up at each drag, not
  // once at the start: it's only drawn after the screen has measured
  // its space, so it isn't there yet when the screen first opens.
  useEffect(() => {
    // The empty pocket under a drag event's point, if any (none when the
    // point isn't over the binder, or the binder isn't showing)
    function pocketFor(event: DragEvent): string | null {
      const binder = latest.current.binderRef.current as HTMLElement | null;
      if (!binder) return null;
      const box = binder.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (x < 0 || y < 0 || x > box.width || y > box.height) return null;
      return latest.current.emptyPocketAt(x, y);
    }

    // Something from outside is being dragged over the page: outline the
    // empty pocket under it, and allow a drop only there. (Stopping the
    // browser's usual handling everywhere also stops it leaving the app
    // to show a picture dropped somewhere else.)
    function over(event: DragEvent) {
      if (!isOutsideDrag(event.dataTransfer)) return;
      event.preventDefault();
      const key = pocketFor(event);
      latest.current.onOver(key);
      // (Only say "no drop here" when the binder's pockets are showing: in the
      // List and Grid views the cards area allows drops itself)
      if (event.dataTransfer && latest.current.binderRef.current) event.dataTransfer.dropEffect = key ? 'copy' : 'none';
    }
    // The drag left the window: no outline
    function leave(event: DragEvent) {
      if (!event.relatedTarget) latest.current.onOver(null);
    }
    // Let go: if it's over an empty pocket, hand the drop to the screen
    function drop(event: DragEvent) {
      if (!isOutsideDrag(event.dataTransfer)) return;
      event.preventDefault();
      latest.current.onOver(null);
      const key = pocketFor(event);
      if (key && event.dataTransfer) latest.current.onDrop(event.dataTransfer, key);
    }

    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);
}
