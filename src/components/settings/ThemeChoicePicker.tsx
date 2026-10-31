/* =====================================================================
   THE THEME CHOICE: Dark, System or Light
   Three buttons side by side as one rounded bar (a "segmented control",
   like the ones in a phone's own settings), the chosen one filled in
   orange. "System" follows the device's own light/dark setting.
   Screen readers hear them as radio buttons (only one can be picked)
   and which one is picked.
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ThemeChoice } from '@/lib/theme';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

// The three choices: each one's value, name and icon (a moon, a phone,
// and a sun)
const THEME_CHOICES: { value: ThemeChoice; name: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'dark', name: 'Dark', icon: 'moon' },
  { value: 'system', name: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', name: 'Light', icon: 'sunny' },
];

export default function ThemeChoicePicker({ value, onChange }: {
  value: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Theme"
      style={[styles.bar, { borderColor: colors.border, backgroundColor: colors.bg }]}
    >
      {THEME_CHOICES.map((choice) => {
        const picked = value === choice.value;
        const color = picked ? colors.accentText : colors.text;
        return (
          // One choice: filled orange when picked
          <Pressable
            key={choice.value}
            accessibilityRole="radio"
            accessibilityLabel={choice.name}
            accessibilityState={{ checked: picked }}
            onPress={() => onChange(choice.value)}
            style={({ pressed }) => [
              styles.segment,
              picked && { backgroundColor: colors.accent },
              pressed && !picked && { backgroundColor: colors.surfaceHover },
            ]}
          >
            <Ionicons name={choice.icon} size={18} color={color} />
            <Text style={[styles.label, { color }]}>{choice.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The bar's look: a rounded outline, split into three equal parts, each
// 44 points tall (the size phones recommend for a finger)
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS, padding: 3, gap: 3 },
  segment: {
    flex: 1, minHeight: 44, borderRadius: RADIUS - 3,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  label: { fontSize: 15, fontWeight: '600' },
});
