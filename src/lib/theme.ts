/* =====================================================================
   LIGHT / DARK THEME
   The CHOICE is one of three (on the Settings page):
   - "light" or "dark": always that
   - "system": follow the device's own light/dark setting, changing with
     it (like a phone that turns dark at night)
   The choice is saved as "theme". The screens ask currentTheme() which
   colors to use (see src/theme/colors.ts), and redraw when it changes
   (see src/hooks/useTheme.ts).
   React Native's "Appearance" tells us the device's own setting, on
   phones and on the web alike.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Appearance } from 'react-native';
import { storageGet, storageSet } from './storage';

// The two themes a screen can show, and the three choices
export type Theme = 'light' | 'dark';
export type ThemeChoice = Theme | 'system';

// The things to tell when the theme changes (like the switch, so it
// slides over, and every screen, so it redraws in the new colors)
const listeners = new Set<() => void>();
function themeChanged(): void {
  for (const listener of listeners) listener();
}

// The device's own setting right now (dark unless it says light: the
// app was designed dark-first, like the binder pages it shows)
function deviceTheme(): Theme {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

// The choice saved on this device. Nothing saved (or anything odd)
// means "system".
export function currentThemeChoice(): ThemeChoice {
  const saved = storageGet('theme');
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

// The theme showing right now: the choice, or the device's setting
export function currentTheme(): Theme {
  const choice = currentThemeChoice();
  return choice === 'system' ? deviceTheme() : choice;
}

// Save a choice, and tell every screen to redraw.
export function setThemeChoice(choice: ThemeChoice): void {
  storageSet('theme', choice);
  themeChanged();
}

// Switch to light or dark and remember it (the top bar's switch).
export function applyTheme(theme: Theme): void {
  setThemeChoice(theme);
}

// When the device's own setting changes, follow it, if the choice is
// "system".
Appearance.addChangeListener(() => {
  if (currentThemeChoice() === 'system') themeChanged();
});

// Start listening for theme changes. Returns a function that stops.
export function onThemeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
