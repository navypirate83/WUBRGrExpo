/* =====================================================================
   THE PIECES OF THE BINDER WINDOWS
   - NameField: the name box with its "5 / 12" counter
   - SymbolChoices: the cover symbol (None, the colors, Colorless,
     Planeswalker, then the two-color symbols)
   - CoverChoices: the cover color (nine colors, then "Custom", which
     shows a palette of more colors and a box for a color code)
   Each choice is a tappable tile; the one picked has an orange ring.
   Screen readers hear each tile as a "radio button" (only one in a
   group can be picked) and whether it's picked.
   Used by the New binder and Binder properties windows.
   ===================================================================== */

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { COVER_COLORS, MANA_COLORS, NAME_LIMIT, isCustomCover, type ManaColor } from '@/lib/binderStorage';
import { coverLook } from '@/lib/covers';
import { useColors } from '@/hooks/useTheme';
import TextField from '@/components/TextField';
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

// "value" is the picked symbol's code, or "" for None.
export function SymbolChoices({ legend, value, onChange }: {
  legend: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const colors = useColors();

  // One choice: the symbol's picture (or an empty circle for None)
  const choice = (option: ManaColor | null) => {
    const code = option?.code ?? '';
    return (
      <Choice
        key={code || 'none'}
        picked={value === code}
        name={option?.short ?? 'None'}
        // Screen readers say both names for two-color symbols ("White and Blue, Azorius")
        label={option ? (option.short !== option.name ? `${option.name}, ${option.short}` : option.name) : 'None'}
        onPress={() => onChange(code)}
      >
        {option
          ? <Image source={option.symbol} style={styles.symbol} contentFit="contain" />
          : <View style={[styles.symbol, styles.noSymbol, { borderColor: colors.muted }]} />}
      </Choice>
    );
  };

  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={legend}>
      <Text style={[styles.legend, { color: colors.text }]}>{legend}</Text>
      <View style={styles.grid}>{[null, ...MANA_COLORS.filter((c) => c.group === 'single')].map(choice)}</View>
      <Text style={[styles.groupTitle, { color: colors.muted }]}>Two colors</Text>
      <View style={styles.grid}>{MANA_COLORS.filter((c) => c.group === 'two').map(choice)}</View>
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

// The look of the choices: tiles in rows that wrap onto the next line
const styles = StyleSheet.create({
  count: { fontSize: 13, textAlign: 'right', marginTop: 4 },
  group: { gap: 8 },
  legend: { fontSize: 15, fontWeight: '600' },
  groupTitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  choice: { width: 72, alignItems: 'center', gap: 2, paddingVertical: 4 },
  pressed: { opacity: 0.6 },
  ring: { borderWidth: 2.5, borderRadius: 26, padding: 3 },
  symbol: { width: 40, height: 40 },
  noSymbol: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed' },
  choiceName: { fontSize: 12 },
  palette: { gap: 10, marginTop: 4 },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  paletteRing: { borderWidth: 2, borderRadius: 18, padding: 2 },
  paletteSwatch: { width: 28, height: 28, borderRadius: 14 },
});
