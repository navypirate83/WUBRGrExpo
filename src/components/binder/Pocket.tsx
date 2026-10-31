/* =====================================================================
   ONE POCKET IN A BINDER PAGE
   - Holding a card: its picture (tap it to open that card in the Card
     Finder), with the "− 3 +" copies bar along the bottom. A foil card
     gets a rainbow border.
   - Empty: a "+" (tap it to pick a card for this pocket in the Card
     Finder).
   Resting a finger on a card and moving it (to drag it), or holding it
   still (for its menu), is handled by the binder screen around it.
   "memo" means React only redraws a pocket when something about it
   changes (a binder can have thousands of them).
   ===================================================================== */

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { CARD_BACK } from '@/lib/cards';
import { pictureSource } from '@/lib/http';
import { MAX_COPIES, cardCount, type BinderCard } from '@/lib/binderStorage';
import { fixed } from '@/theme/colors';
import { useColors } from '@/hooks/useTheme';

type Props = {
  pocketKey: string;           // "3-5": page 3, pocket 5
  page: number;
  slot: number;
  card: BinderCard | undefined;
  width: number;               // the pocket's size, in points
  height: number;
  loaded: boolean;             // should its picture download yet?
  faded: boolean;              // its card is being dragged away
  outlined: boolean;           // a dragged card (or picture) would drop here
  loading: boolean;            // waiting for a dropped picture to be looked up
  highlighted: boolean;        // found with the search bar
  accent: string;              // the theme's accent color (for outlines)
  onOpen: (key: string) => void;
  onHold?: (key: string) => void;   // held down without moving (mouse only)
  onCopies: (key: string, step: number) => void;
};

function Pocket(props: Props) {
  const { pocketKey: key, page, slot, card, width, height, loaded, faded, outlined, loading, highlighted, accent, onOpen, onHold, onCopies } = props;
  const count = cardCount(card);
  // The theme's colors (the pockets are dark plastic in the dark theme,
  // pale in the light one)
  const colors = useColors();
  // The copies bar is only drawn when the pocket is big enough to tap it
  const showBar = card && width >= 54;

  // The pocket's outline: thick and orange when found by the search bar
  // or when something would drop here, otherwise the plastic edge
  const ring = highlighted || outlined
    ? { borderColor: accent, borderWidth: highlighted ? 3 : 2 }
    : { borderColor: colors.pocketEdge, borderWidth: 1 };

  return (
    <View style={[styles.pocket, { width, height, backgroundColor: colors.pocketFill }, ring, loading && styles.loading]}>
      {card ? (
        <>
          {/* A foil card: a rainbow glow around the picture */}
          {card.foil && (
            <LinearGradient
              colors={['#ff5f6d', '#ffc371', '#47e891', '#3ab0ff', '#b16cff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.foil]}
            />
          )}
          {/* The picture: tap to open the card. It only downloads once its
              page is near the one showing; if it won't download, the back
              of a Magic card shows instead. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${card.name}${card.foil ? ', foil' : ''}${count > 1 ? `, ${count} copies` : ''}, page ${page}, pocket ${slot}`}
            accessibilityHint="Opens the card in the Card Finder. Rest your finger on it, then move, to pick it up."
            onPress={() => onOpen(key)}
            onLongPress={onHold ? () => onHold(key) : undefined}
            style={[styles.cardHolder, card.foil && styles.foilInset, faded && styles.faded]}
          >
            {loaded && (
              <Image
                source={pictureSource(card.image)}
                placeholder={pictureSource(CARD_BACK)}
                contentFit="cover"
                transition={150}
                recyclingKey={card.image}
                style={styles.picture}
              />
            )}
          </Pressable>

          {/* The "− 3 +" bar along the bottom: how many copies you own */}
          {showBar && (
            <View style={[styles.copiesBar, faded && styles.faded]}>
              <Pressable accessibilityRole="button" hitSlop={4}
                         accessibilityLabel={count > 1 ? `One fewer ${card.name}` : `Remove ${card.name}`}
                         onPress={() => onCopies(key, -1)} style={styles.copiesButton}>
                <Text style={styles.copiesText}>−</Text>
              </Pressable>
              <Text style={styles.copiesCount} accessibilityLabel={`${count} owned`}>{count}</Text>
              <Pressable accessibilityRole="button" hitSlop={4} accessibilityLabel={`One more ${card.name}`}
                         disabled={count >= MAX_COPIES} onPress={() => onCopies(key, 1)}
                         style={[styles.copiesButton, count >= MAX_COPIES && styles.disabled]}>
                <Text style={styles.copiesText}>+</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        // Empty: a "+" to pick a card for this pocket
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Empty, page ${page}, pocket ${slot}. Add a card`}
          onPress={() => onOpen(key)}
          style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.pocketShine }]}
        >
          <Text style={[styles.plus, { color: colors.pocketPlus, fontSize: Math.max(18, width * 0.35) }]}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

export default memo(Pocket);

// A pocket's look: plastic on the page (its colors come from the theme,
// above), the card filling it, and the copies bar laid over the bottom
// of the card
const styles = StyleSheet.create({
  pocket: { borderRadius: 5, overflow: 'hidden' },
  loading: { opacity: 0.5 },
  foil: { borderRadius: 5 },
  foilInset: { margin: 2 },
  cardHolder: { flex: 1, borderRadius: 4, overflow: 'hidden' },
  picture: { width: '100%', height: '100%' },
  faded: { opacity: 0.25 },
  copiesBar: {
    position: 'absolute', left: 3, right: 3, bottom: 3, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.72)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  copiesButton: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' },
  copiesText: { color: fixed.accentOnDark, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  copiesCount: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  add: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plus: { fontWeight: '300' },
});
