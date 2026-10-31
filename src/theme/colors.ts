/* =====================================================================
   THE APP'S COLORS (light and dark)
   Every screen takes its colors from here, through the useColors() hook
   (src/hooks/useTheme.ts), so switching the theme recolors everything.
   These are the same colors as the original site's stylesheet.
   Shadows are written the way CSS writes them ("boxShadow"), which React
   Native understands too, on phones and the web.
   ===================================================================== */

import type { Theme } from '@/lib/theme';

// The colors that change between light and dark
const light = {
  bg: '#f4f1ea',              // the page background
  surface: '#ffffff',         // boxes, cards and panels on top of it
  surfaceHover: '#f0ebe1',    // a slightly darker surface (pressed rows, title bars)
  text: '#1e1c19',            // normal text
  muted: '#6c675f',           // quieter text (hints, captions)
  border: '#d8d2c6',          // thin lines around boxes
  accent: '#a8492a',          // the orange used for buttons and highlights
  accentText: '#ffffff',      // text on top of the accent color
  error: '#c0392b',           // error messages
  switchTrack: '#e3dccf',     // an on/off switch's track
  switchThumb: '#ffffff',     // an on/off switch's knob
  googleBg: '#ffffff',        // Google's sign-in button
  googleBorder: '#747775',
  googleText: '#1f1f1f',
  // A general shadow for pop-ups, a card's shadow (and bigger, lifted),
  // and a binder's shadow on the shelf (and lifted)
  shadow: '0px 10px 30px rgba(40, 30, 20, 0.15)',
  cardShadow: '0px 2px 4px rgba(40, 30, 20, 0.18), 0px 8px 18px rgba(40, 30, 20, 0.16)',
  cardShadowLift: '0px 6px 10px rgba(40, 30, 20, 0.16), 0px 22px 36px rgba(40, 30, 20, 0.22)',
  binderShadow: '0px 4px 8px rgba(40, 30, 20, 0.20), 0px 14px 28px rgba(40, 30, 20, 0.25)',
  binderShadowLift: '0px 8px 14px rgba(40, 30, 20, 0.22), 0px 24px 40px rgba(40, 30, 20, 0.30)',
  // Set symbols are black pictures: dark mode tints them light
  iconTint: undefined as string | undefined,
  // "Saved" (the green check mark beside a binder's name)
  success: '#2e7d32',
  // Inside an open binder: the cover around the pages, a page, an empty
  // pocket, a pocket's plastic edge, a pressed pocket's shine, and the
  // "+" in an empty pocket. Light: a pale binder with cream pages.
  binderCover: '#c9bfae',
  binderPage: '#e9e3d7',
  pocketFill: '#f7f3ec',
  pocketEdge: 'rgba(0, 0, 0, 0.12)',
  pocketShine: 'rgba(0, 0, 0, 0.05)',
  pocketPlus: '#a8492a',
};

const dark: typeof light = {
  bg: '#14151a',
  surface: '#1e2027',
  surfaceHover: '#2a2d36',
  text: '#ece9e3',
  muted: '#9b968e',
  border: '#343741',
  accent: '#e38a5c',
  accentText: '#1a1206',
  error: '#f07167',
  switchTrack: '#2f323c',
  switchThumb: '#14151a',
  googleBg: '#131314',
  googleBorder: '#8e918f',
  googleText: '#e3e3e3',
  shadow: '0px 10px 30px rgba(0, 0, 0, 0.5)',
  cardShadow: '0px 2px 4px rgba(0, 0, 0, 0.6), 0px 10px 22px rgba(0, 0, 0, 0.65)',
  cardShadowLift: '0px 8px 12px rgba(0, 0, 0, 0.6), 0px 26px 40px rgba(0, 0, 0, 0.75)',
  binderShadow: '0px 4px 8px rgba(0, 0, 0, 0.6), 0px 14px 28px rgba(0, 0, 0, 0.7)',
  binderShadowLift: '0px 8px 14px rgba(0, 0, 0, 0.6), 0px 24px 40px rgba(0, 0, 0, 0.8)',
  iconTint: '#ece9e3',
  success: '#4caf50',
  // Dark: a black binder with black pages and see-through plastic pockets
  binderCover: '#0b0b0d',
  binderPage: '#1b1b1f',
  pocketFill: '#232328',
  pocketEdge: 'rgba(255, 255, 255, 0.10)',
  pocketShine: 'rgba(255, 255, 255, 0.07)',
  pocketPlus: '#e38a5c',
};

// The colors that are the same in both themes
export const fixed = {
  danger: '#c0392b',           // delete buttons
  dangerBright: '#e74c3c',     // a delete button being pressed
  // The bright orange, used in both themes on things that always sit on
  // black (like the copies bar over a card), where the darker one is hard to see
  accentOnDark: '#e38a5c',
};

// The colors for one theme, plus the fixed ones
export type Colors = typeof light & typeof fixed;
export function colorsFor(theme: Theme): Colors {
  return { ...(theme === 'dark' ? dark : light), ...fixed };
}

// How rounded boxes, buttons and drop-downs are, and the spacing steps
// used around the app
export const RADIUS = 10;
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

// The widest the main content gets on a big screen (a tablet or
// computer), so lines of text don't stretch across the whole window
export const MAX_CONTENT_WIDTH = 960;
