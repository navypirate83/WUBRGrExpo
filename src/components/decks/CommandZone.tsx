/* =====================================================================
   THE COMMAND ZONE (at the top of a deck, for formats that have one)
   A heading and one or two spots for the cards a deck keeps outside its
   main deck: a commander (and, only if its abilities call for it, a
   partner or a Background), or an Oathbreaker and its signature spell
   (see lib/deckZones.ts for which cards each takes).
   - A spot with a card shows its picture, name and what it is, with
     "Change" (pick another card for the spot) and "Move to deck" (the card
     goes back into the main deck). Tap the card for its window.
   - An empty spot is a dashed outline that says what it needs; tap it to
     choose a card. (The signature spell waits for an Oathbreaker.)
   The deck screen opens the search window and does the changing.
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import ManaCost from '@/components/lists/ManaCost';
import FoilFrame from '@/components/binder/FoilFrame';
import MissingOutline from './MissingOutline';
import BannedSlash from './BannedSlash';
import { commandCard, type Deck } from '@/lib/deckStorage';
import { deckFormat } from '@/lib/deckFormats';
import { secondSpotShows, slotHint, slotName } from '@/lib/deckZones';
import { pictureSource } from '@/lib/http';

type Props = {
  deck: Deck;
  onChoose: (slot: 0 | 1) => void;          // an empty spot (or "Change") was tapped
  onOpenCard: (index: number) => void;      // a spot's card was tapped: its window
  onMoveToDeck: (slot: 0 | 1) => void;      // "Move to deck"
  missing?: (name: string) => boolean;      // is this card not in your binders? (bold solid red border)
  banned?: (name: string) => boolean;       // is this card banned in the format? (black "BANNED" slash)
};

export default function CommandZone({ deck, onChoose, onOpenCard, onMoveToDeck, missing, banned }: Props) {
  const colors = useColors();
  const format = deckFormat(deck.format);
  if (!format.command) return null;
  const first = commandCard(deck, 0);
  const slots: (0 | 1)[] = secondSpotShows(format, first) ? [0, 1] : [0];
  const filled = slots.filter((slot) => commandCard(deck, slot)).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.muted }]}>COMMAND ZONE</Text>
        <Text style={[styles.title, { color: colors.muted }]}>{filled} of {slots.length}</Text>
      </View>
      <View style={styles.slots}>
        {slots.map((slot) => {
          const card = commandCard(deck, slot);
          const name = slotName(format, slot, first);
          // Waiting for something else first (the signature spell needs an Oathbreaker)
          if (!card) {
            return (
              <Pressable key={slot} accessibilityRole="button" accessibilityLabel={`${name}, empty. ${slotHint(format, slot, first)}`}
                         onPress={() => onChoose(slot)}
                         style={({ pressed }) => [styles.slot, styles.empty, { borderColor: colors.accent }, pressed && { backgroundColor: colors.surfaceHover }]}>
                <View style={[styles.picture, styles.plusPicture, { borderColor: colors.accent }]}>
                  <Text style={[styles.plus, { color: colors.accent }]}>+</Text>
                </View>
                <View style={styles.what}>
                  <Text style={[styles.role, { color: colors.text }]}>{name}</Text>
                  <Text style={[styles.hint, { color: colors.muted }]}>{slotHint(format, slot, first)}</Text>
                </View>
              </Pressable>
            );
          }
          return (
            <View key={slot} style={[styles.slot, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${card.name}, your ${name.toLowerCase()}. Opens its menu.`}
                         onPress={() => onOpenCard(deck.cards.indexOf(card))} style={styles.cardPress}>
                <View>
                  <FoilFrame foil={card.foil === true} width={54} height={76} radius={6}>
                    <Image source={pictureSource(card.image)} style={styles.thumb} contentFit="cover" />
                  </FoilFrame>
                  {banned?.(card.name) && <BannedSlash radius={6} />}
                  {missing?.(card.name) &&<MissingOutline radius={6} width={3} />}
                </View>
                <View style={styles.what}>
                  <Text style={[styles.role, { color: colors.text }]} numberOfLines={2}>{card.name}</Text>
                  <Text style={[styles.hint, { color: colors.muted }]} numberOfLines={1}>{name}</Text>
                  {card.manaCost ? <ManaCost cost={card.manaCost} size={13} /> : null}
                </View>
              </Pressable>
              <View style={styles.buttons}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Change the ${name.toLowerCase()}`} onPress={() => onChoose(slot)}
                           style={[styles.button, { backgroundColor: colors.surfaceHover }]}>
                  <Text style={[styles.buttonText, { color: colors.text }]}>Change</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Move ${card.name} back into the deck`} onPress={() => onMoveToDeck(slot)}
                           style={[styles.button, { backgroundColor: colors.surfaceHover }]}>
                  <Text style={[styles.buttonText, { color: colors.text }]}>Move to deck</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// The look: a small heading, then the spots side by side (wrapping on a narrow screen)
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingBottom: 6, gap: 6 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { flex: 1, minWidth: 200, borderWidth: 1, borderRadius: 12, padding: 8, gap: 6 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderStyle: 'dashed' },
  cardPress: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  picture: { width: 54, height: 76, borderRadius: 6 },
  plusPicture: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 28, fontWeight: '300' },
  thumb: { width: '100%', height: '100%' },
  what: { flex: 1, minWidth: 0, gap: 1 },
  role: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12.5 },
  buttons: { flexDirection: 'row', gap: 6 },
  button: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5 },
  buttonText: { fontSize: 12.5, fontWeight: '600' },
});
