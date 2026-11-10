/* =====================================================================
   SETTINGS (the last tab)
   The app's settings, in groups, laid out like a phone's own Settings
   app (see components/settings/SettingsParts.tsx). The groups:
   - Appearance: the theme (Dark, System or Light)
   - Binders: the page layout (pockets across and down each page)
   - Search: which formats show in the Card Finder's Format Legality box
   - Account: who's signed in, and signing in or out
   - Device memory: "Reset device memory", the only way to clear the collection
   - About: the app's version, links, and the fan content notice
   Binders and Search only show for someone using the binders (signed
   in, or using the app locally): before that there's nowhere to save
   them. The theme can be changed by anyone (it's kept on this device).
   Each change saves straight away; the line at the top says where.
   TO ADD A SETTING: add it in lib/settings.ts first (see the steps at
   the top of that file), then add a row for it below, in the group it
   belongs to (or in a new SettingsSection).
   ===================================================================== */

import { useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAccount } from '@/hooks/useAccount';
import { useSettings } from '@/hooks/useSettings';
import { useColors } from '@/hooks/useTheme';
import { currentThemeChoice, onThemeChange, setThemeChoice, type ThemeChoice } from '@/lib/theme';
import { changeSettings, type Settings } from '@/lib/settings';
import { MAX_CONTENT_WIDTH, SPACE } from '@/theme/colors';
import { SettingBlock, SettingsSection } from '@/components/settings/SettingsParts';
import ThemeChoicePicker from '@/components/settings/ThemeChoicePicker';
import LayoutPicker from '@/components/settings/LayoutPicker';
import FormatSwitches from '@/components/settings/FormatSwitches';
import AccountSection from '@/components/settings/AccountSection';
import PhoneMemorySection from '@/components/settings/PhoneMemorySection';
import PicturesSection from '@/components/settings/PicturesSection';
import AboutSection from '@/components/settings/AboutSection';

export default function SettingsScreen() {
  const colors = useColors();
  const { usingBinders, signedIn, localMode } = useAccount();
  // The settings as they are now (redrawn when one changes)
  const settings = useSettings();
  // The theme choice as it is now. It's followed on its own, because it
  // can change without the other settings changing (before signing in).
  const themeChoice = useSyncExternalStore(onThemeChange, currentThemeChoice, currentThemeChoice);

  /* ----- Saving a change, and saying where it went ----- */

  // The line under "where settings are saved": after a change, whether
  // it worked (and red if it didn't fully)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  // Change a setting (or several), then say where it was saved.
  async function change(changes: Partial<Settings>) {
    setStatus({ text: 'Saving…' });
    try {
      const where = await changeSettings(changes);
      setStatus({
        text: where === 'drive' ? '✓ Saved to Google Drive'
          : where === 'device' ? '✓ Saved on this device'
            : 'Saved on this device. It will be saved to Google Drive the next time you sign in.',
      });
    } catch (err) {
      setStatus({ text: `Saved on this device, but not to Google Drive yet. ${(err as Error).message}`, error: true });
    }
  }

  // A new theme choice. Someone using the binders saves it with the
  // other settings (in Google Drive too, when signed in); anyone else
  // just keeps it on this device.
  function changeTheme(theme: ThemeChoice) {
    if (usingBinders) {
      change({ theme });
      return;
    }
    setThemeChoice(theme);
    setStatus({ text: '✓ Saved on this device' });
  }

  // The first line at the top: where the settings are saved
  const savedWhere = !usingBinders ? 'Your theme is saved on this device. Start using your binders on the Home screen to see the other settings.'
    : localMode ? 'Your settings are saved on this device.'
      : signedIn ? 'Your settings are saved in your Google Drive, so they follow you to other computers and phones.'
        : 'Sign in again (under Account, below) to save your settings to Google Drive.';

  return (
    // The whole screen scrolls
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.column}>
        {/* Where settings are saved, then (after a change) whether it
            worked: read out by screen readers when it changes */}
        <Text style={[styles.savedWhere, { color: colors.muted }]}>{savedWhere}</Text>
        {status && (
          <Text
            style={[styles.status, { color: status.error ? colors.error : colors.text }]}
            accessibilityLiveRegion="polite"
          >
            {status.text}
          </Text>
        )}

        {/* APPEARANCE: how the app looks */}
        <SettingsSection title="Appearance">
          <SettingBlock name="Theme" description="Dark or light colors, or System to match your device's own setting.">
            <ThemeChoicePicker value={themeChoice} onChange={changeTheme} />
          </SettingBlock>
        </SettingsSection>

        {/* BINDERS: how every binder's pages are laid out */}
        {usingBinders && (
          <SettingsSection title="Binders">
            <SettingBlock
              name="Page layout"
              description="How many pockets across and down each binder page has, like 3 × 3 for 9-pocket pages. Changing it keeps your cards in the same order, flowing onto more or fewer pages; change it back and every card returns to where it was."
            >
              <LayoutPicker value={settings.pageLayout} onChange={(pageLayout) => change({ pageLayout })} />
            </SettingBlock>
          </SettingsSection>
        )}

        {/* SEARCH: which formats the Card Finder shows */}
        {usingBinders && (
          <FormatSwitches hidden={settings.hiddenFormats} onChange={(hiddenFormats) => change({ hiddenFormats })} />
        )}

        {/* ACCOUNT: who's signed in, and signing in or out */}
        <AccountSection />

        {/* CARD PICTURES: how much is saved on the phone, save all, clear (phone only) */}
        {usingBinders && <PicturesSection />}

        {/* DEVICE MEMORY: "Reset device memory", the only way to clear the
            collection kept on this device */}
        {(usingBinders || signedIn || localMode) && <PhoneMemorySection />}

        {/* ABOUT: version, links and the fan content notice */}
        <AboutSection />
      </View>
    </ScrollView>
  );
}

// The screen's look: one column (never too wide on a tablet or
// computer), with room around it and at the bottom
const styles = StyleSheet.create({
  content: { padding: SPACE.l, paddingBottom: SPACE.xxl },
  column: { width: '100%', maxWidth: Math.min(640, MAX_CONTENT_WIDTH), alignSelf: 'center' },
  savedWhere: { fontSize: 14, lineHeight: 20, marginHorizontal: SPACE.xs },
  status: { fontSize: 14, lineHeight: 20, marginTop: SPACE.xs, marginHorizontal: SPACE.xs, fontWeight: '600' },
});
