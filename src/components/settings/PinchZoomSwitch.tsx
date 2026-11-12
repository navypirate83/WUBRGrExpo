/* =====================================================================
   SETTINGS → ACCESSIBILITY → PINCH TO ZOOM (website only)
   A switch that allows the browser's own pinch-to-zoom of the whole page.
   It's off by default (the app behaves like an app, and the Grid view has
   its own pinch zoom), and is kept on this device only. See
   lib/noPageZoom.ts.
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { onPageZoomChange, pageZoomAllowed, setPageZoomAllowed } from '@/lib/noPageZoom';
import { SwitchRow } from './SettingsParts';

export default function PinchZoomSwitch() {
  const allowed = useSyncExternalStore(onPageZoomChange, pageZoomAllowed, pageZoomAllowed);
  // Only the website has a browser zoom to allow
  if (Platform.OS !== 'web') return null;
  return (
    <SwitchRow
      name="Allow pinch to zoom"
      description="Lets you pinch with two fingers to zoom the whole page, the way a browser normally does. Off, the page stays put (the Grid view of a binder still zooms its cards when you pinch it). Kept on this device only."
      value={allowed}
      onChange={setPageZoomAllowed}
    />
  );
}
