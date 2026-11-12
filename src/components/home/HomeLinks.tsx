/* =====================================================================
   THE HOME SCREEN'S LIST OF PLACES TO GO
   A rounded box of rows, one per part of the app: The Shelf (only for
   someone using the binders), Card Finder, Lists, Decks and Help. Each
   row has an icon, a name, a short line about it, and an arrow (">")
   showing it opens something. Tapping a row goes there.
   (The tabs at the bottom also go to The Shelf and Card Finder; Lists
   and Decks are only reached from here, as the original site's top bar
   linked to them.)
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { RADIUS, SPACE } from '@/theme/colors';

// One place to go: its address, icon, name and short description
type Place = {
  to: Href;
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  about: string;
};

// Every place, in order. The Shelf is first, but only for someone using
// the binders (see "showShelf" below).
const SHELF: Place = { to: '/binders', icon: 'library-outline', name: 'The Shelf', about: 'Your binders' };
const PLACES: Place[] = [
  { to: '/search', icon: 'search-outline', name: 'Card Finder', about: 'Look up any Magic card' },
  { to: '/binders/lists', icon: 'list-outline', name: 'Lists', about: 'Your card lists' },
  { to: '/binders/decks', icon: 'albums-outline', name: 'Decks', about: 'Your decklists (still being built)' },
  { to: '/help', icon: 'help-circle-outline', name: 'Help', about: 'How everything works' },
];

export default function HomeLinks({ showShelf }: { showShelf: boolean }) {
  const colors = useColors();
  const places = showShelf ? [SHELF, ...PLACES] : PLACES;
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {places.map((place, index) => (
        // One row. A thin line separates it from the row above (not on
        // the first). It darkens a little while pressed.
        <Pressable
          key={place.name}
          accessibilityRole="link"
          accessibilityLabel={`${place.name}: ${place.about}`}
          onPress={() => router.push(place.to)}
          style={({ pressed }) => [
            styles.row,
            index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
            pressed && { backgroundColor: colors.surfaceHover },
          ]}
        >
          <Ionicons name={place.icon} size={24} color={colors.accent} />
          {/* The name, with its description under it */}
          <View style={styles.words}>
            <Text style={[styles.name, { color: colors.text }]}>{place.name}</Text>
            <Text style={[styles.about, { color: colors.muted }]}>{place.about}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

// The box's look: rounded, with rows at least 56 points tall (plenty of
// room for a finger)
const styles = StyleSheet.create({
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS, overflow: 'hidden' },
  row: {
    minHeight: 56, paddingHorizontal: SPACE.l, paddingVertical: SPACE.s,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.m,
  },
  words: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  about: { fontSize: 14, marginTop: 2 },
});
