/* =====================================================================
   THE SHELF TAB'S STACK OF SCREENS
   Inside The Shelf tab, screens pile up like cards: the shelf of
   binders is at the bottom, and opening a binder slides its pages in on
   top (with a back arrow, and a swipe from the left edge to go back on
   iPhone). This "Stack" is what makes that work.
   - index.tsx: your binders (/binders)
   - lists.tsx: your lists (/binders/lists), switched to and from the
                shelf with the Binders / Lists buttons. It swaps in
                without sliding, since it's the shelf's other side.
   - decks.tsx: your decks (/binders/decks), the shelf's third side.
                Switched to and from the others the same way as lists,
                with no sliding.
   - deck/[id].tsx: one deck (/binders/deck/abc123), sliding in over the
                decks
   - list/[id].tsx: one list (/binders/list/abc123), sliding in over
                the lists
   - [id].tsx:  one binder (/binders/abc123: the part in [brackets] is
                the binder's id, which changes from binder to binder)
   ===================================================================== */

import { View } from 'react-native';
import { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import HelpButton from '@/components/HelpButton';
import AppHeader from '@/components/AppHeader';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import { useColors } from '@/hooks/useTheme';
import { rememberShelfPlace } from '@/lib/shelfMemory';

// The shelf is always at the bottom of this stack, even when a binder
// is opened straight from its address (a shared link, a reminder, or
// reloading the page), so the back arrow always leads to the shelf
export const unstable_settings = { initialRouteName: 'index' };

// The right end of the header on the shelf's three pages: the small
// Binders / Lists / Decks switch, then the Help button (each hides itself
// when the side menu is showing)
function shelfHeaderRight(page: 'binders' | 'lists' | 'decks') {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ShelfSwitch current={page} />
      <HelpButton topic="my-binders" />
    </View>
  );
}

export default function BindersLayout() {
  const colors = useColors();
  // Note where you are in the shelf every time the address changes, so the
  // Binders / Lists / Decks buttons and the Shelf button can bring you back
  // to it (see lib/shelfMemory.ts). This stays on while you visit Settings
  // or the Card Finder; those addresses are ignored.
  const pathname = usePathname();
  useEffect(() => { rememberShelfPlace(pathname); }, [pathname]);
  return (
    <Stack
      screenOptions={{
        // Every screen's bar at the top is the app's own, so they're all
        // the same slim size (see AppHeader.tsx)
        header: (props) => <AppHeader {...props} />,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerRight: () => <HelpButton topic="my-binders" />,
      }}
    >
      {/* Your binders. The header holds the small Binders / Lists / Decks
          switch (phones only) and the Help button. */}
      <Stack.Screen name="index" options={{ title: 'Binders', headerRight: () => shelfHeaderRight('binders') }} />
      {/* Your lists: no sliding in (it swaps in for the binders) */}
      <Stack.Screen name="lists" options={{ title: 'Lists', animation: 'none', headerRight: () => shelfHeaderRight('lists') }} />
      {/* Your decks: the same as the lists page */}
      <Stack.Screen name="decks" options={{ title: 'Decks', animation: 'none', headerRight: () => shelfHeaderRight('decks') }} />
      {/* One deck: it slides in over the decks. Its title is set by the deck
          screen itself (the deck's name). */}
      <Stack.Screen name="deck/[id]" options={{ title: 'Deck' }} />
      {/* One list: it slides in over the lists, with a back arrow. Its
          title is set by the list screen itself (the list's name). */}
      <Stack.Screen name="list/[id]" options={{ title: 'List' }} />
      {/* One binder: its title is set by the binder screen itself (the
          binder's name), and its Help goes to the binder topic */}
      <Stack.Screen name="[id]" options={{ title: 'Binder', headerRight: () => <HelpButton topic="binder" /> }} />
    </Stack>
  );
}
