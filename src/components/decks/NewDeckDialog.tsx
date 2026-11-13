/* =====================================================================
   THE NEW DECK WINDOW
   A small window that asks for a new deck's name (a name like "Deck 2"
   is filled in) and its format (Commander, Modern... paper formats only:
   see deckFormats.ts). Formats turned off in Settings (Format legality
   display) are not offered; if every one is off, all of them show. It only collects the answers: "onCreate" is called
   with the name and the format's code, and the screen that opened the
   window makes the deck. Used by the Decks page's "Add deck" and by the
   Card Finder's "+" (New deck, with the card in it).
   ===================================================================== */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PopupWindow from '@/components/PopupWindow';
import TextField from '@/components/TextField';
import { useColors } from '@/hooks/useTheme';
import { useSettings } from '@/hooks/useSettings';
import { nextDeckName } from '@/lib/deckStorage';
import { DECK_FORMATS, DEFAULT_DECK_FORMAT } from '@/lib/deckFormats';

// The longest a deck's name can be
const NAME_LIMIT = 40;

type Props = {
  confirmLabel?: string;                              // the button's words ("Create" by default)
  onCreate: (name: string, format: string) => void;
  onCancel: () => void;
};

export default function NewDeckDialog({ confirmLabel = 'Create', onCreate, onCancel }: Props) {
  const colors = useColors();
  // The name being typed and the format chosen so far
  const [name, setName] = useState(nextDeckName);
  // The formats turned off in Settings are left out (unless every one is off:
  // then they all show, so a deck can still be made)
  const { hiddenFormats } = useSettings();
  const shown = DECK_FORMATS.filter((option) => !hiddenFormats.includes(option.code));
  const choices = shown.length > 0 ? shown : DECK_FORMATS;
  // The format chosen so far: Commander if that's offered, otherwise the first one offered
  const [format, setFormat] = useState(() => (choices.some((c) => c.code === DEFAULT_DECK_FORMAT) ? DEFAULT_DECK_FORMAT : choices[0].code));
  const create = () => { if (name.trim()) onCreate(name, format); };

  return (
    <PopupWindow title="New deck" onClose={onCancel}
                 buttons={[
                   { label: 'Cancel', onPress: onCancel, kind: 'secondary' },
                   { label: confirmLabel, onPress: create, disabled: !name.trim() },
                 ]}>
      <View style={styles.body}>
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          onSubmitEditing={create}
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          maxLength={NAME_LIMIT}
          autoCapitalize="words"
        />
        <Text style={[styles.formatLabel, { color: colors.muted }]}>Format</Text>
        <View style={styles.formats}>
          {choices.map((option) => {
            const chosen = option.code === format;
            return (
              <Pressable key={option.code} accessibilityRole="radio" accessibilityState={{ selected: chosen }}
                         onPress={() => setFormat(option.code)}
                         style={[styles.chip, { borderColor: chosen ? colors.accent : colors.border, backgroundColor: chosen ? colors.accent : 'transparent' }]}>
                <Text style={[styles.chipText, { color: chosen ? colors.bg : colors.text }]}>{option.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </PopupWindow>
  );
}

// The look: the name box, then the formats as rounded chips (the chosen one filled in)
const styles = StyleSheet.create({
  body: { gap: 8 },
  formatLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  formats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: '600' },
});
