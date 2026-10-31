/* =====================================================================
   BINDERS OR LISTS: THE SWITCH ABOVE THE SEARCH BAR
   Two picture buttons side by side at the top of The Shelf tab: an open
   binder (your binders) and a spiral notebook (your lists), then the
   name of the page you're on ("Binders" or "Lists"). The button for the
   page you're already on is faded out and can't be pressed; the other
   one switches to its page.
   Switching "replaces" the page instead of piling the new one on top,
   so there's no back arrow between the two: they're two views of the
   same shelf.
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

// The two pages, each with its picture and its address
const PAGES = {
  binders: { name: 'Binders', picture: require('../../../assets/images/binder-outline.svg') as number, to: '/binders' },
  lists: { name: 'Lists', picture: require('../../../assets/images/notebook-outline.svg') as number, to: '/binders/lists' },
} as const;

type Page = keyof typeof PAGES;

export default function ShelfSwitch({ current }: { current: Page }) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      {(Object.keys(PAGES) as Page[]).map((page) => {
        const here = page === current;
        return (
          // One button: faded and switched off on its own page
          <Pressable
            key={page}
            accessibilityRole="button"
            accessibilityLabel={here ? `${PAGES[page].name} (showing)` : `Show your ${PAGES[page].name.toLowerCase()}`}
            accessibilityState={{ disabled: here, selected: here }}
            disabled={here}
            onPress={() => router.replace(PAGES[page].to as never)}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.surface, borderColor: colors.border },
              here && styles.ghost,
              pressed && styles.pressed,
            ]}
          >
            {/* The line drawing, in the theme's text color */}
            <Image source={PAGES[page].picture} style={styles.picture} contentFit="contain" tintColor={colors.text} />
          </Pressable>
        );
      })}
      {/* The page you're on */}
      <Text style={[styles.name, { color: colors.text }]} accessibilityRole="header">{PAGES[current].name}</Text>
    </View>
  );
}

// The switch's look: two square buttons and the page's name, in a row
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { width: 52, height: 44, borderRadius: RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ghost: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  picture: { width: 34, height: 28 },
  name: { fontSize: 18, fontWeight: '700', marginLeft: 4 },
});
