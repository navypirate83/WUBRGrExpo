/* =====================================================================
   BINDERS, LISTS OR DECKS: THE SWITCH IN THE HEADER
   Three small picture buttons side by side in the header of The Shelf's
   pages, beside the title: an open binder (your binders), a spiral
   notebook (your lists) and a Commander deck box (your decks). The
   button for the page you're already on is faded out and can't be
   pressed; the others switch to their pages.
   When the side menu is showing it already has Binders, Lists and Decks,
   so this switch hides itself.
   Switching "replaces" the page instead of piling the new one on top,
   so there's no back arrow between them: they're three views of the
   same shelf.
   ===================================================================== */

import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import { useMenuStyle } from '@/hooks/useMenuStyle';
import { RADIUS } from '@/theme/colors';

// The pages, each with its picture (one of the app's own line drawings)
// and its address
const PAGES = {
  binders: { name: 'Binders', picture: require('../../../assets/images/binder-outline.svg') as number, to: '/binders' },
  lists: { name: 'Lists', picture: require('../../../assets/images/notebook-outline.svg') as number, to: '/binders/lists' },
  decks: { name: 'Decks', picture: require('../../../assets/images/deckbox-outline.svg') as number, to: '/binders/decks' },
} as const;

type Page = keyof typeof PAGES;

export default function ShelfSwitch({ current }: { current: Page }) {
  const colors = useColors();
  // With the side menu showing there's nothing to switch with here
  const hasSideMenu = useMenuStyle() !== 'none';
  if (hasSideMenu) return null;

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
    </View>
  );
}

// The switch's look: small buttons in a row, with a little room before the
// Help button to their right
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 4 },
  button: { width: 38, height: 30, borderRadius: RADIUS - 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ghost: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  picture: { width: 24, height: 20 },
});
