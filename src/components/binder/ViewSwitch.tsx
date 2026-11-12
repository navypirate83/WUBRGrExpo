/* =====================================================================
   THE VIEW SWITCH (inside an opened binder or card list)
   A row of small buttons under the search bar: List, Grid and Binder, each
   shown as a picture, not words: a list icon, a grid icon and the app's own
   open-binder drawing (the chosen one is filled in orange; screen readers
   still hear "List view", "Grid view" and "Binder view"). An opened card
   list has no pockets, so it's given just List and Grid.
   Between them and the Sort / Clean-up side can come a few small tool buttons
   the screen hands in ("extras": the binder's download and reminder
   buttons, the list's download button): see ToolButton below. They sit in
   the middle of the free space, and move closer to the other buttons as the
   window gets narrower.
   (the one you're on is filled in orange), and one more button at the
   right that depends on the view:
   - List and Grid: a Sort button that shows the sort in use and drops a
     menu down from itself listing every way to sort (see
     lib/binderSort.ts). Tapping an option sorts that way and closes the
     menu; tapping the one already in use reverses it (price highest
     first, then lowest first), except Color and Type, which have no
     reverse. Tapping anywhere else closes the menu.
   - Grid, on the website only: two small zoom buttons (− and +) before
     Sort, to make the card pictures smaller or bigger (the zoom is kept
     on this device: see lib/binderView.ts).
   - Binder: a Clean-up button that moves every card forward to fill the
     empty pockets (the binder screen does the moving and asks first). It's
     faded when there are no empty pockets in the way.
   The view and sort chosen are remembered and saved with your settings
   (see lib/binderView.ts).
   ===================================================================== */

import { useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import { GRID_ZOOM_WIDTHS, binderGridZoom, chooseBinderSort, onGridZoomChange, setBinderViewMode, zoomBinderGrid } from '@/lib/binderView';
import { BINDER_SORTS, canReverse, type BinderSort } from '@/lib/binderSort';
import type { BinderViewMode } from '@/lib/binderViewTypes';
import { RADIUS } from '@/theme/colors';

// The binder drawing used for the Binder view's button (the same one as the
// Binders button in the header)
const BINDER_PICTURE = require('../../../assets/images/binder-outline.svg') as number;

// The three views, in the order they show: each one's name (for screen
// readers) and its picture (an Ionicons icon, or null for the binder drawing)
const VIEWS: { mode: BinderViewMode; label: string; icon: keyof typeof Ionicons.glyphMap | null }[] = [
  { mode: 'list', label: 'List', icon: 'list' },
  { mode: 'grid', label: 'Grid', icon: 'grid-outline' },
  { mode: 'binder', label: 'Binder', icon: null },
];

type Props = {
  mode: BinderViewMode;
  sort: BinderSort;
  reversed: boolean;       // the sort is the other way round
  // Which views to offer (a binder has all three; a card list just List and
  // Grid), and what to do when one is picked (a binder and a card list each
  // remember their own choice)
  modes?: BinderViewMode[];
  onView?: (mode: BinderViewMode) => void;
  // Clean-up (Binder view): called when it's tapped, and whether there's
  // anything for it to do
  onCleanUp?: () => void;
  canCleanUp?: boolean;
  // Small tool buttons to show right after the view buttons (see ToolButton)
  extras?: ReactNode;
};

// One small square tool button with an icon (like download or the reminder
// bell), the same size as the grid's zoom buttons
export function ToolButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles.zoomButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

export default function ViewSwitch({ mode, sort, reversed, modes, onView = setBinderViewMode, onCleanUp, canCleanUp = false, extras }: Props) {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  // A very narrow screen: the Sort button shows just its icon (no word) so
  // the buttons all stay on one line
  const tight = windowWidth < 350;
  const current = BINDER_SORTS.find((s) => s.value === sort) ?? BINDER_SORTS[0];
  // The sort's name and short word the way round it's in now
  const flipped = reversed && canReverse(sort);
  const currentName = flipped ? current.reversedName ?? current.name : current.name;
  const currentShort = flipped ? current.reversedShort ?? current.short : current.short;
  // How far the grid is zoomed (a step from 0, the smallest pictures)
  const zoom = useSyncExternalStore(onGridZoomChange, binderGridZoom, binderGridZoom);

  // The Sort button (measured, so the menu can drop down right under it)
  // and where the menu is (null: closed)
  const sortButton = useRef<ComponentRef<typeof View>>(null);
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);
  function openMenu() {
    sortButton.current?.measureInWindow((x, y, width, height) => {
      setMenu({ top: y + height + 4, right: Math.max(8, windowWidth - (x + width)) });
    });
  }

  return (
    <View style={styles.row}>
      {/* The view buttons, then the tool buttons (download, reminder) centered
          in the space that's left before the Sort side */}
      <View style={styles.left}>
      {/* One small button per view: the chosen one is filled with the accent color */}
      <View style={styles.views} accessibilityRole="tablist">
        {VIEWS.filter((view) => !modes || modes.includes(view.mode)).map((view) => {
          const on = view.mode === mode;
          return (
            <Pressable
              key={view.mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${view.label} view`}
              onPress={() => onView(view.mode)}
              style={({ pressed }) => [
                styles.button,
                styles.viewButton,
                { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border },
                pressed && styles.pressed,
              ]}
            >
              {view.icon
                ? <Ionicons name={view.icon} size={19} color={on ? colors.accentText : colors.muted} />
                : <Image source={BINDER_PICTURE} style={styles.binderPicture} contentFit="contain" tintColor={on ? colors.accentText : colors.muted} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tools}>{extras}</View>
      </View>

      {/* Binder view: Clean-up (faded when there's nothing to clean up) */}
      {mode === 'binder' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clean-up"
          accessibilityHint="Moves every card forward to fill the empty pockets"
          accessibilityState={{ disabled: !canCleanUp }}
          disabled={!canCleanUp}
          onPress={onCleanUp}
          style={({ pressed }) => [
            styles.button, styles.sort,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !canCleanUp && styles.faded,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="sparkles-outline" size={14} color={colors.muted} />
          <Text style={[styles.label, { color: colors.muted }]}>Clean-up</Text>
        </Pressable>
      )}

      {/* List and Grid: (Grid on the website: zoom out and in, then) Sort,
          with its menu dropping down */}
      {mode !== 'binder' && (
        <View style={styles.right}>
          {mode === 'grid' && Platform.OS === 'web' && (
            <View style={styles.zoom} accessibilityRole="toolbar" accessibilityLabel="Zoom the cards">
              <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" accessibilityState={{ disabled: zoom <= 0 }}
                         disabled={zoom <= 0} onPress={() => zoomBinderGrid(-1)}
                         style={({ pressed }) => [styles.button, styles.zoomButton, { backgroundColor: colors.surface, borderColor: colors.border }, zoom <= 0 && styles.faded, pressed && styles.pressed]}>
                <Ionicons name="remove" size={18} color={colors.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" accessibilityState={{ disabled: zoom >= GRID_ZOOM_WIDTHS.length - 1 }}
                         disabled={zoom >= GRID_ZOOM_WIDTHS.length - 1} onPress={() => zoomBinderGrid(1)}
                         style={({ pressed }) => [styles.button, styles.zoomButton, { backgroundColor: colors.surface, borderColor: colors.border }, zoom >= GRID_ZOOM_WIDTHS.length - 1 && styles.faded, pressed && styles.pressed]}>
                <Ionicons name="add" size={18} color={colors.text} />
              </Pressable>
            </View>
          )}
        <View ref={sortButton} collapsable={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sorted by ${currentName}. Tap to change.`}
            accessibilityState={{ expanded: menu !== null }}
            onPress={openMenu}
            style={({ pressed }) => [styles.button, styles.sort, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Ionicons name="swap-vertical" size={14} color={colors.muted} />
            {!tight && <Text style={[styles.label, { color: colors.muted }]}>{currentShort}</Text>}
            <Ionicons name="chevron-down" size={12} color={colors.muted} />
          </Pressable>
        </View>
        </View>
      )}

      {/* THE DROP-DOWN MENU: a see-through layer over the screen (tap it to
          close the menu) with the menu on it, under the Sort button. One
          row per way to sort, a check mark on the one in use. */}
      <Modal visible={menu !== null} transparent animationType="none" onRequestClose={() => setMenu(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(null)} accessibilityLabel="Close the sort menu" />
        {menu && (
          <View
            accessibilityRole="menu"
            style={[styles.menu, { top: menu.top, right: menu.right, backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}
          >
            {BINDER_SORTS.map((option, index) => {
              const picked = option.value === sort;
              // The name the way round it's in now (for the sort in use)
              const name = picked && flipped ? option.reversedName ?? option.name : option.name;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: picked }}
                  accessibilityLabel={name}
                  accessibilityHint={picked && canReverse(option.value) ? 'Tap again to reverse the order' : undefined}
                  onPress={() => { chooseBinderSort(option.value); setMenu(null); }}
                  style={({ pressed }) => [
                    styles.option,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    pressed && { backgroundColor: colors.surfaceHover },
                  ]}
                >
                  <View style={styles.optionName}>
                    <Text style={[styles.optionText, { color: colors.text }, picked && styles.labelOn]}>{name}</Text>
                    {picked && canReverse(option.value) && <Text style={[styles.optionHint, { color: colors.muted }]}>Tap again to reverse</Text>}
                  </View>
                  {picked && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </Modal>
    </View>
  );
}

// The look: the view buttons in a row on the left, the Sort or Clean-up
// button pushed to the right; the menu floats over everything
const styles = StyleSheet.create({
  // Everything stays on ONE line. On a very narrow screen the Sort button
  // drops its word and keeps its icon (see "tight" above) so it still fits.
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // The view buttons and, filling the rest of the space, the tool buttons
  // in the middle of it
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tools: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  views: { flexDirection: 'row', gap: 4 },
  viewButton: { width: 34, paddingHorizontal: 0 },
  binderPicture: { width: 24, height: 20 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoom: { flexDirection: 'row', gap: 4 },
  zoomButton: { width: 30, paddingHorizontal: 0 },
  button: { height: 30, paddingHorizontal: 12, borderRadius: RADIUS - 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  sort: { paddingHorizontal: 10 },
  label: { fontSize: 13, fontWeight: '600' },
  labelOn: { fontWeight: '800' },
  pressed: { opacity: 0.6 },
  faded: { opacity: 0.4 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  menu: { position: 'absolute', minWidth: 220, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  optionName: { flexShrink: 1 },
  optionText: { fontSize: 15 },
  optionHint: { fontSize: 11, marginTop: 1 },
});
