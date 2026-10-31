/* =====================================================================
   A COVER SWATCH
   A cover color drawn the way the binder's cover will look: a sheen from
   the top-left corner (lighter) to the bottom-right (darker), with a
   thin border, as a circle (in the color choices) or any other shape
   (the style decides its size and corners). Anything inside it (like a
   binder's symbol and name) is drawn on top of the sheen.
   "LinearGradient" (from expo-linear-gradient) blends the three shades.
   ===================================================================== */

import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CoverShades } from '@/lib/covers';

type Props = {
  shades: CoverShades;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export default function CoverSwatch({ shades, style, children }: Props) {
  return (
    <LinearGradient
      colors={[shades.light, shades.base, shades.dark]}
      // From the top-left corner (0, 0) to the bottom-right (1, 1)
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.swatch, { borderColor: shades.edge }, style]}
    >
      {children}
    </LinearGradient>
  );
}

// A round swatch to start with; the style passed in can change it
const styles = StyleSheet.create({
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, overflow: 'hidden' },
});
