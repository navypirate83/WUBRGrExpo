/* =====================================================================
   A CLOSED BINDER (the picture of one on the shelf)
   A cover a little taller than wide, with square corners on the spine
   side (left) and rounded corners on the opening side (right), like a
   real binder. A spine runs down the left side, a label window near the
   top holds the binder's name, and its symbol (if it has one) sits in
   the middle.
   Everything is measured from the cover's width, so the same picture
   works small (in a list row) or big (on a tablet).
   ===================================================================== */

import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { manaColor } from '@/lib/binderStorage';
import { coverLook } from '@/lib/covers';
import { useColors } from '@/hooks/useTheme';

type Props = {
  width: number;               // how wide the cover is, in points
  name?: string;
  colorCode?: string | null;   // the cover symbol's code ("U"), or null for none
  cover?: string;              // the cover color ("gold", or "#3a7bd5"); black if left out
  lifted?: boolean;            // drawn with a bigger shadow (while held)
};

export default function ClosedBinder({ width, name, colorCode, cover, lifted }: Props) {
  const colors = useColors();
  const look = coverLook(cover);
  const symbol = manaColor(colorCode);
  const height = width * 1.2;

  // Light text on dark covers; dark text on pale ones
  const labelText = look.light ? '#24211c' : '#e9e5dc';
  const labelLine = look.light ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.16)';
  const labelFill = look.light ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.05)';

  return (
    // The cover itself: a sheen from the top-left (lighter) to the
    // bottom-right (darker), with the binder's shadow under it
    <LinearGradient
      colors={[look.shades.light, look.shades.base, look.shades.dark]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.cover,
        { width, height, borderColor: look.shades.edge, boxShadow: lifted ? colors.binderShadowLift : colors.binderShadow },
      ]}
    >
      {/* The spine along the left edge: see-through blacks laid over the
          cover, so it's a darker band of whatever color the cover is */}
      <LinearGradient
        colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)', 'rgba(255,255,255,0.08)']}
        locations={[0, 0.45, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.spine, { width: width * 0.15 }]}
      />

      {/* The label window near the top, with the name on ONE line (the
          text shrinks to fit a long name, down to a point) */}
      {name ? (
        <View style={[styles.label, { top: height * 0.09, left: width * 0.22, right: width * 0.07,
                                       borderColor: labelLine, backgroundColor: labelFill, paddingVertical: width * 0.05 }]}>
          <Text
            style={[styles.labelText, { color: labelText, fontSize: Math.max(9, width * 0.1) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {name}
          </Text>
        </View>
      ) : null}

      {/* The cover symbol, in the middle of the front (skipping the spine) */}
      {symbol && (
        <Image
          source={symbol.symbol}
          contentFit="contain"
          style={{
            position: 'absolute',
            width: width * 0.36,
            height: width * 0.36,
            top: height / 2 - width * 0.18 + height * 0.05,
            left: width * 0.15 + (width * 0.85 - width * 0.36) / 2,
          }}
        />
      )}
    </LinearGradient>
  );
}

// The shapes that don't depend on the size
const styles = StyleSheet.create({
  cover: { borderWidth: 1, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' },
  spine: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  label: { position: 'absolute', borderWidth: 1, borderRadius: 3, paddingHorizontal: 4, alignItems: 'center' },
  labelText: { fontWeight: '600', textAlign: 'center' },
});
