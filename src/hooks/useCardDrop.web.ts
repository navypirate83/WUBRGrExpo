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

  // Add the listeners once the binder is on the page, and take them off
  // again when it goes
  useEffect(() => {
    const binder = latest.current.binderRef.current as HTMLElement | null;
    if (!binder) return;

    // The empty pocket under a drag event's point, if any
    function pocketFor(event: DragEvent): string | null {
      const box = binder!.getBoundingClientRect();
      return latest.current.emptyPocketAt(event.clientX - box.left, event.clientY - box.top);
    }

    // Over the binder: outline the empty pocket, and allow the drop there
    function over(event: DragEvent) {
      if (!isOutsideDrag(event.dataTransfer)) return;
      const key = pocketFor(event);
      latest.current.onOver(key);
      if (!key) { if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'; return; }
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }
    // Left the binder: no outline
    function leave(event: DragEvent) {
      if (!binder!.contains(event.relatedTarget as Node)) latest.current.onOver(null);
    }
    // Let go over the binder: hand the drop to the screen
    function drop(event: DragEvent) {
      if (!isOutsideDrag(event.dataTransfer)) return;
      event.preventDefault();
      latest.current.onOver(null);
      const key = pocketFor(event);
      if (key && event.dataTransfer) latest.current.onDrop(event.dataTransfer, key);
    }
    // Anywhere else on the page: stop the browser leaving the app
    function stop(event: DragEvent) {
      if (isOutsideDrag(event.dataTransfer) && !binder!.contains(event.target as Node)) event.preventDefault();
    }

    binder.addEventListener('dragover', over);
    binder.addEventListener('dragleave', leave);
    binder.addEventListener('drop', drop);
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      binder.removeEventListener('dragover', over);
      binder.removeEventListener('dragleave', leave);
      binder.removeEventListener('drop', drop);
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);
}
