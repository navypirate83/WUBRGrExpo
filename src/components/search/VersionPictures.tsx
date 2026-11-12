/* =====================================================================
   THE VERSION PICTURES (Card Finder)
   Every version of the card in the set showing, as a small picture of the
   card with its collector number and what makes it special underneath
   ("#13 Borderless, Showcase"). It replaces the Version drop-down.
   - The version showing has an orange outline and a check mark. Tapping
     another picture picks it (the big card changes to match).
   - A version that isn't printed in the language chosen under Language is
     grayed out. A version made in only one language (like a Japanese
     alternate-art card) has that language in a small badge in its corner,
     and is only available once that language is chosen. Tapping a grayed
     picture doesn't pick it: it says why instead (see "onBlocked").
   - When another language is chosen, the other versions show their picture
     in that language where there is one.
   More versions than fit on a line wrap onto more lines.
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CARD_BACK, imageFor, versionLooks } from '@/lib/cards';
import type { ScryfallCard } from '@/lib/scryfall';
import { useColors } from '@/hooks/useTheme';

// A picture's size (points): a card is 63 by 88 millimeters
const PICTURE_WIDTH = 80;
const PICTURE_HEIGHT = Math.round(PICTURE_WIDTH * 88 / 63);

type Props = {
  // The versions to show (the printings in the set showing), and the one showing now
  versions: ScryfallCard[];
  current: ScryfallCard | null;
  // For a version: the printing to show in the language chosen (so its
  // picture is in that language), or null if it isn't made in that language
  variantFor: (version: ScryfallCard) => ScryfallCard | null;
  onPick: (version: ScryfallCard) => void;
  onBlocked: (version: ScryfallCard) => void;   // a grayed picture was tapped
};

export default function VersionPictures({ versions, current, variantFor, onPick, onBlocked }: Props) {
  const colors = useColors();
  if (versions.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Version">
      <Text style={[styles.label, { color: colors.muted }]}>Version</Text>
      <View style={styles.row}>
        {versions.map((version) => {
          const picked = version.id === current?.id;
          const variant = variantFor(version);
          const off = variant === null;
          const looks = versionLooks(version);
          const caption = looks.length ? looks.join(', ') : 'Regular';
          const uri = imageFor(variant ?? version, 0, ['small', 'normal']);
          return (
            <Pressable
              key={version.id}
              accessibilityRole="radio"
              accessibilityLabel={`Version #${version.collector_number}, ${caption}${version.lang !== 'en' ? `, ${version.lang.toUpperCase()} only` : ''}${off ? ', not available in the language chosen' : ''}`}
              accessibilityState={{ selected: picked, checked: picked }}
              onPress={() => (off ? onBlocked(version) : onPick(version))}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              {/* The picture: orange outline when it's the one showing, dimmed when it can't be picked */}
              <View style={[styles.pictureBox, picked && { borderColor: colors.accent }, picked && styles.pickedGlow]}>
                <Image source={{ uri: uri ?? CARD_BACK }} style={styles.picture} contentFit="cover" />
                {off && <View style={styles.dim} />}
                {/* A version made in one language only says which, in the corner */}
                {version.lang !== 'en' && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{version.lang.toUpperCase()}</Text></View>
                )}
              </View>
              {picked && (
                <View style={[styles.check, { backgroundColor: colors.accent }]}>
                  <Ionicons name="checkmark" size={14} color={colors.accentText} />
                </View>
              )}
              <Text style={[styles.number, { color: off ? colors.muted : colors.text }]}>#{version.collector_number}</Text>
              <Text style={[styles.caption, { color: colors.muted }]} numberOfLines={2}>{caption}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// The look: wrapping rows of small pictures, each with its caption
const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: PICTURE_WIDTH, alignItems: 'center' },
  pressed: { opacity: 0.6 },
  pictureBox: { width: PICTURE_WIDTH, height: PICTURE_HEIGHT, borderRadius: 7, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  pickedGlow: { boxShadow: '0px 0px 0px 2px rgba(232, 137, 90, 0.35)' },
  picture: { width: '100%', height: '100%' },
  // A dark layer over a picture that can't be picked
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20, 21, 26, 0.7)' },
  badge: { position: 'absolute', top: 3, left: 3, backgroundColor: 'rgba(0, 0, 0, 0.8)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  check: { position: 'absolute', top: -6, right: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  caption: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
});
