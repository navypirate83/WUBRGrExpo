/* =====================================================================
   THE VIEW SWITCH (inside an opened binder)
   A row of small buttons under the search bar: List, Grid and Binder
   (the one you're on is filled in orange), and a Sort button at the right
   (hidden in the Binder view, where the cards stay in their pockets).
   The Sort button shows the sort in use and opens a "Sort by" window
   listing every way to sort (see lib/binderSort.ts); tapping one sorts
   the list and grid that way and closes the window.
   The choices are remembered and saved with your settings (see
   lib/binderView.ts).
   ===================================================================== */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import PopupWindow from '@/components/PopupWindow';
import { useColors } from '@/hooks/useTheme';
import { setBinderSort, setBinderViewMode } from '@/lib/binderView';
import { BINDER_SORTS, type BinderSort } from '@/lib/binderSort';
import type { BinderViewMode } from '@/lib/binderViewTypes';
import { RADIUS } from '@/theme/colors';

// The three views, in the order they show
const VIEWS: { mode: BinderViewMode; label: string }[] = [
  { mode: 'list', label: 'List' },
  { mode: 'grid', label: 'Grid' },
  { mode: 'binder', label: 'Binder' },
];

export default function ViewSwitch({ mode, sort }: { mode: BinderViewMode; sort: BinderSort }) {
  const colors = useColors();
  // Is the "Sort by" window open?
  const [sortOpen, setSortOpen] = useState(false);
  const current = BINDER_SORTS.find((s) => s.value === sort) ?? BINDER_SORTS[0];

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

      {/* Sort: shows the sort in use; tap to choose another (not in the Binder view) */}
      {mode !== 'binder' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sorted by ${current.name}. Tap to change.`}
          onPress={() => setSortOpen(true)}
          style={({ pressed }) => [styles.button, styles.sort, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Ionicons name="swap-vertical" size={14} color={colors.muted} />
          <Text style={[styles.label, { color: colors.muted }]}>{current.short}</Text>
        </Pressable>
      )}

      {/* THE "SORT BY" WINDOW: one row per way to sort, a check mark on the one in use */}
      {sortOpen && (
        <PopupWindow title="Sort by" onClose={() => setSortOpen(false)}
                     buttons={[{ label: 'Close', onPress: () => setSortOpen(false), kind: 'secondary' }]}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Sort by">
            {BINDER_SORTS.map((option) => {
              const picked = option.value === sort;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: picked }}
                  accessibilityLabel={option.name}
                  onPress={() => { setBinderSort(option.value); setSortOpen(false); }}
                  style={({ pressed }) => [styles.option, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfaceHover }]}
                >
                  <Text style={[styles.optionText, { color: colors.text }, picked && styles.labelOn]}>{option.name}</Text>
                  {picked && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </PopupWindow>
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
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { fontSize: 16 },
});
