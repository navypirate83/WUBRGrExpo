/* =====================================================================
   NO BROWSER PINCH-ZOOM (the website, on a phone or touch screen)
   The app has its own zoom (pinching the Grid view, see
   hooks/usePinchZoom.ts), so the browser's own "pinch to zoom the whole
   page" is turned off everywhere else, like an app rather than a web page.
   Settings → Accessibility has a switch to allow it again (for anyone who
   needs to enlarge the page); that choice is kept on this device only.
   Three things are used to turn it off, because browsers differ:
   - the page's "viewport" tag is told zooming isn't allowed
   - a style rule says touches may only scroll, not pinch-zoom (this is
     what iPhones and recent Androids follow)
   - two-finger touches and Safari's own pinch gesture are cancelled
   (The built website has the viewport tag already: see
   scripts/finish-web-build.js. This also covers the test server, and
   switches it all back on when the Accessibility switch allows zoom.)
   It does nothing in the phone app, which has no browser around it.
   ===================================================================== */

import { Platform } from 'react-native';
import { storageGet, storageSet } from './storage';

// The name the choice is saved under ("1" = pinch to zoom is allowed)
const KEY = 'allowPageZoom';

// Screens listening for a change (the settings switch)
const listeners = new Set<() => void>();

// Is the browser's pinch-to-zoom allowed? (Nothing saved yet means no.)
export function pageZoomAllowed(): boolean {
  return storageGet(KEY) === '1';
}

// Allow or block it, remember the choice, and apply it straight away
export function setPageZoomAllowed(allowed: boolean): void {
  storageSet(KEY, allowed ? '1' : '0');
  applyPageZoom();
  listeners.forEach((listener) => listener());
}

// Ask to be told when the choice changes (used with useSyncExternalStore)
export function onPageZoomChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Make the page match the choice: the viewport tag and the style rule
// (the touch listeners below look at the choice each time they run)
function applyPageZoom(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const allowed = pageZoomAllowed();

  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  viewport.setAttribute('content', allowed
    ? 'width=device-width, initial-scale=1, shrink-to-fit=no'
    : 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no');

  // The rule that lets touches scroll but not pinch-zoom (it also turns off
  // a double tap to zoom). Switched off when zoom is allowed.
  let style = document.getElementById('no-page-zoom-style') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'no-page-zoom-style';
    style.textContent = 'html, body, body * { touch-action: pan-x pan-y; }';
    document.head.appendChild(style);
  }
  style.disabled = allowed;
}

// Called once when the app starts
let started = false;
export function disablePageZoom(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || started) return;
  started = true;
  applyPageZoom();

  // Cancel two-finger moves and Safari's pinch gesture (unless allowed)
  const stop = (event: Event) => {
    if (pageZoomAllowed() || !event.cancelable) return;
    if (event.type !== 'touchmove' || (event as TouchEvent).touches.length > 1) event.preventDefault();
  };
  document.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('gesturestart', stop);
  document.addEventListener('gesturechange', stop);
}
