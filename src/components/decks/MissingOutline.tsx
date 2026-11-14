/* =====================================================================
   THE "NOT IN YOUR BINDERS" OUTLINE
   In a deck, a card you don't own (it isn't in any of your binders; cards
   on a list don't count: lists are wishes) gets a bold solid red border
   around its picture. If you own the card, but not that printing of it, the
   border is dashed instead. This draws that border: put it inside the box that
   holds the card's picture, and it covers the picture's edge without
   catching any taps.
   ===================================================================== */

import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';

type Props = {
  radius: number;     // the picture's rounded corners
  width?: number;     // how thick the border is (bold: 3 by default)
  dashed?: boolean;   // dashed (you own the card, just not this printing) instead of solid
};

export default function MissingOutline({ radius, width = 3, dashed = false }: Props) {
  const colors = useColors();
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderWidth: width, borderStyle: dashed ? 'dashed' : 'solid', borderColor: colors.error, borderRadius: radius }]}
    />
  );
}
