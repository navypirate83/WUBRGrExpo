/* =====================================================================
   BINDERS, LISTS OR DECKS: THE SWITCH IN THE HEADER
   Three small picture buttons side by side in the header, beside the
   title: an open binder (your binders), a spiral notebook (your lists)
   and a Commander deck box (your decks). They're in the header of the
   shelf's three main pages AND of an opened binder or list, so you can
   always jump between the parts of the shelf.
   - The button for the part you're in has an orange outline. On that
     part's main page it can't be pressed (you're already there). Inside a
     binder or list, pressing it goes up to that part's main page.
   - The other buttons go to the last place you were in that part (the
     list you had open, say), or its main page if there isn't one: see
     lib/shelfMemory.ts. Switching swaps the page in place instead of
     sliding, so there's no back arrow between them.
   When the side menu is showing it already has Binders, Lists and Decks,
   so this switch hides itself.
   ===================================================================== */

import { Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import { useMenuStyle } from '@/hooks/useMenuStyle';
import { sectionHref } from '@/lib/shelfMemory';
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
  // Are we on the main page of the current part (not inside a binder or list)?
  const pathname = usePathname().replace(/\/+$/, '');
  const atMain = pathname === PAGES[current].to;
  if (hasSideMenu) return null;

  return (
    <View style={styles.row}>
      {(Object.keys(PAGES) as Page[]).map((page) => {
        const here = page === current;
        // Your own part: up to its main page (nothing to do if you're there)
        const stuck = here && atMain;
        return (
          <Pressable
            key={page}
            accessibilityRole="button"
            accessibilityLabel={stuck ? `${PAGES[page].name} (showing)`
              : here ? `Go to the main ${PAGES[page].name.toLowerCase()} page`
                : `Show your ${PAGES[page].name.toLowerCase()}`}
            accessibilityState={{ disabled: stuck, selected: here }}
            disabled={stuck}
            onPress={() => {
              if (here) router.navigate(PAGES[page].to as never);
              else router.replace(sectionHref(page) as never);
            }}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.surface, borderColor: here ? colors.accent : colors.border },
              here && styles.here,
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

// The switch's look: small buttons in a row; your own part has an orange
// outline (a little thicker). A little room before the buttons to its right.
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 },
  button: { width: 34, height: 30, borderRadius: RADIUS - 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  here: { borderWidth: 2 },
  pressed: { opacity: 0.6 },
  picture: { width: 22, height: 18 },
});
