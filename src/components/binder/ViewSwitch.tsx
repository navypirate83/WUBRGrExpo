/* =====================================================================
   THE VIEW SWITCH (inside an opened binder)
   A row of small buttons under the search bar: List, Grid and Binder
   (the one you're on is filled in orange), and a Sort button at the right
   that flips between sorting by name and by newest added (hidden in the
   Binder view, where the cards stay in their pockets).
   The choices are remembered on this device (see lib/binderView.ts).
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import {
  setBinderSort, setBinderViewMode, type BinderSort, type BinderViewMode,
} from '@/lib/binderView';
import { RADIUS } from '@/theme/colors';

// The three views, in the order they show
const VIEWS: { mode: BinderViewMode; label: string }[] = [
  { mode: 'list', label: 'List' },
  { mode: 'grid', label: 'Grid' },
  { mode: 'binder', label: 'Binder' },
];

export default function ViewSwitch({ mode, sort }: { mode: BinderViewMode; sort: BinderSort }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      {/* One small button per view: the chosen one is filled with the accent color */}
      <View style={styles.views} accessibilityRole="tablist">
        {VIEWS.map((view) => {
          const on = view.mode === mode;
          return (
            <Pressable
              key={view.mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${view.label} view`}
              onPress={() => setBinderViewMode(view.mode)}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.label, { color: on ? colors.accentText : colors.muted }, on && styles.labelOn]}>{view.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sort: tap to flip between A–Z and newest added (not in the Binder view) */}
      {mode !== 'binder' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sort === 'name' ? 'Sorted by name. Tap to sort by newest added.' : 'Sorted by newest added. Tap to sort by name.'}
          onPress={() => setBinderSort(sort === 'name' ? 'added' : 'name')}
          style={({ pressed }) => [styles.button, styles.sort, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Ionicons name="swap-vertical" size={14} color={colors.muted} />
          <Text style={[styles.label, { color: colors.muted }]}>{sort === 'name' ? 'A–Z' : 'Newest'}</Text>
        </Pressable>
      )}
    </View>
  );
}

// The look: the view buttons in a row on the left, Sort pushed to the right
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  views: { flexDirection: 'row', gap: 4 },
  button: { height: 30, paddingHorizontal: 12, borderRadius: RADIUS - 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  sort: { paddingHorizontal: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  labelOn: { fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
