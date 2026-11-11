/* =====================================================================
   SETTINGS → FULL SCREEN (website only)
   A switch that fills the whole screen with the page, which hides the
   browser's address bar (and its other bars) to give the app more room.
   - It only shows on the website, and only in browsers that allow it
     (most on Android and computers; iPhones and iPads don't, so there
     the Help topic suggests "Add to Home Screen" instead).
   - It also hides itself when the site is already running as an
     installed app (that has no address bar to hide).
   - A browser only goes full screen after a tap, and pressing Esc (or
     swiping down) leaves it, so the switch follows what the browser
     actually did rather than assuming.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SwitchRow } from './SettingsParts';

// Can this browser do full screen, and is the site not already an app?
function canGoFullScreen(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const installed = window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches;
  return document.fullscreenEnabled === true && !installed;
}

export default function FullScreenSwitch() {
  // Is the page full screen right now? (Starts from the browser's answer)
  const [on, setOn] = useState(() => (typeof document !== 'undefined' ? document.fullscreenElement != null : false));

  // The browser tells us when full screen starts or stops (including when
  // the person leaves it with Esc), so the switch always matches
  useEffect(() => {
    if (!canGoFullScreen()) return;
    const onChange = () => setOn(document.fullscreenElement != null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!canGoFullScreen()) return null;

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
