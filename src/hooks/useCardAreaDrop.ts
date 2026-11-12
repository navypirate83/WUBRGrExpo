/* =====================================================================
   DROPPING CARD PICTURES ON THE LIST OR GRID (on phones: nothing)
   On a computer, a card picture dragged in from Scryfall or EDHREC can be
   dropped on a binder's or list's cards: see useCardAreaDrop.web.ts. Phones
   can't drag between apps like that, so this version does nothing.
   ===================================================================== */

import type { RefObject } from 'react';

// The same settings as the web version (see there), ignored here
export type CardAreaDropOptions = {
  areaRef: RefObject<unknown>;
  enabled: boolean;
  onOver: (over: boolean) => void;
  onDrop: (dataTransfer: DataTransfer) => void;
};

export function useCardAreaDrop(_options: CardAreaDropOptions): void {
  /* no dragging in from other apps on phones */
}
