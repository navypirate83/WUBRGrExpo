/* =====================================================================
   PINCH TO ZOOM THE GRID
   On a touch screen (a phone, a tablet, a touch-screen computer), spreading
   two fingers apart on the Grid view makes the card pictures bigger, and
   pinching them together makes them smaller: the same one step at a time as
   the - and + buttons (see zoomBinderGrid in lib/binderView.ts).
   It only WATCHES the touches (it doesn't take them over), so one-finger
   scrolling and tapping work as always. On the website, the page is told
   it may scroll but not pinch-zoom itself over the grid, so the pinch is
   ours. The result goes on the view around the grid.
   ===================================================================== */

import { useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { zoomBinderGrid } from '@/lib/binderView';

// How much farther apart (or closer) the fingers must get for one step
const STEP_RATIO = 1.25;

// The distance between the first two fingers touching (null if fewer than two)
function fingerGap(event: GestureResponderEvent): number | null {
  const touches = event.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

// What to put on the view around the grid
type PinchProps = {
  style?: object;
  onTouchStart?: (event: GestureResponderEvent) => void;
  onTouchMove?: (event: GestureResponderEvent) => void;
  onTouchEnd?: (event: GestureResponderEvent) => void;
  onTouchCancel?: () => void;
};

export function usePinchZoom(enabled: boolean): PinchProps {
  // The finger gap the last step (or the start of the pinch) was measured from
  const from = useRef<number | null>(null);

  if (!enabled) return { style: undefined };
  return {
    // A browser may not zoom the page itself over the grid; scrolling is still fine
    style: { touchAction: 'pan-x pan-y' } as object,
    onTouchStart: (event: GestureResponderEvent) => { from.current = fingerGap(event); },
    onTouchMove: (event: GestureResponderEvent) => {
      const gap = fingerGap(event);
      if (gap === null || from.current === null || from.current < 1) { from.current = gap; return; }
      const ratio = gap / from.current;
      if (ratio >= STEP_RATIO) { zoomBinderGrid(1); from.current = gap; }
      else if (ratio <= 1 / STEP_RATIO) { zoomBinderGrid(-1); from.current = gap; }
    },
    onTouchEnd: (event: GestureResponderEvent) => { from.current = fingerGap(event); },
    onTouchCancel: () => { from.current = null; },
  };
}
