/* =====================================================================
   THE CARD FINDER'S "WHAT'S HAPPENING" PANELS
   A search can be in one of four states, and each one looks clearly
   different, so it's always obvious what's going on:
   - loading: a big spinning wheel and "Searching…" (Searching, below;
     or, when a card is already showing, the wheel on top of it: see
     CardPicture.tsx)
   - error: something went wrong (no internet, Scryfall too slow or
     busy): a red-edged box saying what happened, with a "Try again"
     button (SearchError)
   - empty: Scryfall answered, but no card has that name: a calm panel
     with a magnifying glass and tips (NoCardsFound)
   - data: the card itself (CardPanel.tsx)
   ===================================================================== */

import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Button from '@/components/Button';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

// LOADING: shown while the first card is looked up (nothing to show yet)
export function Searching({ name }: { name?: string }) {
  const colors = useColors();
  return (
    // "accessibilityLiveRegion" makes Android's screen reader read it out
    <View style={styles.panel} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.title, { color: colors.text }]}>Searching…</Text>
      {name ? <Text style={[styles.text, { color: colors.muted }]}>Looking up “{name}” on Scryfall.</Text> : null}
    </View>
  );
}

// ERROR: what went wrong, and a button to try the same search again
export function SearchError({ message, onRetry, retrying }: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[styles.panel, styles.errorBox, { borderColor: colors.error, backgroundColor: colors.surface }]}
      accessibilityRole="alert"
    >
      <Ionicons name="cloud-offline-outline" size={44} color={colors.error} />
      <Text style={[styles.title, { color: colors.text }]}>Couldn't load that card</Text>
      <Text style={[styles.text, { color: colors.muted }]}>{message}</Text>
      <Button label={retrying ? 'Trying again…' : 'Try again'} icon="refresh" onPress={onRetry} disabled={retrying} />
    </View>
  );
}

// EMPTY: Scryfall found no card for that name. "message" is Scryfall's
// own explanation (like "No cards found matching “Lightnig Bolts”").
export function NoCardsFound({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      {/* A magnifying glass in a soft circle */}
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceHover }]}>
        <Ionicons name="search" size={40} color={colors.muted} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>No cards found</Text>
      <Text style={[styles.text, { color: colors.muted }]}>{message}</Text>
      <Text style={[styles.text, { color: colors.muted }]}>
        Check the spelling, or pick a name from the suggestions that appear as you type.
      </Text>
    </View>
  );
}

// The panels: centered, with room around them. The error box has a red
// border so it can't be mistaken for the calm "No cards found" panel.
const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 40, marginTop: 16 },
  errorBox: { borderWidth: 1.5, borderRadius: RADIUS, paddingVertical: 28 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
