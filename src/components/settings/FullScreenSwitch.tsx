/* =====================================================================
   SETTINGS → FULL SCREEN (website only)
   A switch that fills the whole screen with the page, which hides the
   browser's address bar (and its other bars) to give the app more room.
   - It only shows on the website. In browsers that allow full screen
     (most on Android and computers) it's a switch. In ones that don't
     (iPhones and iPads) it's a note saying to use "Add to Home Screen"
     instead, so the setting is never just missing.
   - It also hides itself when the site is already running as an
     installed app (that has no address bar to hide).
   - A browser only goes full screen after a tap, and pressing Esc (or
     swiping down) leaves it, so the switch follows what the browser
     actually did rather than assuming.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SettingRow, SwitchRow } from './SettingsParts';

// Is the site running as an installed app (which has no address bar)?
// The browser also says "display-mode: fullscreen" while the page is
// full screen because of THIS switch, so that only counts when the page
// wasn't made full screen from here (otherwise the switch would hide itself
// the moment it was turned on, with no way to turn it off).
function isInstalledApp(): boolean {
  const fullScreenFromHere = typeof document !== 'undefined' && document.fullscreenElement != null;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (!fullScreenFromHere && window.matchMedia?.('(display-mode: fullscreen)').matches)
    || (navigator as { standalone?: boolean }).standalone === true;
}

// Can this browser do full screen?
function canGoFullScreen(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

export default function FullScreenSwitch() {
  // Is the page full screen right now? (Starts from the browser's answer)
  const [on, setOn] = useState(() => (typeof document !== 'undefined' ? document.fullscreenElement != null : false));

  // The browser tells us when full screen starts or stops (including when
  // the person leaves it with Esc), so the switch always matches
  useEffect(() => {
    if (Platform.OS !== 'web' || !canGoFullScreen()) return;
    const onChange = () => setOn(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Not the website, or already an installed app: nothing to show
  if (Platform.OS !== 'web' || typeof window === 'undefined' || isInstalledApp()) return null;

  // This browser can't do full screen: say what to do instead
  if (!canGoFullScreen()) {
    return (
      <SettingRow
        name="Full screen"
        description="This browser can't hide its address bar. Add the site to your home screen instead (in the browser's Share or menu, choose Add to Home Screen) and it opens without one."
      />
    );
  }

  // Ask the browser to start or stop. It may say no (a failure is
  // ignored: the switch just stays where the browser left it).
  function change(want: boolean) {
    const done = want ? document.documentElement.requestFullscreen() : document.exitFullscreen();
    done.catch(() => { /* the browser said no */ });
  }

  return (
    <SwitchRow
      name="Full screen"
      description="Hides the browser's address bar to give you more room. Press Esc or swipe down from the top to leave."
      value={on}
      onChange={change}
    />
  );
}
