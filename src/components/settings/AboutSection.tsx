/* =====================================================================
   SETTINGS → ABOUT
   The app's version, where its card information comes from (Scryfall),
   a link to the website, and the notice Wizards of the Coast asks fan
   projects like this one to show (their "Fan Content Policy").
   Links open in the phone's web browser (or a new browser tab).
   ===================================================================== */

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { SPACE } from '@/theme/colors';
import { SettingRow, SettingsSection } from './SettingsParts';

// The web addresses linked to
const WEBSITE_URL = 'https://navypirate83.github.io/WUBRGrExpo/';
const SCRYFALL_URL = 'https://scryfall.com/';
const FAN_POLICY_URL = 'https://company.wizards.com/en/legal/fancontentpolicy';

// The app's version number (from app.json), like "0.2.0"
const VERSION = Constants.expoConfig?.version ?? '';

/* ----- A row that opens a web page ----- */

// Its name and a line under it on the left, an "opens elsewhere" arrow
// on the right. It darkens a little while pressed.
function LinkRow({ name, description, url }: { name: string; description: string; url: string }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="Opens in your web browser"
      onPress={() => { Linking.openURL(url).catch(() => { /* no browser to open it in */ }); }}
      style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.surfaceHover }]}
    >
      <View style={styles.linkText}>
        <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
      </View>
      <Ionicons name="open-outline" size={20} color={colors.muted} />
    </Pressable>
  );
}

/* ----- The section ----- */

export default function AboutSection() {
  const colors = useColors();
  return (
    <SettingsSection title="About">
      {/* Which version this is */}
      <SettingRow name="WUBRG'r" description={VERSION ? `Version ${VERSION}` : undefined} />

      {/* The website, and where the cards come from */}
      <LinkRow name="Website" description="navypirate83.github.io/WUBRGrExpo" url={WEBSITE_URL} />
      <LinkRow name="Card information and pictures" description="From Scryfall (scryfall.com)" url={SCRYFALL_URL} />

      {/* The fan content notice, with a link to Wizards' policy */}
      <View style={styles.notice}>
        <Text style={[styles.noticeText, { color: colors.muted }]}>
          WUBRG'r is unofficial Fan Content permitted under the Fan Content Policy. Not
          approved/endorsed by Wizards. Portions of the materials used are property of Wizards
          of the Coast. ©Wizards of the Coast LLC.
        </Text>
      </View>
      <LinkRow name="Fan Content Policy" description="Wizards of the Coast" url={FAN_POLICY_URL} />
    </SettingsSection>
  );
}

// The look: rows at least 52 points tall (room for a finger), and the
// notice in smaller, quieter text
const styles = StyleSheet.create({
  linkRow: {
    minHeight: 52, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.m,
  },
  linkText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 14, marginTop: 2 },
  notice: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m },
  noticeText: { fontSize: 13, lineHeight: 19 },
});
