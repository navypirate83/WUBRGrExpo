/* =====================================================================
   WHICH MENU FITS THE WINDOW RIGHT NOW
   A hook that gives "none" (the bottom tabs), "slim" (a narrow strip of
   icons down the left side) or "full" (the left menu with words),
   worked out from the window's size (see lib/layoutSize.ts for the
   rule) and from whether you collapsed the menu (lib/menuPreference.ts:
   a menu that would be full shows slim instead). It's drawn again
   whenever the window changes size (turning a phone, folding or opening
   a foldable, resizing the browser window) or the choice changes.
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';
import { menuStyleFor, menuWidthFor, type MenuStyle } from '@/lib/layoutSize';
import { isMenuCollapsed, onMenuCollapsedChange } from '@/lib/menuPreference';

// Has the menu been collapsed by the button? (Follows the saved choice.)
export function useMenuCollapsed(): boolean {
  return useSyncExternalStore(onMenuCollapsedChange, isMenuCollapsed, isMenuCollapsed);
}

export function useMenuStyle(): MenuStyle {
  // "useWindowDimensions" is React Native's way to ask how big the
  // window is, and it redraws the screen when that changes
  const { width, height } = useWindowDimensions();
  const collapsed = useMenuCollapsed();
  const fits = menuStyleFor(width, height);
  // Collapsed: a full menu is shown slim instead
  return fits === 'full' && collapsed ? 'slim' : fits;
}

// Is the window wide enough for the full menu? (Then the slim menu gets an
// "Expand" button, and the full menu a "Collapse" one.)
export function useFullMenuFits(): boolean {
  const { width, height } = useWindowDimensions();
  return menuStyleFor(width, height) === 'full';
}

// How wide the page is, with the side menu (if there is one) taken off.
// Screens that lay themselves out by width (the shelf's columns, the
// Card Finder) use this instead of the window's width, so they fit the
// space beside the menu. On a phone there's no menu, so it's the whole
// window, exactly as before.
export function useContentWidth(): number {
  const { width } = useWindowDimensions();
  return width - menuWidthFor(useMenuStyle());
}
