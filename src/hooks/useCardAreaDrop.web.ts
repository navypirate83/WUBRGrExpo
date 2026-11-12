/* =====================================================================
   DROPPING CARD PICTURES ON THE LIST OR GRID (on the web)
   Drag a card picture (or a card's link) from Scryfall or EDHREC in
   another browser window and let go anywhere over the cards of a binder's
   or list's List or Grid view: the card is added (lib/cardDrop.ts works
   out which card it is; the screen adds it).
   This listens for the browser's drag-and-drop events:
   - "dragover": something is being dragged over the page; if it's over the
     cards area, say so (the screen outlines it) and allow the drop
   - "drop": it was let go over the cards area
   Elsewhere on the page the other drop code (useCardDrop.web.ts) stops the
   browser leaving the app to show a dropped picture.
   (Phones use useCardAreaDrop.ts, which does nothing.)
   ===================================================================== */

import { useEffect, useRef, type RefObject } from 'react';
import { isOutsideDrag } from '@/lib/cardDrop';

export type CardAreaDropOptions = {
  // The area the cards are in (on the web, React Native draws it as a page element)
  areaRef: RefObject<unknown>;
  // Is a drop allowed now? (The List and Grid views only.)
  enabled: boolean;
  // A picture is being dragged over the area (true) or isn't any more (false)
  onOver: (over: boolean) => void;
  // A picture was dropped on the area
  onDrop: (dataTransfer: DataTransfer) => void;
};

export function useCardAreaDrop(options: CardAreaDropOptions): void {
  // Keep the newest options in a "ref" (a box that survives redraws), so the
  // listeners below always use the latest ones
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    // Is this drag event's point inside the cards area?
    function inside(event: DragEvent): boolean {
      const area = latest.current.areaRef.current as HTMLElement | null;
      if (!area) return false;
      const box = area.getBoundingClientRect();
      return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    }

    function over(event: DragEvent) {
      if (!latest.current.enabled || !isOutsideDrag(event.dataTransfer)) return;
      const yes = inside(event);
      latest.current.onOver(yes);
      if (yes) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      }
    }
    // The drag left the window: no outline
    function leave(event: DragEvent) {
      if (!event.relatedTarget) latest.current.onOver(false);
    }
    function drop(event: DragEvent) {
      if (!latest.current.enabled || !isOutsideDrag(event.dataTransfer)) return;
      latest.current.onOver(false);
      if (inside(event) && event.dataTransfer) {
        event.preventDefault();
        latest.current.onDrop(event.dataTransfer);
      }
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
