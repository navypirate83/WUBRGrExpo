/* =====================================================================
   A HEADER BAR BETWEEN GROUPS OF CARDS
   In the List and Grid views, the cards are split into groups by how
   they're sorted (see "headerFor" in lib/binderSort.ts), and this is the
   little bar that goes above each group. It says what the group is, then
   a thin line carries on to the right edge:
     - letters, type names and "Unknown": the words
     - color and mana value: Scryfall's mana symbols ({W}{U}, {C}, {3})
     - Lands: a little mountain picture
     - set: the set's symbol, its code, and its name
   ===================================================================== */

import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import { manaSymbolGroups } from '@/lib/cards';
import { pictureSource } from '@/lib/http';
import type { SortHeader } from '@/lib/binderSort';

// The little mountain picture for Lands (plain lines, recolored to suit the theme)
const MOUNTAIN_PICTURE = require('../../../assets/images/land-mountain.svg') as number;

// How tall a bar is (the grid needs to know this exactly to place its rows)
export const HEADER_HEIGHT = 34;

// What a screen reader says for a bar ("White and Blue", "Mana value 3")
const COLOR_WORDS: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
function spokenName(header: SortHeader): string {
  switch (header.kind) {
    case 'text': return header.text;
    case 'land': return 'Lands';
    case 'set': return `${header.code} ${header.name}`.trim();
    default: {
      const symbols = manaSymbolGroups(header.cost)[0]?.map((s) => s.symbol) ?? [];
      return /^\d+$/.test(symbols[0] ?? '') ? `Mana value ${symbols[0]}` : symbols.map((s) => COLOR_WORDS[s] ?? s).join(' and ');
    }
  }
}

type Props = {
  header: SortHeader;
  setIcon?: string;        // for a set bar: the set's symbol picture, once it has downloaded
};

export default function SortHeaderBar({ header, setIcon }: Props) {
  const colors = useColors();
  return (
    <View style={styles.bar} accessible accessibilityRole="header" accessibilityLabel={spokenName(header)}>
      {/* What the group is */}
      {header.kind === 'text' && <Text style={[styles.text, { color: colors.text }]}>{header.text}</Text>}
      {header.kind === 'land' && <Image source={MOUNTAIN_PICTURE} style={styles.mountain} contentFit="contain" tintColor={colors.iconTint} />}
      {header.kind === 'mana' && (
        <View style={styles.symbols}>
          {manaSymbolGroups(header.cost)[0]?.map((s, i) => (
            <Image key={i} source={pictureSource(s.url)} style={styles.symbol} contentFit="contain" />
          ))}
        </View>
      )}
      {header.kind === 'set' && (
        <View style={styles.symbols}>
          {setIcon ? <Image source={{ uri: setIcon }} style={styles.setIcon} contentFit="contain" tintColor={colors.iconTint} /> : null}
          <Text style={[styles.text, { color: colors.text }]}>{header.code}</Text>
          {header.name ? <Text style={[styles.setName, { color: colors.muted }]} numberOfLines={1}>{header.name}</Text> : null}
        </View>
      )}
      {/* The thin line that carries on to the right edge */}
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

// The look: the group's name or symbols on the left, then the line
const styles = StyleSheet.create({
  bar: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 16, fontWeight: '700' },
  symbols: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  symbol: { width: 22, height: 22 },
  mountain: { width: 30, height: 20 },
  setIcon: { width: 20, height: 20, marginRight: 2 },
  setName: { fontSize: 14, flexShrink: 1, marginLeft: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth * 2, minWidth: 12 },
});
