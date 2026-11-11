/* =====================================================================
   THE HELP BUTTON
   A round "?" at the right end of a screen's header (left out when the
   side menu is showing, because the menu has a Help item). It opens the Help
   screen, at the topic for the screen you're on (like "my-binders" for
   The Shelf), so the instructions you need are right there.
   ===================================================================== */

import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { useMenuStyle } from '@/hooks/useMenuStyle';

export default function HelpButton({ topic }: { topic?: string }) {
  const colors = useColors();
  // When the side menu is showing, it has its own Help item, so the
  // header doesn't need a second one.
  const hasSideMenu = useMenuStyle() !== 'none';
  if (hasSideMenu) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Help"
      hitSlop={8}
      onPress={() => router.push({ pathname: '/help', params: topic ? { topic } : {} })}
      // Fade a little while pressed, so a finger can see it worked
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="help-circle-outline" size={26} color={colors.text} />
    </Pressable>
  );
}

// The button's look: a little space from the screen's edge
const styles = StyleSheet.create({
  button: { paddingHorizontal: 12 },
  pressed: { opacity: 0.5 },
});
