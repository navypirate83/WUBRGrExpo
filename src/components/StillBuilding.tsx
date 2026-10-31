/* =====================================================================
   "STILL BEING BUILT"
   A simple screen for parts of the app that are planned but not made
   yet (Lists and Decks), and for an address that doesn't match any
   screen ("not found"): a heading and a line of text, centered.
   ===================================================================== */

import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';

export default function StillBuilding({ title, message }: { title: string; message: string }) {
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>
      <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

// Centered in the screen, with room around it
const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  message: { fontSize: 16, textAlign: 'center' },
});
