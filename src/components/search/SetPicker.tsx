/* =====================================================================
   SET PICKER
   Picks which set (expansion) of the card to show. Each choice needs
   its set symbol, so every row is laid out as:
       symbol | CODE | Set Name
   The box shows the current set; tapping it drops a list down under it
   (see PickerSheet.tsx) of every set the card was printed in, newest
   first, with a "Type to filter" box at the top (a card can be in
   hundreds of sets). Tapping one picks it.
   ===================================================================== */

import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { plural, type SetGroup } from '@/lib/cards';
import { useColors } from '@/hooks/useTheme';
import { PickerButton, PickerSheet, type Anchor } from './PickerSheet';

type Props = {
  sets: SetGroup[];
  current: SetGroup | null;
  onChoose: (set: SetGroup) => void;
};

// What the pickers say before a card is shown
export const EMPTY_PICKER_TEXT = 'Search for a card first';

// One row's contents: the set symbol, its code and its name, with "|"
// between them. (No symbol picture yet? An empty space of the same
// size.) The symbols are black pictures, so in dark mode they're tinted
// light ("tintColor") to show up on the dark background.
function SetRow({ set, bold }: { set: SetGroup; bold?: boolean }) {
  const colors = useColors();
  return (
    <>
      {set.icon
        ? <Image source={{ uri: set.icon }} style={styles.setIcon} contentFit="contain" tintColor={colors.iconTint} />
        : <View style={styles.setIcon} />}
      <Text style={[styles.sep, { color: colors.muted }]}>|</Text>
      <Text style={[styles.setCode, { color: colors.text }]}>{set.code.toUpperCase()}</Text>
      <Text style={[styles.sep, { color: colors.muted }]}>|</Text>
      <Text style={[styles.setName, { color: colors.text }, bold && styles.bold]} numberOfLines={1}>{set.name}</Text>
    </>
  );
}

export default function SetPicker({ sets, current, onChoose }: Props) {
  const colors = useColors();
  // Is the list of sets open, and where is the box it drops down from?
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | undefined>(undefined);

  return (
    <>
      {/* The box showing the current set (greyed out, saying just "Set",
          before a card is shown). Opening the list puts the keyboard
          away first. */}
      <PickerButton
        disabled={!current}
        accessibilityLabel={current ? `Set: ${current.name}` : `Set: ${EMPTY_PICKER_TEXT}`}
        onPress={(box) => { Keyboard.dismiss(); setAnchor(box); setOpen(true); }}
      >
        {current
          ? <SetRow set={current} />
          : <Text style={[styles.setName, { color: colors.muted }]} numberOfLines={1}>Set</Text>}
      </PickerButton>

      {/* The list of sets, drawn only while it's open */}
      {open && (
        <PickerSheet
          anchor={anchor}
          filterable
          title={`Set (${plural(sets.length, 'set')})`}
          items={sets}
          current={current}
          keyOf={(set) => set.code}
          labelOf={(set) => `${set.name}, ${set.code.toUpperCase()}`}
          renderRow={(set, isCurrent) => <SetRow set={set} bold={isCurrent} />}
          onPick={(set) => { onChoose(set); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// The row's pieces: a 20-point symbol, thin "|" separators, the code in
// a fixed-width font (so the codes line up), and the name, which takes
// the rest of the room and ends in "…" if it's too long
const styles = StyleSheet.create({
  setIcon: { width: 20, height: 20, flexShrink: 0 },
  sep: { fontSize: 15, marginHorizontal: 6 },
  setCode: { flexShrink: 0, fontSize: 15, fontWeight: '600', fontFamily: 'monospace' },
  setName: { flex: 1, minWidth: 0, fontSize: 15 },
  bold: { fontWeight: '700' },
});
