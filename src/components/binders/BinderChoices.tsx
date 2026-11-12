/* =====================================================================
   THE PIECES OF THE BINDER WINDOWS
   - NameField: the name box with its "5 / 12" counter
   - SymbolChoices: the cover symbol, picked from two scrollable lists
     ("dropdowns"): Mana Symbols (None, the colors, Colorless,
     Planeswalker, the two-color symbols) and Set Symbols (the symbol of
     any Magic set, each picture listed once, with a box to search by
     name)
   - CoverChoices: the cover color (nine colors, then "Custom", which
     shows a palette of more colors and a box for a color code)
   The cover colors are tappable tiles; the one picked has an orange ring.
   Screen readers hear each tile as a "radio button" (only one in a
   group can be picked) and whether it's picked.
   Used by the New binder and Binder properties windows.
   ===================================================================== */

import { useState, type ReactNode } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  COVER_COLORS, MANA_COLORS, NAME_LIMIT, isCustomCover, manaColor, setSymbolCode, type ManaColor,
} from '@/lib/binderStorage';
import { coverLook } from '@/lib/covers';
import { loadSetIcons } from '@/lib/scryfall';
import { SET_SYMBOLS, type SetSymbolEntry } from '@/data/setSymbols';
import { useColors } from '@/hooks/useTheme';
import TextField from '@/components/TextField';
import { PickerButton, PickerSheet, SheetRowText } from '@/components/search/PickerSheet';
import CoverSwatch from './CoverSwatch';

/* ----- The name box ----- */

// "maxLength" stops typing past the limit, so the name always fits on
// one line of the cover's label. "label" is the heading above it
// ("Name" unless another is given). "onSubmit" is the keyboard's
// Done/Enter key (the window's main button).
export function NameField({ value, onChange, label = 'Name', autoFocus, onSubmit }: {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  const colors = useColors();
  return (
    <View>
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        maxLength={NAME_LIMIT}
        autoCorrect={false}
        autoCapitalize="words"
        autoFocus={autoFocus}
        // Select the whole name when the box opens, so typing replaces it
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      {/* How many characters are used of the limit (read out as it changes) */}
      <Text style={[styles.count, { color: colors.muted }]} accessibilityLiveRegion="polite">
        {value.length} / {NAME_LIMIT}
      </Text>
    </View>
  );
}

/* ----- One tappable choice tile (used by both groups below) ----- */

// The picture on top, the short name under it, and an orange ring when
// it's the one picked
function Choice({ picked, label, name, onPress, children }: {
  picked: boolean;
  label: string;          // what screen readers say
  name: string;           // the short name shown under it
  onPress: () => void;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: picked }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
    >
      <View style={[styles.ring, { borderColor: picked ? colors.accent : 'transparent' }]}>{children}</View>
      <Text style={[styles.choiceName, { color: picked ? colors.text : colors.muted }]} numberOfLines={1}>{name}</Text>
    </Pressable>
  );
}

/* ----- The cover symbol ----- */

// The "None" row at the top of the Mana Symbols list. It's shaped like a
// mana symbol (with no picture) so the list can treat every row the same.
const NO_MANA_SYMBOL: ManaColor = { code: '', name: 'None', short: 'None', group: 'single', symbol: '' };
const MANA_CHOICES: ManaColor[] = [NO_MANA_SYMBOL, ...MANA_COLORS];

// How a set symbol is remembered ("set:mh3"), and which entry of the list
// a remembered symbol is. A set the list doesn't know yet (one Scryfall
// added after the list was made) still works: it's shown by its code.
const setSymbolValue = (entry: SetSymbolEntry) => `set:${entry.code}`;
function entryFor(code: string): SetSymbolEntry {
  return SET_SYMBOLS.find((entry) => entry.codes.includes(code))
    ?? { code, name: code.toUpperCase(), date: '', codes: [code], search: '' };
}

// The text in a closed box when nothing from that list is picked
function Placeholder({ text }: { text: string }) {
  const colors = useColors();
  return <Text style={[styles.placeholder, { color: colors.muted }]} numberOfLines={1}>{text}</Text>;
}

// "value" is the picked symbol: "" for None, a mana symbol's code ("U"), or
// a set symbol ("set:mh3"). The two lists share it: picking from one
// replaces anything picked from the other.
export function SymbolChoices({ legend, value, onChange }: {
  legend: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const colors = useColors();
  // Which list is open (if any), and what's typed in the set list's search box
  const [open, setOpen] = useState<'mana' | 'set' | null>(null);
  const [search, setSearch] = useState('');

  // Every set's symbol picture address (downloaded once, then kept; the same
  // list the Card Finder uses). Until it arrives, rows show an empty space
  // where the picture goes.
  const setIcons = useQuery({ queryKey: ['set-icons'], queryFn: loadSetIcons });
  const iconOf = (code: string) => setIcons.data?.get(code);

  // What's picked now, as each list sees it
  const pickedSetCode = setSymbolCode(value);
  const pickedSet = pickedSetCode ? entryFor(pickedSetCode) : null;
  const pickedMana = pickedSet ? null : (manaColor(value) ?? NO_MANA_SYMBOL);

  // One mana symbol's picture (or a dashed empty circle for None)
  const manaPicture = (option: ManaColor) => (option.code
    ? <Image source={option.symbol} style={styles.listSymbol} contentFit="contain" />
    : <View style={[styles.listSymbol, styles.noSymbol, { borderColor: colors.muted }]} />);

  // One set symbol's picture. The pictures are black, so they're tinted light
  // to show up on the dark background (like the Card Finder's set list).
  const setPicture = (entry: SetSymbolEntry) => {
    const icon = iconOf(entry.code);
    return icon
      ? <Image source={{ uri: icon }} style={styles.listSymbol} contentFit="contain" tintColor={colors.iconTint} />
      : <View style={styles.listSymbol} />;
  };

  // The set list: every entry, or only those matching what's typed (any
  // of the group's set names or codes)
  const wanted = search.trim().toLowerCase();
  const setItems = wanted ? SET_SYMBOLS.filter((entry) => entry.search.includes(wanted)) : SET_SYMBOLS;

  function closeLists() {
    setOpen(null);
    setSearch('');
  }

  return (
    <View style={styles.group} accessibilityLabel={legend}>
      <Text style={[styles.legend, { color: colors.text }]}>{legend}</Text>

      {/* MANA SYMBOLS: the box shows the one picked (or says to choose) */}
      <PickerButton
        label="Mana Symbols"
        accessibilityLabel={`Mana Symbols: ${pickedMana ? pickedMana.name : 'none picked'}`}
        onPress={() => { Keyboard.dismiss(); setOpen('mana'); }}
      >
        {pickedMana ? (
          <View style={styles.boxRow}>
            {manaPicture(pickedMana)}
            <SheetRowText text={pickedMana.short !== pickedMana.name ? `${pickedMana.name}, ${pickedMana.short}` : pickedMana.name} />
          </View>
        ) : <Placeholder text="Choose a mana symbol" />}
      </PickerButton>

      {/* SET SYMBOLS: the same, for the set symbol list */}
      <PickerButton
        label="Set Symbols"
        accessibilityLabel={`Set Symbols: ${pickedSet ? pickedSet.name : 'none picked'}`}
        onPress={() => { Keyboard.dismiss(); setOpen('set'); }}
      >
        {pickedSet ? (
          <View style={styles.boxRow}>
            {setPicture(pickedSet)}
            <SheetRowText text={pickedSet.name} />
          </View>
        ) : <Placeholder text="Choose a set symbol" />}
      </PickerButton>

      {/* The mana symbol list (drawn only while open) */}
      {open === 'mana' && (
        <PickerSheet
          title="Mana Symbols"
          items={MANA_CHOICES}
          current={pickedMana}
          keyOf={(option) => option.code || 'none'}
          labelOf={(option) => (option.short !== option.name ? `${option.name}, ${option.short}` : option.name)}
          renderRow={(option, isCurrent) => (
            <>
              {manaPicture(option)}
              {/* Two-color symbols have a nickname too ("White and Blue", "Azorius") */}
              <SheetRowText text={option.short !== option.name ? `${option.name} · ${option.short}` : option.name} bold={isCurrent} />
            </>
          )}
          onPick={(option) => { onChange(option.code); closeLists(); }}
          onClose={closeLists}
        />
      )}

      {/* The set symbol list (drawn only while open): a search box at the
          top, then every symbol, newest first. A symbol shared by several
          sets (Secret Lair and the Pro Tour promos look the same) is listed
          once, and says how many sets it stands for. */}
      {open === 'set' && (
        <PickerSheet
          title={`Set Symbols (${setItems.length})`}
          items={setItems}
          current={pickedSet ? setItems.find((entry) => entry.code === pickedSet.code) ?? null : null}
          keyOf={(entry) => entry.code}
          labelOf={(entry) => entry.name}
          header={(
            <View style={styles.searchBox}>
              <TextField
                accessibilityLabel="Search set symbols"
                placeholder="Search by set name or code"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          )}
          footer={setItems.length === 0 ? <Text style={[styles.noMatch, { color: colors.muted }]}>No set symbol matches that.</Text> : undefined}
          renderRow={(entry, isCurrent) => (
            <>
              {setPicture(entry)}
              <SheetRowText text={entry.name} bold={isCurrent} />
              {entry.codes.length > 1 && <Text style={[styles.setCount, { color: colors.muted }]}>{entry.codes.length} sets</Text>}
            </>
          )}
          onPick={(entry) => { onChange(setSymbolValue(entry)); closeLists(); }}
          onClose={closeLists}
        />
      )}
    </View>
  );
}

/* ----- The cover color ----- */

// More colors to pick from for "Custom": 12 hues around the color
// wheel, each in a deep and a bright shade, plus a few grays
const CUSTOM_PALETTE = [
  '#7a1f2b', '#a33a1f', '#8a5a12', '#6b6a12', '#2f6b1f', '#1f6b55',
  '#1f5a6b', '#1f3a7a', '#3a2a8a', '#5a2a8a', '#7a2a6b', '#8a2a4a',
  '#d64550', '#e0703a', '#e0a83a', '#c9c23a', '#6fb04a', '#3ab08a',
  '#3a9fc0', '#4a74d6', '#6a5ad6', '#9a5ad6', '#c05ab0', '#d65a8a',
  '#2b2d33', '#4a4d55', '#6e717a', '#d9d4c7',
];

// "value" is a cover color code ("gold"), or a custom color ("#3a7bd5").
export function CoverChoices({ value, onChange }: {
  value: string;
  onChange: (code: string) => void;
}) {
  const colors = useColors();
  // Is the palette of custom colors open? (Open to start if the cover
  // already has a custom color.)
  const [customOpen, setCustomOpen] = useState(isCustomCover(value));
  // What's typed in the color code box
  const [codeText, setCodeText] = useState(isCustomCover(value) ? value : '');

  // A color code was typed: once it's a whole code like "#3a7bd5" (the
  // "#" is added if it's left off), use it
  function typeCode(text: string) {
    setCodeText(text);
    const code = (text.startsWith('#') ? text : `#${text}`).toLowerCase();
    if (isCustomCover(code)) onChange(code);
  }

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Cover color">
      <Text style={[styles.legend, { color: colors.text }]}>Cover color</Text>
      <View style={styles.grid}>
        {/* One round swatch per color, drawn just like the cover will be */}
        {COVER_COLORS.map((option) => (
          <Choice key={option.code} picked={value === option.code} name={option.name} label={option.name}
                  onPress={() => { onChange(option.code); setCustomOpen(false); }}>
            <CoverSwatch shades={coverLook(option.code).shades} />
          </Choice>
        ))}

        {/* "Custom": shows the custom color (or a rainbow before one is
            picked), and opens the palette below */}
        <Choice picked={isCustomCover(value)} name="Custom" label="Custom color (shows more colors)"
                onPress={() => setCustomOpen(true)}>
          {isCustomCover(value)
            ? <CoverSwatch shades={coverLook(value).shades} />
            : <CoverSwatch shades={{ light: '#e74c3c', base: '#3ab08a', dark: '#4a74d6', edge: '#888888' }} />}
        </Choice>
      </View>

      {/* The custom palette: small swatches to tap, and a box to type
          any color code into */}
      {customOpen && (
        <View style={styles.palette}>
          <View style={styles.paletteGrid}>
            {CUSTOM_PALETTE.map((code) => (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityState={{ checked: value === code }}
                accessibilityLabel={`Color ${code}`}
                onPress={() => { onChange(code); setCodeText(code); }}
                style={[styles.paletteRing, { borderColor: value === code ? colors.accent : 'transparent' }]}
              >
                <CoverSwatch shades={coverLook(code).shades} style={styles.paletteSwatch} />
              </Pressable>
            ))}
          </View>
          <TextField
            label="Or type a color code"
            placeholder="#3a7bd5"
            value={codeText}
            onChangeText={typeCode}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
          />
        </View>
      )}
    </View>
  );
}

// The look of the choices: the symbol lists' pieces, and the cover color
// tiles in rows that wrap onto the next line
const styles = StyleSheet.create({
  count: { fontSize: 13, textAlign: 'right', marginTop: 4 },
  group: { gap: 8 },
  legend: { fontSize: 15, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  choice: { width: 72, alignItems: 'center', gap: 2, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  ring: { borderWidth: 2.5, borderRadius: 26, padding: 3 },
  // The pictures in the symbol lists (a bit smaller than a tile's)
  listSymbol: { width: 26, height: 26, flexShrink: 0 },
  noSymbol: { borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed' },
  placeholder: { flexShrink: 1, fontSize: 16 },
  // The picked symbol and its name inside a closed box, with room between
  boxRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: { paddingHorizontal: 2, paddingBottom: 8 },
  noMatch: { paddingVertical: 16, textAlign: 'center', fontSize: 15 },
  setCount: { flexShrink: 0, fontSize: 13 },
  choiceName: { fontSize: 12 },
  palette: { gap: 10, marginTop: 4 },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  paletteRing: { borderWidth: 2, borderRadius: 18, padding: 2 },
  paletteSwatch: { width: 28, height: 28, borderRadius: 14 },
});
