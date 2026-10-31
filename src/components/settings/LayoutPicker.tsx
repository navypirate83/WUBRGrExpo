/* =====================================================================
   THE PAGE LAYOUT PICKER
   How many pockets across and down each binder page has (1 to 6 each):
   - two "steppers": a − button, the number, and a + button, for Across
     and for Down (easier with a finger than typing a number)
   - "16 cards a page": how many that makes
   - a small picture of one binder page with that many pockets, drawn in
     the binder's own colors (a black page, dark pockets)
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LAYOUT_MAX, LAYOUT_MIN, pocketsPerPage, type PageLayout } from '@/lib/pageLayout';
import { useColors } from '@/hooks/useTheme';
import { SPACE } from '@/theme/colors';

/* ----- One stepper: "Across  −  4  +" ----- */

function Stepper({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const colors = useColors();
  // Can it go down (above 1) or up (below 6)?
  const canLower = value > LAYOUT_MIN;
  const canRaise = value < LAYOUT_MAX;

  // One round − or + button (greyed out at the end of the range)
  function stepButton(icon: 'remove' | 'add', enabled: boolean, change: number, name: string) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} ${label.toLowerCase()}`}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={() => onChange(value + change)}
        style={({ pressed }) => [
          styles.stepButton,
          { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceHover : colors.surface },
          !enabled && styles.disabled,
        ]}
      >
        <Ionicons name={icon} size={22} color={colors.accent} />
      </Pressable>
    );
  }

  return (
    // Screen readers treat the whole stepper as one "adjustable" control:
    // swiping up or down on it (VoiceOver), or the volume keys (TalkBack),
    // changes the number, and it's read out as e.g. "Across, 4"
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: LAYOUT_MIN, max: LAYOUT_MAX, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment' && canRaise) onChange(value + 1);
        if (event.nativeEvent.actionName === 'decrement' && canLower) onChange(value - 1);
      }}
    >
      <Text style={[styles.stepLabel, { color: colors.text }]}>{label}</Text>
      {stepButton('remove', canLower, -1, 'Fewer')}
      <Text style={[styles.stepValue, { color: colors.text }]}>{value}</Text>
      {stepButton('add', canRaise, 1, 'More')}
    </View>
  );
}

/* ----- The whole picker ----- */

export default function LayoutPicker({ value, onChange }: {
  value: PageLayout;
  onChange: (layout: PageLayout) => void;
}) {
  const colors = useColors();
  const count = pocketsPerPage(value);
  return (
    <View style={styles.picker}>
      {/* The two steppers, one above the other */}
      <View style={styles.steppers}>
        <Stepper label="Across" value={value.across} onChange={(across) => onChange({ ...value, across })} />
        <Stepper label="Down" value={value.down} onChange={(down) => onChange({ ...value, down })} />
      </View>

      {/* The picture of one page, and how many cards it holds. The
          picture is one row of little card shapes for each pocket down.
          Screen readers skip the picture: the numbers say the same. */}
      <View style={styles.previewArea}>
        <View
          style={[styles.page, { backgroundColor: colors.binderPage }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: value.down }, (_, row) => (
            <View key={row} style={styles.pageRow}>
              {Array.from({ length: value.across }, (_, column) => (
                <View key={column} style={[styles.pocket, { backgroundColor: colors.pocketFill, borderColor: colors.pocketEdge }]} />
              ))}
            </View>
          ))}
        </View>
        <Text style={[styles.count, { color: colors.muted }]}>{count} {count === 1 ? 'card' : 'cards'} a page</Text>
      </View>
    </View>
  );
}

// The picker's look: steppers on the left, the picture on the right
// (wrapping under them if the screen is too narrow). Each pocket in the
// picture is card-shaped (63 by 88, the size of a real card in mm).
const styles = StyleSheet.create({
  picker: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.l },
  steppers: { gap: SPACE.s },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s },
  stepLabel: { width: 64, fontSize: 16 },
  // Round buttons 44 points across: the size phones recommend for a finger
  stepButton: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { width: 28, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.35 },
  previewArea: { alignItems: 'center', gap: SPACE.xs },
  page: { padding: 5, borderRadius: 4, gap: 3 },
  pageRow: { flexDirection: 'row', gap: 3 },
  pocket: { width: 14, aspectRatio: 63 / 88, borderRadius: 1.5, borderWidth: StyleSheet.hairlineWidth },
  count: { fontSize: 14 },
});
