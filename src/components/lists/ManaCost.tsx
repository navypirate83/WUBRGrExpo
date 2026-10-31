/* =====================================================================
   A CASTING COST, AS MAGIC'S SYMBOLS
   Shows a cost like "{1}{U}{U}" as Scryfall's symbol pictures in a row
   (a grey 1, then two blue U drops), the way it's printed on the card.
   A split card's halves are shown with "//" between them. Screen
   readers hear the cost as text instead ("1, U, U").
   ===================================================================== */

import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { manaSymbolGroups } from '@/lib/cards';
import { pictureSource } from '@/lib/http';
import { useColors } from '@/hooks/useTheme';

export default function ManaCost({ cost, size = 16 }: { cost: string; size?: number }) {
  const colors = useColors();
  const groups = manaSymbolGroups(cost);
  if (!groups.length) return null;

  return (
    <View style={styles.row} accessible accessibilityLabel={`Costs ${groups.map((g) => g.map((s) => s.symbol).join(', ')).join(', or ')}`}>
      {groups.map((group, i) => (
        // One half of the cost (the whole cost, unless it's a split card)
        <View key={i} style={styles.row}>
          {i > 0 && <Text style={[styles.split, { color: colors.muted }]}>//</Text>}
          {group.map((s, j) => (
            <Image key={j} source={pictureSource(s.url)} style={{ width: size, height: size }} contentFit="contain" />
          ))}
        </View>
      ))}
    </View>
  );
}

// The symbols sit side by side with a sliver of space between them
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  split: { marginHorizontal: 4, fontSize: 13 },
});
