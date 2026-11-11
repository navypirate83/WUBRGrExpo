/* =====================================================================
   HOW MUCH ROOM THE APP HAS, AND WHICH MENU THAT CALLS FOR
   The app picks its navigation by the size of the window it is drawn
   in, NOT by the kind of device. So the same rule covers phones,
   tablets, a foldable folded or opened, the website in a small or big
   browser window, and a window being resized or a phone being turned.
   The sizes are in "dp" (the units the app measures in; a point on a
   phone, a CSS pixel on the website). The rule:
     - narrower than 600 wide          -> no side menu: the bottom tabs
                                          (how the app has always looked)
     - shorter than 500 tall           -> the slim icon menu (a phone
                                          held sideways is wide, but
                                          has no height to spare)
     - 600 to 839 wide                 -> the slim icon menu
     - 840 wide or more                -> the full menu with words
   Plain TypeScript with no React in it.
   ===================================================================== */

// Which menu to show: none (use the bottom tabs), slim (icons only) or full
export type MenuStyle = 'none' | 'slim' | 'full';

// How wide each menu is (dp). The page beside it gets the rest.
export const FULL_MENU_WIDTH = 230;
export const SLIM_MENU_WIDTH = 72;

// The cut-off sizes, written once here
export const SLIM_MENU_MIN_WIDTH = 600;
export const FULL_MENU_MIN_WIDTH = 840;
export const SHORT_WINDOW_HEIGHT = 500;

// How much width the menu takes (0 when there's none, so the page gets it all)
export function menuWidthFor(menu: MenuStyle): number {
  return menu === 'full' ? FULL_MENU_WIDTH : menu === 'slim' ? SLIM_MENU_WIDTH : 0;
}

// The menu for a window of this width and height
export function menuStyleFor(width: number, height: number): MenuStyle {
  // Narrow (a normal phone, or a folded foldable): the bottom tabs
  if (width < SLIM_MENU_MIN_WIDTH) return 'none';
  // Wide enough for a side menu, but short (a phone held sideways): the
  // full menu wouldn't fit down the side, so use the slim one
  if (height < SHORT_WINDOW_HEIGHT) return 'slim';
  // Medium wide (small tablets, many opened foldables): slim
  if (width < FULL_MENU_MIN_WIDTH) return 'slim';
  return 'full';
}
