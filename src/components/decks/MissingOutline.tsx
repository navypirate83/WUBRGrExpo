/* =====================================================================
   THE "NOT IN YOUR BINDERS" OUTLINE
   In a deck, a card you don't own (it isn't in any of your binders; cards
   on a list don't count: lists are wishes) gets a bold dashed red border
   around its picture. This draws that border: put it inside the box that
   holds the card's picture, and it covers the picture's edge without
   catching any taps.
   ===================================================================== */

import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';

type Props = {
  radius: number;     // the picture's rounded corners
  width?: number;     // how thick the dashes are (bold: 3 by default)
};

export default function MissingOutline({ radius, width = 3 }: Props) {
  const colors = useColors();
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderWidth: width, borderStyle: 'dashed', borderColor: colors.error, borderRadius: radius }]}
    />
  );
}
