/* =====================================================================
   PINCH TO ZOOM THE GRID
   On a touch screen (a phone, a tablet, a touch-screen computer), spreading
   two fingers apart on the Grid view makes the card pictures bigger, and
   pinching them together makes them smaller.
   This file only WATCHES the two fingers (it doesn't take the touches
   over, so one-finger scrolling and tapping work as always) and reports:
   - onStart: two fingers just touched down; "mid" is the point between them
     (measured from the top left of the grid's area)
   - onMove: the fingers moved; "scale" is how far apart they are now compared
     with when they touched down (2 = twice as far apart)
   - onEnd: the fingers lifted; "scale" is where they finished
   CardList.tsx uses those to stretch the grid live while the fingers are
   down, and to change the real zoom only when they lift.
   On the website, the page is told it may scroll but not pinch-zoom itself
   over the grid, so the pinch is ours. The result goes on the view around
   the grid.
   ===================================================================== */
import { useEffect, useRef, type ElementRef } from 'react';
import { Platform, View, type GestureResponderEvent } from 'react-native';

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

// What the pinch reports (see the top of this file)
export type PinchHandlers = {
  onStart: (mid: { x: number; y: number }) => void;
  onMove: (scale: number) => void;
  onEnd: (scale: number) => void;
};

export function usePinchZoom(enabled: boolean, handlers: PinchHandlers): PinchProps {
  // The pinch going on right now (null when there is none): the finger gap
  // when it began, the latest scale, and whether the grid's place on the
  // screen has been measured yet (it takes a moment)
  const pinch = useRef<{ gap: number; scale: number; ready: boolean } | null>(null);
  // The latest handlers (so the touch functions below never go stale)
  const report = useRef(handlers);
  report.current = handlers;
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

  // The pinch is over (a finger lifted, or the touch was taken away)
  const finish = () => {
    const done = pinch.current;
    pinch.current = null;
    if (done?.ready) report.current.onEnd(done.scale);
  };

  if (!enabled) return { style: undefined };
  return {
    ref: box,
    dataSet: { pinchGrid: '' },
    // A browser may not zoom the page itself over the grid; scrolling is still fine
    style: { touchAction: 'pan-x pan-y' } as object,
    onTouchStart: (event: GestureResponderEvent) => {
      const gap = fingerGap(event);
      if (gap === null || gap < 1 || pinch.current) return;
      const state = { gap, scale: 1, ready: false };
      pinch.current = state;
      // Where the fingers are, measured from the grid's own top left corner
      const [a, b] = [event.nativeEvent.touches[0], event.nativeEvent.touches[1]];
      const midX = (a.pageX + b.pageX) / 2;
      const midY = (a.pageY + b.pageY) / 2;
      box.current?.measureInWindow((left, top) => {
        if (pinch.current !== state) return;   // the fingers already lifted
        state.ready = true;
        report.current.onStart({ x: midX - left, y: midY - top });
      });
    },
    onTouchMove: (event: GestureResponderEvent) => {
      const state = pinch.current;
      const gap = fingerGap(event);
      if (!state || !state.ready || gap === null) return;
      // Fingers twice as far apart is a scale of 2 (kept to a sensible range)
      state.scale = Math.min(6, Math.max(0.15, gap / state.gap));
      report.current.onMove(state.scale);
    },
    onTouchEnd: (event: GestureResponderEvent) => { if (fingerGap(event) === null) finish(); },
    onTouchCancel: finish,
  };
}
