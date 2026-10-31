/* =====================================================================
   FORMAT LEGALITY DISPLAY: which formats the Card Finder shows
   Under a heading row ("Format legality display"), one row per format
   (Standard, Modern, Commander...) with an on/off switch: on = shown in
   a card's Format Legality box, off = left out.
   Then "Show all" and "Hide all" buttons to switch every one at once.
   (The setting keeps a list of the HIDDEN formats: see lib/settings.ts.)
   ===================================================================== */

import { StyleSheet, View } from 'react-native';
import { FORMAT_NAMES } from '@/lib/cards';
import { SPACE } from '@/theme/colors';
import Button from '@/components/Button';
import { SettingRow, SettingsSection, SwitchRow } from './SettingsParts';

type Props = {
  hidden: string[];                        // the formats hidden now (their codes)
  onChange: (hidden: string[]) => void;    // called with the new list of hidden ones
};

export default function FormatSwitches({ hidden, onChange }: Props) {
  // Show (switch on) or hide (switch off) one format
  function toggle(code: string, show: boolean) {
    const others = hidden.filter((c) => c !== code);
    onChange(show ? others : [...others, code]);
  }

  return (
    <SettingsSection title="Search">
      {/* The setting's name and what it does */}
      <SettingRow
        name="Format legality display"
        description="Pick which formats show in a card's Format Legality box in the Card Finder. Switched-off ones are left out."
      />

      {/* One switch per format */}
      {FORMAT_NAMES.map(([code, name]) => (
        <SwitchRow key={code} name={name} value={!hidden.includes(code)} onChange={(show) => toggle(code, show)} />
      ))}

      {/* Switch every format on, or every one off */}
      <View style={styles.buttons}>
        <Button label="Show all" kind="secondary" onPress={() => onChange([])} style={styles.button} />
        <Button label="Hide all" kind="secondary" onPress={() => onChange(FORMAT_NAMES.map(([code]) => code))} style={styles.button} />
      </View>
    </SettingsSection>
  );
}

// The two buttons side by side, sharing the width
const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: SPACE.m, padding: SPACE.m },
  button: { flex: 1 },
});
