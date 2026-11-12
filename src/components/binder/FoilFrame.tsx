/* =====================================================================
   THE RAINBOW FRAME ON A FOIL CARD
   Wraps a card's picture. A foil card gets a thin rainbow border around
   its picture; any other card's picture is shown as it is. The List and
   Grid views use this, and the Binder view's pockets (Pocket.tsx) use the
   same rainbow colors, so a foil card looks the same in every view.
   ===================================================================== */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// The rainbow, corner to corner (also used by the pockets in the Binder view)
export const FOIL_COLORS = ['#ff5f6d', '#ffc371', '#47e891', '#3ab0ff', '#b16cff'] as const;

type Props = {
  foil: boolean;
  width: number;          // the whole card's size, border included, in points
  height: number;
  radius: number;         // how round its corners are
  border?: number;        // how thick the rainbow border is (2 by default)
  children: ReactNode;    // the picture, which fills the space inside the border
};

export default function FoilFrame({ foil, width, height, radius, border = 2, children }: Props) {
  // Not foil: just the picture, rounded
  if (!foil) {
    return <View style={{ width, height, borderRadius: radius, overflow: 'hidden' }}>{children}</View>;
  }
  // Foil: a rainbow behind, with the picture inset by the border's thickness
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden' }}>
      <LinearGradient colors={[...FOIL_COLORS]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, margin: border, borderRadius: Math.max(0, radius - border), overflow: 'hidden' }}>{children}</View>
    </View>
  );
}
