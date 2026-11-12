/* =====================================================================
   THE ADD-CARDS BUTTON (List and Grid views of an opened binder)
   A red circle with a "+" in it, floating in the bottom right corner over
   the cards. Tapping it opens the Card Finder aimed at this binder's next
   available spot; the binder screen decides where that is.
   ===================================================================== */

import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';

// The circle's size, how far it sits from the corner, and its red (the
// same in the light and dark themes)
const SIZE = 56;
const MARGIN = 16;
const RED = '#d62828';

export default function AddCardsButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add cards"
      accessibilityHint="Opens the Card Finder to pick a card for this binder's next empty spot"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: RED, boxShadow: colors.cardShadow }, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={32} color="#ffffff" />
    </Pressable>
  );
}

// The look: a round red button pinned to the bottom right
const styles = StyleSheet.create({
  button: {
    position: 'absolute', right: MARGIN, bottom: MARGIN, width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    alignItems: 'center', justifyContent: 'center', zIndex: 30,
  },
  pressed: { opacity: 0.7 },
});
