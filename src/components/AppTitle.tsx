/* =====================================================================
   THE APP'S NAME, IN MAGIC'S FIVE COLORS
   "WUBRG'r" at the top left of the Home screen, with each of the first
   five letters in its Magic color: W white, U blue, B purple (black
   mana), R red, G green, then "'r" in the normal text color.
   In the light theme, the white W gets a thin black outline so it shows
   on the pale background. Phones can't draw an outline around text, so
   the outline is made from four black copies of the W, each nudged one
   point to a corner, with the white W drawn on top (the same trick the
   original website used, with shadows).
   Screen readers hear the whole name at once, not letter by letter.
   ===================================================================== */

import { StyleSheet, Text, View } from 'react-native';
import { useColors, useTheme } from '@/hooks/useTheme';

// The four corners the black copies are nudged to (in points)
const OUTLINE_NUDGES = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

export default function AppTitle() {
  const colors = useColors();
  const outlined = useTheme() === 'light';

  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="WUBRG'r">
      {/* The W: white, on top of its black outline (light theme only) */}
      <View>
        {outlined && OUTLINE_NUDGES.map(([x, y]) => (
          <Text key={`${x},${y}`} style={[styles.letters, styles.outline, { left: x, top: y }]}>W</Text>
        ))}
        <Text style={[styles.letters, { color: '#ffffff' }]}>W</Text>
      </View>
      {/* U, B, R and G in their colors, then 'r */}
      <Text style={styles.letters}>
        <Text style={{ color: colors.manaU }}>U</Text>
        <Text style={{ color: colors.manaB }}>B</Text>
        <Text style={{ color: colors.manaR }}>R</Text>
        <Text style={{ color: colors.manaG }}>G</Text>
        <Text style={{ color: colors.text }}>'r</Text>
      </Text>
    </View>
  );
}

// The name's look: bold letters side by side; an outline copy sits
// exactly behind the white W ("absolute"), nudged by its corner
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  letters: { fontSize: 20, fontWeight: '800' },
  outline: { position: 'absolute', color: '#000000' },
});
