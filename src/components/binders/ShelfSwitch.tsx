/* =====================================================================
   BINDERS, LISTS OR DECKS: THE SWITCH ABOVE THE SEARCH BAR
   Three picture buttons side by side at the top of The Shelf tab: an
   open binder (your binders), a spiral notebook (your lists) and a stack
   of cards (your decks). The button for the page you're already on is
   faded out and can't be pressed; the others switch to their pages. (The
   page's name isn't repeated here: the header above already says it.)
   Switching "replaces" the page instead of piling the new one on top,
   so there's no back arrow between them: they're three views of the
   same shelf.
   ===================================================================== */

import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

// The pages, each with its address and its picture: one of the app's own
// line drawings, or (for Decks, which has no drawing yet) an icon from the
// same icon set the Home screen uses for it
type PageInfo = { name: string; to: string; picture?: number; icon?: keyof typeof Ionicons.glyphMap };
const PAGES = {
  binders: { name: 'Binders', picture: require('../../../assets/images/binder-outline.svg') as number, to: '/binders' },
  lists: { name: 'Lists', picture: require('../../../assets/images/notebook-outline.svg') as number, to: '/binders/lists' },
  decks: { name: 'Decks', icon: 'albums-outline', to: '/binders/decks' },
} satisfies Record<string, PageInfo>;

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
            {/* The line drawing (or icon), in the theme's text color */}
            {'picture' in PAGES[page]
              ? <Image source={(PAGES[page] as PageInfo).picture} style={styles.picture} contentFit="contain" tintColor={colors.text} />
              : <Ionicons name={(PAGES[page] as PageInfo).icon!} size={28} color={colors.text} />}
          </Pressable>
        );
      })}
    </View>
  );
}

// The switch's look: the square buttons, in a row
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { width: 52, height: 44, borderRadius: RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ghost: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  picture: { width: 34, height: 28 },
});
