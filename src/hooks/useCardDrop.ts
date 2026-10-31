/* =====================================================================
   DROPPING CARD PICTURES FROM OTHER WEBSITES (on phones: nothing)
   On a computer, a card picture dragged in from Scryfall or EDHREC can
   be dropped on an empty pocket: see useCardDrop.web.ts. Phones can't
   drag between apps like that, so this version does nothing.
   ===================================================================== */

import type { RefObject } from 'react';

// The same settings as the web version (see there), ignored here
export type CardDropOptions = {
  binderRef: RefObject<unknown>;
  emptyPocketAt: (x: number, y: number) => string | null;
  onOver: (key: string | null) => void;
  onDrop: (dataTransfer: DataTransfer, key: string) => void;
};

export function useCardDrop(_options: CardDropOptions): void {
  /* no dragging in from other apps on phones */
}
