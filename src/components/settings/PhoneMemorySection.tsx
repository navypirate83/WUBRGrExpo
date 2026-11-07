/* =====================================================================
   SETTINGS → PHONE MEMORY
   The one and only way to clear this phone's collection: "Reset phone
   memory". Everything else (an expired Google sign-in, signing out,
   an empty Google Drive) leaves your binders and lists alone.
   Tapping it asks "Are you sure?" first. It then removes every binder and
   list from THIS phone and signs out of Google. Your files in Google
   Drive are not touched. After a reset the app is like a fresh install:
   signing in with Google asks which way to sync, if Drive has a
   collection (see lib/driveSync.ts).
   Your settings (theme, page layout...) are kept.
   ===================================================================== */

import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { binderDirtyStamp, loadBinderList } from '@/lib/binderStorage';
import { listDirtyStamp, loadLists } from '@/lib/listStorage';
import { resetPhoneMemory } from '@/lib/driveSync';
import { askYesNo, showMessage } from '@/lib/dialogs';
import { SPACE } from '@/theme/colors';
import Button from '@/components/Button';
import { SettingRow, SettingsSection } from './SettingsParts';

export default function PhoneMemorySection() {
  // "Reset phone memory": ask "Are you sure?" (saying how many changes
  // haven't reached Drive yet, since those would be lost), then reset
  // and go to Home.
  async function reset() {
    const waiting =
      loadBinderList().filter((b) => binderDirtyStamp(b.id)).length +
      loadLists().filter((l) => listDirtyStamp(l.id)).length;
    const sure = await askYesNo(
      'Reset phone memory?',
      'Are you sure? This removes every binder and list from this phone and signs you out of Google. ' +
      'Your files in Google Drive are not touched, and signing in again brings your collection back.' +
      (waiting > 0 ? `\n\n${waiting} binder${waiting === 1 ? '' : 's'} or list${waiting === 1 ? '' : 's'} with changes not yet saved to Google Drive will be lost.` : ''),
      'Reset', 'Cancel',
    );
    if (!sure) return;
    try {
      await resetPhoneMemory();
      router.navigate({ pathname: '/', params: { message: 'Phone memory reset. Sign in with Google to bring your collection back.' } });
    } catch (err) {
      showMessage('Couldn\'t reset', (err as Error).message);
    }
  }

  return (
    <SettingsSection title="Phone memory">
      <SettingRow
        name="Reset phone memory"
        description="Your binders and lists are kept on this phone for good, even when your Google sign-in runs out. This is the only way to clear them. It never touches Google Drive."
      />
      <View style={styles.buttons}>
        <Button label="Reset phone memory" kind="secondary" icon="trash-outline" onPress={reset} />
      </View>
    </SettingsSection>
  );
}

// The button: with room around it
const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.m, padding: SPACE.m },
});
