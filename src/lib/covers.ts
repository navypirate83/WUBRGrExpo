/* =====================================================================
   COVER COLORS: HOW TO DRAW ONE
   A cover (a binder on the shelf, a color swatch, a dot in a menu) is
   drawn with four shades: "light", "base" and "dark" (a sheen from
   corner to corner) and "edge" (its thin border).
   - One of the named colors ("gold"): its shades are in NAMED_SHADES
     below (the same as the original site's covers.css).
   - A custom color ("#3a7bd5"): the shades are worked out here, by
     mixing it with white and black.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { COVER_COLORS, cleanCover, isCustomCover } from './binderStorage';

// The four shades of one cover
export type CoverShades = { light: string; base: string; dark: string; edge: string };

// The shades of each named cover color
const NAMED_SHADES: Record<string, CoverShades> = {
  black:  { light: '#2a2a30', base: '#121214', dark: '#050506', edge: '#2a2a2e' },
  white:  { light: '#fbfaf7', base: '#e9e6df', dark: '#c9c4b8', edge: '#b8b2a5' },
  blue:   { light: '#3a6fb5', base: '#1f4f8f', dark: '#12305a', edge: '#2c5d9e' },
  red:    { light: '#b33a32', base: '#8e2020', dark: '#561010', edge: '#a02c28' },
  green:  { light: '#2f8a50', base: '#1f6a3a', dark: '#113f22', edge: '#287a45' },
  gold:   { light: '#dcb64a', base: '#b8902a', dark: '#7d5f14', edge: '#9c7a20' },
  purple: { light: '#7d4bb3', base: '#5b2d8e', dark: '#361a57', edge: '#6a3aa0' },
  orange: { light: '#e8893a', base: '#c8641c', dark: '#8a3f0c', edge: '#a9541a' },
  gray:   { light: '#d6d8dc', base: '#b9bcc2', dark: '#8d9096', edge: '#9a9da3' },
};

// Split "#3a7bd5" into its red, green and blue amounts (each 0 to 255).
function colorParts(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// Blend two colors: "amount" of the way from the first to the second
// (0.25 = a quarter of the way). Gives back a "#rrggbb" code.
function mixColors(hex: string, towards: string, amount: number): string {
  const from = colorParts(hex);
  const to = colorParts(towards);
  return '#' + from.map((value, i) => {
    const mixed = Math.round(value + (to[i] - value) * amount);
    return mixed.toString(16).padStart(2, '0');
  }).join('');
}

// How bright a color looks, from 0 (black) to 1 (white). Green looks
// brighter to our eyes than red, and red than blue, so they count
// differently (the usual "perceived brightness" weights).
function brightness(hex: string): number {
  const [r, g, b] = colorParts(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// How to draw a cover color: its four shades, and whether it's a pale
// cover (whose name label then needs dark text).
export function coverLook(code: string | null | undefined): { shades: CoverShades; light: boolean } {
  const clean = cleanCover(code);
  if (isCustomCover(clean)) {
    return {
      shades: {
        light: mixColors(clean, '#ffffff', 0.25),   // a quarter white
        base: clean,
        dark: mixColors(clean, '#000000', 0.45),    // nearly half black
        edge: mixColors(clean, '#000000', 0.2),
      },
      light: brightness(clean) > 0.6,
    };
  }
  return {
    shades: NAMED_SHADES[clean] ?? NAMED_SHADES.black,
    light: COVER_COLORS.find((c) => c.code === clean)?.light === true,
  };
}

// The readable name of a cover color, e.g. "gray" -> "Light gray", or
// "Custom color" for one picked with the color chooser.
export function coverColorName(code: string | null | undefined): string {
  const clean = cleanCover(code);
  return isCustomCover(clean) ? 'Custom color' : COVER_COLORS.find((c) => c.code === clean)!.name;
}
