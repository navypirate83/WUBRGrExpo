/* =====================================================================
   CARD PICTURE
   The big picture of the card, in a frame the shape of a real card. A
   spinning wheel shows on top while a new picture downloads, and while
   a card is being looked up it also says "Searching…" (the old card
   stays underneath, dimmed, so the screen never goes blank). If a
   picture won't download, the back of a Magic card shows instead.
   The picture is drawn by expo-image, which keeps pictures it has
   already downloaded, so flipping a card back and forth is instant.
   ===================================================================== */

import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { CARD_BACK, CARD_BACK_ALT } from '@/lib/cards';
import { pictureSource } from '@/lib/http';
import { useColors } from '@/hooks/useTheme';

type Props = {
  // The picture to show, or null for the card back
  src: string | null;
  alt: string;
  // A card is being looked up: show the spinner (and "Searching…") even
  // if the picture is ready
  busy: boolean;
};

export default function CardPicture({ src, alt, busy }: Props) {
  const colors = useColors();
  // The last picture that finished downloading, and the last one that
  // failed (that one is swapped for the card back)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // What to actually show: the picture, or the card back if there's no
  // picture or it failed
  const showBack = !src || src === failedSrc;
  const shown = showBack ? CARD_BACK : src;
  // Still downloading (or looking up a card): show the spinner
  const loading = busy || shown !== loadedSrc;

  return (
    // Two boxes: the outer one draws the card's shadow, and the inner one
    // trims the picture to the card's rounded corners. (Trimming the
    // outer one would trim its shadow off too.)
    <View style={[styles.shadowBox, { boxShadow: colors.cardShadow }]}>
      <View style={[styles.frame, { backgroundColor: colors.surface }]}>
        <Image
          source={pictureSource(shown)}
          style={[styles.picture, loading && styles.dimmed]}
          contentFit="cover"
          // What screen readers say about the picture
          accessibilityLabel={showBack ? CARD_BACK_ALT : alt}
          accessible
          // A quick fade from one picture to the next
          transition={150}
          // Finished downloading: hide the spinner
          onLoad={() => setLoadedSrc(shown)}
          // Couldn't download: show the card back instead. (If the card back
          // itself fails, just stop the spinner, so it doesn't spin forever.)
          onError={() => {
            if (shown !== CARD_BACK) setFailedSrc(shown);
            else setLoadedSrc(shown);
          }}
        />

        {/* The spinning wheel in the middle of the card while it loads
            (and "Searching…" while a card is being looked up) */}
        {loading && (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.accent} />
            {busy && (
              <Text style={[styles.searching, { color: colors.text, backgroundColor: colors.surface }]}>
                Searching…
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// The card's shape: as wide as it's allowed, and as tall as a real card
// for that width (real cards are 63 x 88 mm; Scryfall's pictures are
// 488 x 680 pixels). The corners are rounded about as much as a real
// card's.
const styles = StyleSheet.create({
  shadowBox: { width: '100%', aspectRatio: 488 / 680, borderRadius: 16 },
  frame: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  picture: { width: '100%', height: '100%' },
  dimmed: { opacity: 0.35 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 10 },
  searching: { fontSize: 15, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
});
