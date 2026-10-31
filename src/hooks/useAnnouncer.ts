/* =====================================================================
   SPEAKING TO SCREEN READERS
   A hook that gives a screen an "announce" function: it asks the
   phone's screen reader (VoiceOver on iPhone, TalkBack on Android, or a
   browser's screen reader) to read a message out, like what a shortcut
   key just did ("Set 2 of 6: Innistrad").
   React Native's AccessibilityInfo does the asking; when no screen
   reader is on, nothing happens.
   ===================================================================== */

import { useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useAnnouncer() {
  // Say something (useCallback keeps the same function between redraws)
  const announce = useCallback((text: string) => {
    AccessibilityInfo.announceForAccessibility(text);
  }, []);
  return { announce };
}
