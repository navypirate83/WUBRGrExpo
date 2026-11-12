/* =====================================================================
   DECKS (/binders/decks)
   The third page of The Shelf, after Binders and Lists. It isn't built
   yet: this is the place to build it, already wired in so that
   - on a phone it has the same Binders / Lists / Decks buttons at the top
     as the other two pages (see ShelfSwitch.tsx), and
   - on a wide screen the side menu lists Decks under Lists and
     highlights it here (see SideMenu.tsx).
   For now the page just says it is still being built.
   When the page is built, replace the "still being built" message with
   the decks themselves, and keep the switch at the top.
   ===================================================================== */

import { StyleSheet, View } from 'react-native';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import StillBuilding from '@/components/StillBuilding';
import { useMenuStyle } from '@/hooks/useMenuStyle';
import { SPACE } from '@/theme/colors';

export default function DecksScreen() {
  // With a side menu showing, it already has Binders, Lists and Decks, so
  // the switch at the top of this page would only waste room (the same
  // rule as the Binders and Lists pages)
  const hasSideMenu = useMenuStyle() !== 'none';
  return (
    <View style={styles.page}>
      {/* The switch between Binders, Lists and Decks (phones only) */}
      {!hasSideMenu && (
        <View style={styles.header}>
          <ShelfSwitch current="decks" />
        </View>
      )}
      {/* The rest of the page: the "still being built" message */}
      <StillBuilding title="Decks" message="This screen is still being built." />
    </View>
  );
}

// The switch sits at the top with room around it; the message fills the rest
const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { paddingHorizontal: SPACE.l, paddingTop: SPACE.l },
});
