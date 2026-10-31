/* =====================================================================
   THE THEME AND ITS COLORS, FOR A SCREEN
   useTheme() gives a screen the theme showing ("light" or "dark"), and
   useColors() gives it that theme's colors (see src/theme/colors.ts).
   Both draw the screen again whenever the theme changes (the switch,
   the Settings screen, or the device turning dark at night).
   ===================================================================== */

import { useMemo, useSyncExternalStore } from 'react';
import { currentTheme, onThemeChange, type Theme } from '@/lib/theme';
import { colorsFor, type Colors } from '@/theme/colors';

// The theme showing right now. "useSyncExternalStore" is React's way to
// follow something kept outside React: it listens with onThemeChange,
// and redraws when currentTheme() comes back different.
export function useTheme(): Theme {
  return useSyncExternalStore(onThemeChange, currentTheme, currentTheme);
}

// The colors for the theme showing. "useMemo" keeps the same set of
// colors between redraws until the theme actually changes.
export function useColors(): Colors {
  const theme = useTheme();
  return useMemo(() => colorsFor(theme), [theme]);
}
