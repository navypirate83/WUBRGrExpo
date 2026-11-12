/* =====================================================================
   PINCH TO ZOOM THE GRID
   On a touch screen (a phone, a tablet, a touch-screen computer), spreading
   two fingers apart on the Grid view makes the card pictures bigger, and
   pinching them together makes them smaller. The pictures follow the
   fingers: when the pinch starts, the picture width and the distance
   between the fingers are noted, and as the fingers move the width follows
   in proportion (fingers twice as far apart: pictures about twice as wide),
   landing on the nearest of the zoom sizes (see GRID_ZOOM_WIDTHS in
   lib/binderView.ts). So one spread or pinch can cross the whole range.
   It only WATCHES the touches (it doesn't take them over), so one-finger
   scrolling and tapping work as always. On the website, the page is told
   it may scroll but not pinch-zoom itself over the grid, so the pinch is
   ours. The result goes on the view around the grid.
   ===================================================================== */
import { useEffect, useRef, type ElementRef } from 'react';
import { Platform, View, type GestureResponderEvent } from 'react-native';
import { GRID_ZOOM_WIDTHS, binderGridZoom, setBinderGridZoom, zoomStepForWidth } from '@/lib/binderView';

// The distance between the first two fingers touching (null if fewer than two)
function fingerGap(event: GestureResponderEvent): number | null {
  const touches = event.nativeEvent.touches;
  if (!touches || touches.length < 2) return null;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

// On the website, the browser must be told not to zoom the page itself when
// two fingers pinch on the grid. Two things do that: a style rule for the
// grid and everything inside it (the browser looks at the touched card and
// every view around it), and a listener that cancels a two-finger touch
// (React's own listeners can't cancel, so this one is added by hand).
const PINCH_ATTRIBUTE = 'data-pinch-grid';
function allowOnlyScrolling() {
  if (document.getElementById('pinch-grid-style')) return;
  const style = document.createElement('style');
  style.id = 'pinch-grid-style';
  style.textContent = `[${PINCH_ATTRIBUTE}], [${PINCH_ATTRIBUTE}] * { touch-action: pan-x pan-y !important; }`;
  document.head.appendChild(style);
}

// What to put on the view around the grid
type PinchProps = {
  ref?: React.RefObject<ElementRef<typeof View> | null>;
  dataSet?: Record<string, string>;
  style?: object;
  onTouchStart?: (event: GestureResponderEvent) => void;
  onTouchMove?: (event: GestureResponderEvent) => void;
  onTouchEnd?: (event: GestureResponderEvent) => void;
  onTouchCancel?: () => void;
};

export function usePinchZoom(enabled: boolean): PinchProps {
  // When a pinch starts: the finger gap and the picture width at that moment
  const from = useRef<{ gap: number; width: number } | null>(null);
  // Start measuring a pinch from the fingers now (nothing if fewer than two)
  const begin = (event: GestureResponderEvent) => {
    const gap = fingerGap(event);
    from.current = gap === null || gap < 1 ? null : { gap, width: GRID_ZOOM_WIDTHS[binderGridZoom()] };
  };
  // The view around the grid (on the website, the page's own element for it)
  const box = useRef<ElementRef<typeof View>>(null);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    allowOnlyScrolling();
    const node = box.current as unknown as HTMLElement | null;
    if (!node) return;
    const stop = (event: Event) => {
      if (event.cancelable && (event.type === 'gesturestart' || (event as TouchEvent).touches?.length > 1)) event.preventDefault();
    };
    node.addEventListener('touchmove', stop, { passive: false });
    node.addEventListener('gesturestart', stop);   // Safari on an iPhone or iPad
    return () => {
      node.removeEventListener('touchmove', stop);
      node.removeEventListener('gesturestart', stop);
    };
  }, [enabled]);

  if (!enabled) return { style: undefined };
  return {
    ref: box,
    dataSet: { pinchGrid: '' },
    // A browser may not zoom the page itself over the grid; scrolling is still fine
    style: { touchAction: 'pan-x pan-y' } as object,
    onTouchStart: begin,
    onTouchMove: (event: GestureResponderEvent) => {
      const gap = fingerGap(event);
      if (gap === null) { from.current = null; return; }
      if (from.current === null) { begin(event); return; }
      // The width follows the fingers, in proportion
      setBinderGridZoom(zoomStepForWidth(from.current.width * (gap / from.current.gap)));
    },
    onTouchEnd: begin,
    onTouchCancel: () => { from.current = null; },
  };
}
