/* =====================================================================
   THE "SIGN IN WITH GOOGLE" BUTTON
   A rounded button with Google's colored "G", styled the way Google
   asks sign-in buttons to look: white with a gray outline in the light
   theme, near-black in the dark theme. Used on the Home screen.
   While signing in ("busy") it fades and can't be tapped again, and its
   words change (like "Signing in…").
   ===================================================================== */

import { Pressable, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';

type Props = {
  onPress: () => void;
  busy?: boolean;
  busyLabel?: string;   // the words shown while busy
};

export default function GoogleSignInButton({ onPress, busy = false, busyLabel = 'Signing in…' }: Props) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign in with Google"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.googleBg, borderColor: colors.googleBorder },
        pressed && styles.pressed,
        busy && styles.busy,
      ]}
    >
      {/* Google's "G" logo, drawn in its four colors (a picture file next
          to this one). Screen readers skip it: the button's label says it. */}
      <Image source={require('./google-g.svg')} style={styles.logo} contentFit="contain" accessible={false} />
      <Text style={[styles.label, { color: colors.googleText }]}>{busy ? busyLabel : 'Sign in with Google'}</Text>
    </Pressable>
  );
}

// The button's shape: a pill 48 points tall (comfortably big enough for
// a finger), the logo and words side by side in the middle
const styles = StyleSheet.create({
  button: {
    minHeight: 48, paddingLeft: 16, paddingRight: 22, borderRadius: 999, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    alignSelf: 'center',
  },
  logo: { width: 20, height: 20 },
  label: { fontSize: 16, fontWeight: '500' },
  pressed: { opacity: 0.75 },
  busy: { opacity: 0.6 },
});
