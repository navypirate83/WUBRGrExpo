/* =====================================================================
   A BUTTON
   The app's standard button, in one of four looks ("kinds"):
   - primary:   filled orange, for the main thing to do ("Create")
   - secondary: an outline, for the other choices ("Cancel")
   - danger:    filled red, for things that delete ("Delete")
   - plain:     just the text, for small extra actions
   It's a Pressable (React Native's tappable box) that fades slightly
   while pressed, so a finger can see it worked. An optional icon (from
   Ionicons) can go before the label (or after it, with "iconAfter",
   like the arrow on "Next").
   ===================================================================== */

import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

export type ButtonKind = 'primary' | 'secondary' | 'danger' | 'plain';

type Props = {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: keyof typeof Ionicons.glyphMap;
  iconAfter?: boolean;
  disabled?: boolean;
  // A label for screen readers, when the visible one isn't clear enough
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Button({ label, onPress, kind = 'primary', icon, iconAfter, disabled, accessibilityLabel, style }: Props) {
  const colors = useColors();

  // The background, border and text colors for each kind
  const look = {
    primary: { bg: colors.accent, border: colors.accent, text: colors.accentText },
    secondary: { bg: 'transparent', border: colors.border, text: colors.text },
    danger: { bg: colors.danger, border: colors.danger, text: '#ffffff' },
    plain: { bg: 'transparent', border: 'transparent', text: colors.accent },
  }[kind];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: look.bg, borderColor: look.border },
        kind === 'plain' && styles.plain,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon && !iconAfter && <Ionicons name={icon} size={18} color={look.text} />}
      <Text style={[styles.label, { color: look.text }]}>{label}</Text>
      {icon && iconAfter && <Ionicons name={icon} size={18} color={look.text} />}
    </Pressable>
  );
}

// The shape every button shares: rounded, with room for a finger (at
// least 44 points tall, the size phones recommend for something to tap)
const styles = StyleSheet.create({
  button: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: RADIUS, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  plain: { paddingHorizontal: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
