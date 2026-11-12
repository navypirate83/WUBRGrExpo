/* =====================================================================
   PICKER BUTTON AND PICKER SHEET / DROP-DOWN
   Phones have no drop-down lists like a web page's <select>, so the
   Card Finder's pickers (Language, Set, Version), its "Add to which
   binder?" menu and a binder's "Move card to…" list are built from two
   pieces:
   - PickerButton: a box showing the current choice, with a small down
     arrow on the right. Tapping it opens...
   - PickerSheet: the list of choices, in one of two looks:
       * a real DROP-DOWN (when it's handed the box's position, "anchor"):
         a scrolling list that opens right under the box (or above it, if
         there's no room below), at least as wide as the box, about seven
         rows tall. The Set picker also has a "Type to filter" box at its
         top, since a card can be in hundreds of sets.
       * a SHEET that slides up from the bottom of the screen (when there's
         no box to open under, like the "Move card to…" list).
     Either way the current choice has a check mark and the list starts
     scrolled to it. Tapping a row picks it; tapping anywhere outside, the
     phone's Back button (Android) or Escape (web) closes it without picking.
   The list is a FlatList: React Native's list that only draws the rows
   on screen, so even a card printed in hundreds of sets scrolls smoothly.
   ===================================================================== */

import { useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

// Every row in a sheet is this tall (in points), so the list can work
// out where any row is without measuring it (used to start scrolled to
// the current choice)
export const ROW_HEIGHT = 52;

// A drop-down's rows are a little shorter, and it shows at most this many
// at once (it scrolls for the rest); it's at least this wide (points)
const DROP_ROW_HEIGHT = 44;
const DROP_MAX_ROWS = 7;
const DROP_MIN_WIDTH = 260;
const FILTER_HEIGHT = 48;
const FOOTER_HEIGHT = 52;

// Where a button is on the screen (the drop-down opens next to it)
export type Anchor = { x: number; y: number; width: number; height: number };

/* ----- The button ----- */

// "label" is the small heading beside the box ("LANGUAGE", with
// "inline"), or above it; without one, it's just the box (Set and Version).
export function PickerButton({ label, inline, disabled, onPress, accessibilityLabel, style, children }: {
  label?: string;
  inline?: boolean;
  disabled?: boolean;
  onPress: (anchor: Anchor) => void;   // handed the box's place on the screen
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const colors = useColors();
  // The box itself, measured when it's pressed so the list can open under it
  const box = useRef<ComponentRef<typeof Pressable>>(null);
  return (
    <View style={[inline ? styles.inlineWrap : styles.wrap, style]}>
      {/* The small heading ("LANGUAGE"), if it has one */}
      {label ? <Text style={[styles.fieldLabel, inline && styles.inlineLabel, { color: colors.muted }]}>{label}</Text> : null}

      {/* The box: what's picked now, then the down arrow. Greyed out
          (and not tappable) before a card is shown. */}
      <Pressable
        ref={box}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens a list to choose from"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => box.current?.measureInWindow((x, y, width, height) => onPress({ x, y, width, height }))}
        style={({ pressed }) => [
          styles.box,
          inline && styles.inlineBox,
          { backgroundColor: pressed ? colors.surfaceHover : colors.surface, borderColor: colors.border },
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.boxContent}>{children}</View>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

/* ----- The sheet or drop-down ----- */

// "T" is whatever the rows are (sets, versions, binders...): the sheet
// doesn't need to know, it just asks these functions about each one.
type SheetProps<T> = {
  title: string;                                 // the heading at the top
  items: T[];                                    // the rows
  keyOf: (item: T) => string;                    // a different name for each row
  labelOf: (item: T) => string;                  // what screen readers say for a row
  renderRow: (item: T, isCurrent: boolean) => ReactNode;   // what a row shows
  current?: T | null;                            // the row picked now (gets the check mark)
  isDisabled?: (item: T) => boolean;             // rows that can't be picked (faded)
  onPick: (item: T) => void;                     // a row was tapped
  onClose: () => void;                           // closed without picking
  header?: ReactNode;                            // something before the first row ("How many to move")
  footer?: ReactNode;                            // something after the last row ("New binder")
  anchor?: Anchor;                               // given: a drop-down under this box; not given: a sheet from the bottom
  filterable?: boolean;                          // a drop-down with a "Type to filter" box at its top
};

// A picker: a drop-down if it knows where the box is, else a sheet
export function PickerSheet<T>(props: SheetProps<T>) {
  return props.anchor ? <PickerDropdown {...props} /> : <PickerPanel {...props} />;
}

/* ----- The drop-down ----- */

function PickerDropdown<T>(props: SheetProps<T>) {
  const { title, items, keyOf, labelOf, renderRow, current, isDisabled, onPick, onClose, header, footer, anchor, filterable } = props;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // What's typed in the filter box (if it has one): rows are kept whose
  // label contains it (capitals don't matter)
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const typed = filter.trim().toLowerCase();
    return typed ? items.filter((item) => labelOf(item).toLowerCase().includes(typed)) : items;
  }, [items, filter]);

  // How big and where: at least as wide as the box (and at least
  // DROP_MIN_WIDTH, never wider than the screen), lined up with the box's
  // left edge unless that would run off the right edge. Under the box if
  // there's room (or more room than above it), otherwise above it.
  const width = Math.min(windowWidth - 16, Math.max(anchor!.width, DROP_MIN_WIDTH));
  const left = Math.max(8, Math.min(anchor!.x, windowWidth - 8 - width));
  const below = windowHeight - (anchor!.y + anchor!.height) - 4 - Math.max(insets.bottom, 8);
  const above = anchor!.y - 4 - Math.max(insets.top, 8);
  const fullHeight = DROP_MAX_ROWS * DROP_ROW_HEIGHT + (filterable ? FILTER_HEIGHT : 0) + (footer ? FOOTER_HEIGHT : 0) + 8;
  const openBelow = below >= Math.min(fullHeight, 220) || below >= above;
  const maxHeight = Math.max(120, Math.min(fullHeight, openBelow ? below : above));

  // The list starts scrolled so the current choice shows, with two rows above it
  const currentIndex = !filter && current ? shown.indexOf(current) : -1;
  const startIndex = Math.max(0, currentIndex - 2);

  return (
    // A see-through layer over the whole screen: tapping it closes the list
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      <Pressable style={styles.dropBackdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View
        accessibilityRole="menu"
        accessibilityLabel={title}
        style={[
          styles.dropdown,
          { left, width, maxHeight, backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow },
          openBelow ? { top: anchor!.y + anchor!.height + 4 } : { bottom: windowHeight - anchor!.y + 4 },
        ]}
      >
        {header}
        {/* The "Type to filter" box (Set picker) */}
        {filterable && (
          <TextInput
            value={filter}
            onChangeText={setFilter}
            placeholder="Type to filter…"
            placeholderTextColor={colors.muted}
            accessibilityLabel={`Filter ${title}`}
            autoFocus={Platform.OS === 'web'}
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.filterBox, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
          />
        )}
        {/* The rows, scrolling inside the box */}
        <FlatList
          style={styles.dropList}
          showsVerticalScrollIndicator
          data={shown}
          keyExtractor={keyOf}
          initialScrollIndex={shown.length > DROP_MAX_ROWS && startIndex < shown.length ? startIndex : 0}
          getItemLayout={(_data, index) => ({ length: DROP_ROW_HEIGHT, offset: DROP_ROW_HEIGHT * index, index })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={[styles.dropEmpty, { color: colors.muted }]}>Nothing matches.</Text>}
          renderItem={({ item }) => {
            const isCurrent = item === current;
            const disabled = isDisabled?.(item) ?? false;
            return (
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel={labelOf(item)}
                accessibilityState={{ selected: isCurrent, disabled }}
                disabled={disabled}
                onPress={() => onPick(item)}
                style={({ pressed }) => [
                  styles.dropRow,
                  (pressed || isCurrent) && { backgroundColor: colors.surfaceHover },
                  disabled && styles.disabled,
                ]}
              >
                <View style={styles.rowContent}>{renderRow(item, isCurrent)}</View>
                {isCurrent && <Ionicons name="checkmark" size={20} color={colors.accent} />}
              </Pressable>
            );
          }}
        />
        {/* Something after the last row ("New binder"): always showing, not scrolled away */}
        {footer}
      </View>
    </Modal>
  );
}

/* ----- The sheet that slides up from the bottom ----- */

function PickerPanel<T>(props: SheetProps<T>) {
  const { title, items, keyOf, labelOf, renderRow, current, isDisabled, onPick, onClose, header, footer } = props;
  const colors = useColors();
  // The phone's own bars and rounded corners ("safe area"): the sheet
  // keeps its last row above the home bar at the bottom of an iPhone
  const insets = useSafeAreaInsets();

  // Start scrolled so the current choice shows, with two rows above it
  // (when there are that many)
  const currentIndex = current ? items.indexOf(current) : -1;
  const startIndex = Math.max(0, currentIndex - 2);

  return (
    // "transparent" lets the dimmed screen show above the sheet;
    // onRequestClose is Android's Back button (and Escape on the web)
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.fill}>
        {/* The dimmed area: tapping it closes the sheet */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />

        {/* The sheet itself, along the bottom of the screen ("aria-modal"
            tells screen readers, and the web's shortcut keys, that only
            the sheet can be used while it's open) */}
        <View
          style={[styles.sheet, {
            backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow,
            paddingBottom: Math.max(insets.bottom, 12),
          }]}
          accessibilityViewIsModal
          aria-modal
        >
          {/* A small grab bar, the usual sign of a panel that slid up,
              then the heading and a Close button */}
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={6}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={24} color={colors.muted} />
            </Pressable>
          </View>

          {/* The rows. getItemLayout tells the list each row's position
              (they're all ROW_HEIGHT tall), which lets it start part way
              down ("initialScrollIndex") without drawing the rows above. */}
          <FlatList
            showsVerticalScrollIndicator={false}
            data={items}
            keyExtractor={keyOf}
            initialScrollIndex={startIndex < items.length ? startIndex : 0}
            getItemLayout={(_data, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={header ? <>{header}</> : undefined}
            ListFooterComponent={footer ? <>{footer}</> : undefined}
            renderItem={({ item }) => {
              const isCurrent = item === current;
              const disabled = isDisabled?.(item) ?? false;
              return (
                // One row: what it shows, then a check mark if it's the
                // current choice
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={labelOf(item)}
                  accessibilityState={{ selected: isCurrent, disabled }}
                  disabled={disabled}
                  onPress={() => onPick(item)}
                  style={({ pressed }) => [
                    styles.row,
                    (pressed || isCurrent) && { backgroundColor: colors.surfaceHover },
                    disabled && styles.disabled,
                  ]}
                >
                  <View style={styles.rowContent}>{renderRow(item, isCurrent)}</View>
                  {isCurrent && <Ionicons name="checkmark" size={20} color={colors.accent} />}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/* ----- A row's text, for sheets whose rows are just words ----- */

// One line of text, cut off with "…" if it's too long; bold for the
// current choice, grey for a box's placeholder word (like "Version")
export function SheetRowText({ text, bold, muted }: { text: string; bold?: boolean; muted?: boolean }) {
  const colors = useColors();
  return (
    <Text style={[styles.rowText, { color: muted ? colors.muted : colors.text }, bold && styles.bold]} numberOfLines={1}>{text}</Text>
  );
}

// The look of the button and the sheet. The sheet is never wider than
// 560 points (on a tablet or computer it sits in the middle) and never
// taller than three quarters of the screen.
const styles = StyleSheet.create({
  wrap: { gap: 6 },
  inlineWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  inlineLabel: { flexShrink: 0 },
  box: {
    minHeight: 46, borderWidth: 1, borderRadius: RADIUS, paddingLeft: 12, paddingRight: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  inlineBox: { flex: 1, minHeight: 44 },
  boxContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  disabled: { opacity: 0.5 },
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  // The drop-down: a see-through layer, and the list floating over it
  dropBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dropdown: { position: 'absolute', borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden', paddingVertical: 4 },
  dropList: { flexGrow: 0 },
  dropRow: { height: DROP_ROW_HEIGHT, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropEmpty: { padding: 14, fontSize: 15 },
  filterBox: { height: 40, marginHorizontal: 8, marginBottom: 4, paddingHorizontal: 12, borderWidth: 1, borderRadius: RADIUS - 2, fontSize: 15 },
  sheet: {
    width: '100%', maxWidth: 560, maxHeight: '75%', alignSelf: 'center',
    borderTopLeftRadius: RADIUS * 1.6, borderTopRightRadius: RADIUS * 1.6, borderWidth: 1, borderBottomWidth: 0,
    paddingHorizontal: 8,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingVertical: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  row: {
    height: ROW_HEIGHT, paddingHorizontal: 10, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  rowContent: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flexShrink: 1, fontSize: 16 },
  bold: { fontWeight: '700' },
});
