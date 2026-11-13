/* =====================================================================
   THE BAR AT THE TOP OF EVERY SCREEN (the "header")
   One header for every screen, so it's the same size everywhere: the
   tabs (Home, Card Finder, Settings), The Shelf's screens (the shelf,
   lists, a binder, a list) and the screens that slide in on top (Help,
   Decks). Without it, phones drew two kinds of header at two different
   heights.
   It's HEADER_HEIGHT points tall (a slim bar: the usual phone header,
   56 points, less a quarter), plus the room the phone's status bar
   (clock, battery) needs above it. From left to right:
     - the back arrow, on every screen, so it's always in the same
       place. It takes you to the page you were just on, and again, back
       to the page you first opened the app on (see lib/navHistory.ts).
       On that first page there's nowhere to go back to, so it's grayed
       out. (A screen can put its own button there instead.)
     - the screen's title (or its own title piece, like the binder's
       name with its save check mark)
     - the screen's own buttons (like Help)
   The navigators hand it each screen's settings ("options"); screens
   change them with navigation.setOptions, as before.
   ===================================================================== */

import { useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { canGoBackInApp, goBackInApp, onHistoryChange } from '@/lib/navHistory';
import SymbolText from '@/components/SymbolText';

// How tall the bar is (points), not counting the status bar's room
export const HEADER_HEIGHT = 42;

// What the navigators hand the header (only the parts it uses)
type HeaderProps = {
  options: {
    title?: string;
    headerTitle?: string | ((props: { children: string; tintColor?: string }) => ReactNode);
    headerLeft?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
    headerRight?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
  };
  route: { name: string };
  // Set when there's a screen to go back to in this screen's own stack
  // (the arrow doesn't use it: it goes by the trail of every page visited)
  back?: unknown;
};

export default function AppHeader({ options, route, back }: HeaderProps) {
  const colors = useColors();
  // The room the phone's status bar takes at the top (0 on the web)
  const insets = useSafeAreaInsets();
  const title = options.title ?? route.name;
  const canGoBack = Boolean(back);

  // Is there a page before this one? (The header redraws when the trail
  // of pages changes.)
  const canBack = useSyncExternalStore(onHistoryChange, canGoBackInApp, canGoBackInApp);

  // The left end: the screen's own button if it has one, or else the back
  // arrow. The arrow is always drawn; with nowhere to go back to (the first
  // page opened) it's grayed out and can't be pressed.
  const own = options.headerLeft ? options.headerLeft({ tintColor: colors.text, canGoBack }) : null;
  const left = own ?? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      accessibilityHint={canBack ? 'Goes to the page you were just on' : 'There is no earlier page'}
      accessibilityState={{ disabled: !canBack }}
      disabled={!canBack}
      hitSlop={8}
      onPress={goBackInApp}
      style={({ pressed }) => [styles.back, !canBack && styles.disabled, pressed && styles.pressed]}
    >
      <Ionicons name="arrow-back" size={22} color={canBack ? colors.text : colors.muted} />
    </Pressable>
  );

  // The title: the screen's own title piece, or its title as words
  const titlePiece = typeof options.headerTitle === 'function'
    ? options.headerTitle({ children: title, tintColor: colors.text })
    : (
      <SymbolText style={[styles.title, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">
        {typeof options.headerTitle === 'string' ? options.headerTitle : title}
      </SymbolText>
    );

  return (
    <View style={[styles.bar, {
      height: HEADER_HEIGHT + insets.top, paddingTop: insets.top,
      backgroundColor: colors.surface, borderBottomColor: colors.border,
    }]}>
      {left}
      <View style={[styles.titleArea, !left && styles.titleAreaNoLeft]}>{titlePiece}</View>
      {options.headerRight?.({ tintColor: colors.text, canGoBack })}
    </View>
  );
}

// The bar's look: everything in one row, centered top to bottom, with a
// thin line under the bar
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { paddingHorizontal: 6, paddingVertical: 4, marginRight: 4 },
  pressed: { opacity: 0.5 },
  // Nowhere to go back to: faded, so it's clear it can't be pressed
  disabled: { opacity: 0.35 },
  titleArea: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  titleAreaNoLeft: { paddingLeft: 8 },
  title: { fontSize: 16, fontWeight: '700' },
});
