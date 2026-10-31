/* =====================================================================
   THE APP'S SETTINGS, FOR A SCREEN
   A hook that gives a screen the current settings (see lib/settings.ts),
   and draws the screen again whenever they change (on the Settings screen,
   or when they arrive from Google Drive).
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { currentSettings, onSettingsChange, settingsVersion } from '@/lib/settings';

export function useSettings() {
  // "useSyncExternalStore" listens with onSettingsChange, and redraws
  // when settingsVersion() comes back different
  useSyncExternalStore(onSettingsChange, settingsVersion);
  return currentSettings();
}
