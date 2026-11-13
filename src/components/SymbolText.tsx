/* =====================================================================
   A NAME WITH MAGIC SYMBOLS IN IT
   Binders, lists and decks can be named with Scryfall's symbol codes in
   curly brackets, and each one is drawn as its symbol: "{R}" is the red
   mana symbol, "{2}{U}{U}" a cost, "{W/U}" the white-or-blue symbol, "{T}"
   the tap symbol. The name is saved just as it was typed (the brackets
   stay in it, so it looks the same on every device); only the drawing
   changes. A code that isn't a real symbol ("{hello}") is left as typed.
   A name with no symbols is drawn as plain text, exactly as before.
   Screen readers hear the name as typed.
   ===================================================================== */

import { StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { pictureSource } from '@/lib/http';

// The symbol codes Scryfall has pictures for: a color or other letter
// (W U B R G C S X Y Z T Q E P A L), a number, a hybrid like W/U, 2/W, C/W or
// W/P, the half symbols (HW, HR, H) and a few others
const REAL_SYMBOL = /^(?:\d{1,2}|[WUBRGCSXYZTQEPAL]|[WUBRG]\/[WUBRGP]|2\/[WUBRG]|C\/[WUBRG]|HW|HR|H|CHAOS|PW|TK|ST)$/i;

// One piece of a name: plain text, or a symbol (its code, like "R" or "W/U")
type Piece = { text: string } | { symbol: string };

// Cut a name into plain text and symbols
function pieces(name: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const match of name.matchAll(/\{([^{}]{1,10})\}/g)) {
    if (!REAL_SYMBOL.test(match[1])) continue;
    if (match.index! > last) out.push({ text: name.slice(last, match.index) });
    out.push({ symbol: match[1].toUpperCase() });
    last = match.index! + match[0].length;
  }
  if (last < name.length) out.push({ text: name.slice(last) });
  return out;
}

// The picture of one symbol (the "/" is left out of the picture's name)
const symbolUrl = (code: string) => `https://svgs.scryfall.io/card-symbols/${encodeURIComponent(code.replace(/\//g, ''))}.svg`;

type Props = Omit<TextProps, 'style' | 'children'> & {
  children: string;
  style?: StyleProp<TextStyle>;
  // How big each symbol is (by default a little bigger than the letters)
  size?: number;
};

export default function SymbolText({ children, style, size, ...textProps }: Props) {
  const parts = pieces(children);
  // No symbols: plain text, as always
  if (!parts.some((part) => 'symbol' in part)) {
    return <Text style={style} {...textProps}>{children}</Text>;
  }
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 16;
  const icon = size ?? Math.round(fontSize * 1.2);
  return (
    <View style={styles.row} accessible accessibilityLabel={children} accessibilityRole={textProps.accessibilityRole}>
      {parts.map((part, index) => ('symbol' in part
        ? <Image key={index} source={pictureSource(symbolUrl(part.symbol))} style={{ width: icon, height: icon }} contentFit="contain" />
        : <Text key={index} style={[style, styles.piece]} numberOfLines={textProps.numberOfLines}>{part.text}</Text>))}
    </View>
  );
}

// The pieces sit side by side; long text shrinks (with "…") before the symbols do
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, gap: 2 },
  piece: { flexShrink: 1 },
});
