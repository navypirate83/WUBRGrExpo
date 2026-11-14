/* =====================================================================
   THE "BANNED" SLASH
   A card that's banned in the deck's format gets a thick black band across
   its picture, from the top left corner to the bottom right, with BANNED
   written on it in white. Put this inside the box that holds the picture;
   it covers the picture without catching any taps.
   How it's drawn: a long black bar is laid across the middle of the picture
   and turned so it points at the opposite corner (the angle depends on the
   picture's shape, so the picture's size is measured first). Anything
   sticking out past the picture's edge is cut off.
   ===================================================================== */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function BannedSlash({ radius = 4 }: { radius?: number }) {
  // The picture's size, once it's been measured
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // The bar: as long as the corner-to-corner line, and about a quarter of the
  // picture's narrow side thick (never thinner than a readable 10)
  const w = size?.w ?? 0;
  const h = size?.h ?? 0;
  const length = Math.hypot(w, h);
  const thick = Math.max(10, Math.min(w, h) * 0.26);
  // Top left to bottom right is turned clockwise by this angle
  const angle = Math.atan2(h, w);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      onLayout={(event) => setSize({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: radius }]}
    >
      {size && (
        <View
          style={[styles.band, {
            width: length,
            height: thick,
            left: w / 2 - length / 2,
            top: h / 2 - thick / 2,
            transform: [{ rotate: `${angle}rad` }],
          }]}
        >
          <Text style={[styles.word, { fontSize: Math.max(6, thick * 0.62) }]} numberOfLines={1}>BANNED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  word: { color: '#fff', fontWeight: '900', letterSpacing: 1 },
});
