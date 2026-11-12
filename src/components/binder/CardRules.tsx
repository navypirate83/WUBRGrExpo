/* =====================================================================
   THE CARD IN A CARD'S MENU: ITS PICTURE AND WHAT IT DOES
   The top of the menu that opens when you tap a card in a binder or a list:
   - the card's big picture. Tapping it opens the card in the Card Finder
     (there's no separate "Open in Card Finder" button).
   - under it, the card's rules text: what it does, in Scryfall's wording,
     with the mana and tap symbols drawn as pictures. The flavor text isn't
     shown. A two-sided card (or a split or adventure card) shows each side's
     text under its name.
   The rules text is looked up when the menu opens (see loadRulesText in
   scryfall.ts) and kept, so it's quick the next time.
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useColors } from '@/hooks/useTheme';
import { pictureSource } from '@/lib/http';
import { symbolUrl } from '@/lib/cards';
import { loadRulesText } from '@/lib/scryfall';
import type { BinderCard } from '@/lib/binderStorage';

// The symbols' size in the text (points)
const SYMBOL = 15;

export default function CardRules({ card, onOpen }: { card: BinderCard; onOpen: () => void }) {
  const colors = useColors();
  const rules = useQuery({
    queryKey: ['rules', card.set, card.number],
    queryFn: () => loadRulesText(card.set, card.number),
    staleTime: Infinity,
  });
  return (
    <>
      {/* The picture: tap it to open the card in the Card Finder */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${card.name} in the Card Finder`}
        onPress={onOpen}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Image source={pictureSource(card.image)} style={styles.picture} contentFit="contain" />
      </Pressable>

      {/* What the card does (nothing here for a card with no rules text, like a basic land) */}
      {rules.data && rules.data.length > 0 && (
        <View style={styles.rules} accessibilityLabel="Rules text">
          {rules.data.map((face, index) => (
            <View key={index} style={styles.face}>
              {face.name ? <Text style={[styles.faceName, { color: colors.muted }]}>{face.name}</Text> : null}
              {face.text.split('\n').map((line, lineIndex) => (
                <RulesLine key={lineIndex} line={line} color={colors.text} />
              ))}
            </View>
          ))}
        </View>
      )}
    </>
  );
}

// One line of rules text: the words, with {T}, {2}, {U} and the like drawn
// as Scryfall's symbol pictures. The line is cut into chunks at the spaces
// (so a symbol and the punctuation right after it, like "{T}:", stay
// together) and the chunks wrap onto more lines as needed.
function RulesLine({ line, color }: { line: string; color: string }) {
  const chunks = line.split(/\s+/).filter(Boolean);
  return (
    <View style={styles.line} accessibilityLabel={line.replace(/\{([^}]+)\}/g, '$1 ')}>
      {chunks.map((chunk, index) => (
        <View key={index} style={styles.chunk}>
          {chunk.split(/(\{[^}]+\})/).filter(Boolean).map((part, partIndex) => (
            /^\{[^}]+\}$/.test(part)
              ? <Image key={partIndex} source={{ uri: symbolUrl(part.slice(1, -1)) }} style={styles.symbol} contentFit="contain" />
              : <Text key={partIndex} style={[styles.text, { color }]}>{part}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// The look: the picture at the top, the rules as small paragraphs under it
const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  picture: { width: '100%', height: 260 },
  rules: { gap: 8 },
  face: { gap: 4 },
  faceName: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, rowGap: 1 },
  chunk: { flexDirection: 'row', alignItems: 'center' },
  text: { fontSize: 14, lineHeight: 20 },
  symbol: { width: SYMBOL, height: SYMBOL, marginHorizontal: 1 },
});
