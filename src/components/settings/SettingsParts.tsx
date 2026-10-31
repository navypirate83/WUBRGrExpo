/* =====================================================================
   THE PIECES OF THE SETTINGS SCREEN (reused by every group and setting)
   Laid out like a phone's own Settings app:
   - SettingsSection: a small gray heading ("APPEARANCE"), then a rounded
     box holding its settings, with thin lines between them
   - SettingRow: one setting on one line: its name and a short
     explanation on the left, its control (like an on/off switch) on
     the right
   - SettingBlock: a setting with a bigger control (like the page layout
     picker): its name and explanation on top, the control underneath
   - SwitchRow: a SettingRow whose control is an on/off switch
   ===================================================================== */

import { Children, type ReactNode } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import { RADIUS, SPACE } from '@/theme/colors';

/* ----- A group of settings ----- */

// The heading, then the box. Each thing inside gets a thin line above it
// (except the first), so the rows look like one list.
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  // The rows given, leaving out any that were switched off with "&&"
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]} accessibilityRole="header">{title}</Text>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((row, index) => (
          <View key={index} style={index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ----- One setting on one line ----- */

// Name and explanation on the left (taking the room left over), the
// control on the right
export function SettingRow({ name, description, children }: {
  name: string;
  description?: string;
  children?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        {description ? <Text style={[styles.description, { color: colors.muted }]}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/* ----- A setting with a bigger control ----- */

// Name and explanation on top, the control across the whole width under them
export function SettingBlock({ name, description, children }: {
  name: string;
  description?: string;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.block}>
      <Text style={[styles.name, { color: colors.text }]} accessibilityRole="header">{name}</Text>
      {description ? <Text style={[styles.description, { color: colors.muted }]}>{description}</Text> : null}
      <View style={styles.blockControl}>{children}</View>
    </View>
  );
}

/* ----- A setting that's on or off ----- */

// A SettingRow with the phone's own on/off switch on the right: orange
// when on. Screen readers hear the setting's name with the switch.
export function SwitchRow({ name, description, value, onChange }: {
  name: string;
  description?: string;
  value: boolean;
  onChange: (on: boolean) => void;
}) {
  const colors = useColors();
  return (
    <SettingRow name={name} description={description}>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={name}
        // The track: gray when off, orange when on. The round knob: white.
        trackColor={{ false: colors.switchTrack, true: colors.accent }}
        thumbColor="#ffffff"
        // The web version of Switch colors the knob separately when it's
        // on (teal unless told). It's not in the phone version's list of
        // settings, so it's passed this roundabout way to keep TypeScript happy.
        {...{ activeThumbColor: '#ffffff' }}
      />
    </SettingRow>
  );
}

// The look: gray headings in small capitals, rounded white (or dark)
// boxes, and rows at least 52 points tall (plenty of room for a finger)
const styles = StyleSheet.create({
  section: { marginTop: SPACE.xl },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: SPACE.s, marginLeft: SPACE.xs,
  },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS, overflow: 'hidden' },
  row: {
    minHeight: 52, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.m,
  },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  block: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m },
  blockControl: { marginTop: SPACE.m },
});
