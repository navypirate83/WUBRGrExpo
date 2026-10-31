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
     - the back arrow, when there's a screen to go back to (or the
       screen's own left button, like the Card Finder's)
     - the screen's title (or its own title piece, like the binder's
       name with its save check mark)
     - the screen's own buttons (like Help)
   The navigators hand it each screen's settings ("options"); screens
   change them with navigation.setOptions, as before.
   ===================================================================== */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';

// How tall the bar is (points), not counting the status bar's room
export const HEADER_HEIGHT = 42;

// What the navigators hand the header (only the parts it uses)
type HeaderProps = {
  options: {
    title?: string;
    headerTitle?: string | ((props: { children: string; tintColor?: string }) => ReactNode);
    headerLeft?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
    headerRight?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
    headerBackVisible?: boolean;
  };
  navigation: { goBack: () => void };
  route: { name: string };
  // Set when there's a screen to go back to (in a stack)
  back?: unknown;
};

export default function AppHeader({ options, navigation, route, back }: HeaderProps) {
  const colors = useColors();
  // The room the phone's status bar takes at the top (0 on the web)
  const insets = useSafeAreaInsets();
  const title = options.title ?? route.name;
  const canGoBack = Boolean(back);

  // The left end: the screen's own button, or else the back arrow (when
  // there's somewhere to go back to, and the screen hasn't hidden it)
  const left = options.headerLeft
    ? options.headerLeft({ tintColor: colors.text, canGoBack })
    : canGoBack && options.headerBackVisible !== false
      ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}
                   onPress={() => navigation.goBack()}
                   style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      )
      : null;

  // The title: the screen's own title piece, or its title as words
  const titlePiece = typeof options.headerTitle === 'function'
    ? options.headerTitle({ children: title, tintColor: colors.text })
    : (
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">
        {typeof options.headerTitle === 'string' ? options.headerTitle : title}
      </Text>
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
  titleArea: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  titleAreaNoLeft: { paddingLeft: 8 },
  title: { fontSize: 16, fontWeight: '700' },
});
