/* =====================================================================
   KEYBOARD SHORTCUTS WINDOW
   A pop-up window listing a screen's keys (on a computer: phones have
   no keyboard shortcuts). Every screen that has keyboard shortcuts uses
   this: it passes in its own list of keys, an optional line above the
   list and note under it, and whether the window is open (the screen
   opens it with the ? key, or a button).
   ===================================================================== */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import PopupWindow from './PopupWindow';

// One line of the list: the key(s) to press, and what they do
export type Shortcut = {
  keys: ReactNode;
  does: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
  intro?: ReactNode;
  note?: ReactNode;
};

export default function ShortcutsDialog({ open, onClose, shortcuts, intro, note }: Props) {
  const colors = useColors();
  // Drawn only while open
  if (!open) return null;
  return (
    <PopupWindow title="Keyboard shortcuts" onClose={onClose} buttons={[{ label: 'Close', onPress: onClose }]}>
      {/* The line above the list (if the screen gave one) */}
      {intro && <Text style={[styles.text, { color: colors.muted }]}>{intro}</Text>}

      {/* Each key on the left, and what it does on the right */}
      {shortcuts.map((shortcut) => (
        <View key={shortcut.does} style={[styles.row, { borderBottomColor: colors.border }]}>
          <Text style={[styles.keys, { color: colors.text }]}>{shortcut.keys}</Text>
          <Text style={[styles.does, { color: colors.text }]}>{shortcut.does}</Text>
        </View>
      ))}

      {/* The note under the list (if the screen gave one) */}
      {note && <Text style={[styles.text, { color: colors.muted }]}>{note}</Text>}
    </PopupWindow>
  );
}

// The list's look: key and meaning side by side, a thin line between rows
const styles = StyleSheet.create({
  text: { fontSize: 14 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  keys: { width: 110, fontWeight: '700', fontFamily: 'monospace' },
  does: { flex: 1 },
});
