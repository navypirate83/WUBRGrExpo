/* =====================================================================
   THE SHELF'S WINDOWS
   - Binder properties: rename a binder, change how many pages it has,
     and change its cover symbol and cover color.
   - Delete this binder?: asks first.
   (The New binder window is in NewBinderDialog.tsx, since the Card
   Finder uses it too.)
   ===================================================================== */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NAME_LIMIT, pocketsPerPage, cardCountText, cleanCover, minPagesFor, type Binder } from '@/lib/binderStorage';
import { useColors } from '@/hooks/useTheme';
import PopupWindow from '@/components/PopupWindow';
import TextField from '@/components/TextField';
import { RADIUS } from '@/theme/colors';
import { CoverChoices, NameField, SymbolChoices } from './BinderChoices';

/* ---------------------------------------------------------------------
   BINDER PROPERTIES
   --------------------------------------------------------------------- */

// What "Save" hands back to the screen
export type BinderChanges = { name: string; color: string | null; cover: string; pages: number };

export function BinderPropertiesDialog({ binder, cardCount, onSave, onCancel }: {
  binder: Binder;
  cardCount: number;
  onSave: (changes: BinderChanges) => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  // The window starts filled in with the binder's current details
  const [name, setName] = useState(binder.name.slice(0, NAME_LIMIT));
  const [pagesText, setPagesText] = useState(String(binder.pages));
  const [symbol, setSymbol] = useState(binder.color ?? '');
  const [cover, setCover] = useState(cleanCover(binder.cover));

  // The page count can't go below the fewest pages its cards need (there's
  // no most), and Save waits until it's a whole number at least that big
  // and the name isn't blank.
  const min = minPagesFor(cardCount);
  const pages = Number(pagesText);
  const ok = Number.isInteger(pages) && pages >= min;
  const canSave = ok && name.trim().length > 0;
  // The note under the box: how many cards that many pages hold, and
  // the fewest allowed, or (in red) why the number isn't allowed
  const range = `at least ${min} page${min === 1 ? '' : 's'}`;
  const note = !Number.isInteger(pages) || pages < 1 ? `Enter a number (${range}).`
    : pages < min ? `Too few: its cards need ${range}.`
      : `Holds ${(pages * pocketsPerPage()).toLocaleString()} cards · ${range}`;

  // The − and + buttons: one page fewer (never below the fewest) or more
  function step(by: number) {
    const now = Number.isInteger(pages) ? pages : min;
    setPagesText(String(Math.max(min, now + by)));
  }

  // "Save": hand the changes to the screen
  function save() {
    if (!canSave) return;
    onSave({ name: name.trim().slice(0, NAME_LIMIT), color: symbol || null, cover, pages: Math.max(min, Math.round(pages)) });
  }

  return (
    <PopupWindow
      title="Binder properties"
      onClose={onCancel}
      buttons={[
        { label: 'Cancel', onPress: onCancel, kind: 'secondary' },
        { label: 'Save', onPress: save, disabled: !canSave },
      ]}
    >
      <NameField value={name} onChange={setName} onSubmit={save} />

      {/* How many pages the binder has: − and + buttons around a number
          box (it can be typed in too), and the note explaining the limits */}
      <View style={styles.pagesGroup}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Pages</Text>
        <View style={styles.pagesRow}>
          <StepButton icon="remove" label="One page fewer" onPress={() => step(-1)} disabled={ok && pages <= min} />
          <TextField
            accessibilityLabel="Pages"
            value={pagesText}
            onChangeText={(value) => setPagesText(value.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={styles.pagesInput}
            maxLength={4}
          />
          <StepButton icon="add" label="One page more" onPress={() => step(1)} />
        </View>
        <Text style={[styles.note, { color: ok ? colors.muted : colors.error }]} accessibilityLiveRegion="polite">{note}</Text>
      </View>

      <SymbolChoices legend="Cover symbol" value={symbol} onChange={setSymbol} />
      <CoverChoices value={cover} onChange={setCover} />
    </PopupWindow>
  );
}

// A round − or + button beside the page count
function StepButton({ icon, label, onPress, disabled }: {
  icon: 'add' | 'remove';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepButton, { borderColor: colors.border }, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

/* ---------------------------------------------------------------------
   DELETE THIS BINDER?
   --------------------------------------------------------------------- */

export function DeleteBinderDialog({ binder, cardCount, localMode, onDelete, onCancel }: {
  binder: Binder;
  cardCount: number;
  localMode: boolean;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const colors = useColors();
  return (
    <PopupWindow
      title="Delete this binder?"
      onClose={onCancel}
      // "No" first (on the left), so the safe choice comes first
      buttons={[
        { label: 'No', onPress: onCancel, kind: 'secondary' },
        { label: 'Yes, delete', onPress: onDelete, kind: 'danger' },
      ]}
    >
      {/* Signed in, it goes to the Drive trash; used locally, it's gone for good */}
      <Text style={[styles.text, { color: colors.text }]}>
        "{binder.name}" and its {cardCountText(cardCount)} will be deleted.{' '}
        {localMode
          ? 'It\'s only saved on this device, so it can\'t be brought back.'
          : 'It goes to your Google Drive trash, where it can be restored for 30 days.'}
      </Text>
    </PopupWindow>
  );
}

// The windows' look
const styles = StyleSheet.create({
  pagesGroup: { gap: 6 },
  fieldLabel: { fontSize: 15, fontWeight: '600' },
  pagesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pagesInput: { width: 80, textAlign: 'center' },
  stepButton: { width: 44, height: 44, borderRadius: RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
  note: { fontSize: 13 },
  text: { fontSize: 16, lineHeight: 22 },
});
