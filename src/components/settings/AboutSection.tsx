/* =====================================================================
   SETTINGS → ABOUT
   The app's version, where its card information comes from (Scryfall),
   a link to the website (and, on the website only, a link to download
   the Android app), the server's status, and the notice Wizards of the
   Coast asks fan projects like this one to show (their "Fan Content
   Policy").
   Server status: on the website, UptimeRobot's live badge sits at the
   right end of its row (green when the server is up). The phone app can't
   show a web page inside itself, so there the row is a link to the same
   status page, like the others.
   Links open in the phone's web browser (or a new browser tab).
   ===================================================================== */

import { createElement } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { SPACE } from '@/theme/colors';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import { SettingRow, SettingsSection } from './SettingsParts';

// The web addresses linked to
const WEBSITE_URL = SITE_URL;
const SCRYFALL_URL = 'https://scryfall.com/';
const FAN_POLICY_URL = 'https://company.wizards.com/en/legal/fancontentpolicy';
// The Android app file, shared from Google Drive (shown on the website only)
const ANDROID_APP_URL = 'https://drive.google.com/file/d/1nqBXL5YRPTGnGFR8wgdYSCbHNe4y7enc/view?usp=sharing';

// The server's status page, and the small live badge UptimeRobot makes for
// it (a tiny web page that shows "Operational" or "Down", 181 by 24)
const STATUS_PAGE_URL = 'https://stats.uptimerobot.com/WQDbcwUml0';
const STATUS_BADGE_URL = 'https://badge.uptimerobot.com/psp/5156fb071badab132d286123bc8f3037?style=logo&theme=dark';
const STATUS_BADGE_WIDTH = 181;
const STATUS_BADGE_HEIGHT = 24;

// The app's version number (from app.json), like "0.2.0"
const VERSION = Constants.expoConfig?.version ?? '';

/* ----- A row that opens a web page ----- */

// Its name and a line under it on the left (the line is optional), an
// "opens elsewhere" arrow on the right. It darkens a little while pressed.
function LinkRow({ name, description, url }: { name: string; description?: string; url: string }) {
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
        {description ? <Text style={[styles.description, { color: colors.muted }]}>{description}</Text> : null}
      </View>
      <Ionicons name="open-outline" size={20} color={colors.muted} />
    </Pressable>
  );
}

/* ----- The server's status (website only) ----- */

// "Server status" with the live badge at the right end of the row. If the
// row is too narrow for both, the badge drops under the name instead of
// squeezing it. (The badge is a web page shown in a frame, which only the
// website can do: see the top of this file.)
function ServerStatusRow() {
  const colors = useColors();
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusText}>
        <Text style={[styles.name, { color: colors.text }]}>Server status</Text>
        <Text style={[styles.description, { color: colors.muted }]}>wubrgr-server.onrender.com</Text>
      </View>
      {createElement('iframe', {
        src: STATUS_BADGE_URL,
        title: 'Server status: wubrgr-server.onrender.com',
        width: STATUS_BADGE_WIDTH,
        height: STATUS_BADGE_HEIGHT,
        // No border, and dark colors so the badge's own background blends in
        style: { border: 0, colorScheme: 'dark', flexShrink: 0 },
      })}
    </View>
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
      <LinkRow name="Website" description={SITE_NAME} url={WEBSITE_URL} />
      {/* A download link for the Android app, just under the website. It
          only shows on the website: on a phone the app is already installed. */}
      {Platform.OS === 'web' && <LinkRow name="Download Android App from Google Drive" url={ANDROID_APP_URL} />}
      <LinkRow name="Card information and pictures" description="From Scryfall (scryfall.com)" url={SCRYFALL_URL} />

      {/* Whether the server is up: the live badge on the website, a link to
          the status page on the phone */}
      {Platform.OS === 'web'
        ? <ServerStatusRow />
        : <LinkRow name="Server status" description="wubrgr-server.onrender.com" url={STATUS_PAGE_URL} />}

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
  // The status row: name on the left, badge at the right end, wrapping
  // under the name if there isn't room for both
  statusRow: {
    minHeight: 52, paddingHorizontal: SPACE.l, paddingVertical: SPACE.m,
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: SPACE.m, rowGap: SPACE.s,
  },
  statusText: { flexGrow: 1, flexShrink: 1, minWidth: 160 },
  name: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 14, marginTop: 2 },
  notice: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m },
  noticeText: { fontSize: 13, lineHeight: 19 },
});
