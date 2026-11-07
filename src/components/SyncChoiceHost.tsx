/* =====================================================================
   THE "WHICH WAY TO SYNC?" WINDOW
   Drawn once, by the app's outer frame (app/_layout.tsx), and invisible
   until the sync code asks a question (see lib/syncChoice.ts). It says
   what's on the phone, what's in Google Drive, what's different, and what
   each choice would do, with three buttons:
   - Phone to Drive: Google Drive becomes a copy of this phone
   - Drive to phone: this phone becomes a copy of Google Drive
   - Not now: change nothing (also what tapping outside the window does)
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import {
  answerSyncQuestion, currentSyncQuestion, onSyncQuestionChange, type Counts,
} from '@/lib/syncChoice';
import PopupWindow from './PopupWindow';

// "3 binders, 1 list"
function describe({ binders, lists }: Counts): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${plural(binders, 'binder')}, ${plural(lists, 'list')}`;
}

export default function SyncChoiceHost() {
  const colors = useColors();
  // Redraws whenever a question appears or is answered
  const pending = useSyncExternalStore(onSyncQuestionChange, currentSyncQuestion, currentSyncQuestion);
  if (!pending) return null;
  const { phone, drive, onlyDrive, onlyPhone, changed } = pending.question;
  const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;

  return (
    <PopupWindow
      title="Phone and Google Drive don't match"
      onClose={() => answerSyncQuestion(null)}
      buttons={[
        { label: 'Not now', kind: 'secondary', onPress: () => answerSyncQuestion(null) },
        { label: 'Drive to phone', kind: 'secondary', onPress: () => answerSyncQuestion('drive-to-phone') },
        { label: 'Phone to Drive', onPress: () => answerSyncQuestion('phone-to-drive') },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>
        On this phone: {describe(phone)}{'\n'}In Google Drive: {describe(drive)}
      </Text>
      {changed > 0 && (
        <Text style={[styles.text, { color: colors.muted }]}>
          {items(changed)} changed in Google Drive since this phone last synced (for example on the website).
        </Text>
      )}
      <Text style={[styles.text, { color: colors.text }]}>
        <Text style={styles.bold}>Phone to Drive:</Text> Google Drive becomes a copy of this phone.
        {onlyDrive > 0 ? ` ${items(onlyDrive)} that are only in Drive will be deleted (moved to the Drive trash).` : ''}
      </Text>
      <Text style={[styles.text, { color: colors.text }]}>
        <Text style={styles.bold}>Drive to phone:</Text> this phone becomes a copy of Google Drive.
        {onlyPhone > 0 ? ` ${items(onlyPhone)} that are only on this phone will be removed from it.` : ''}
        {' '}Changes on this phone that Drive doesn't have yet are lost.
      </Text>
      <Text style={[styles.text, { color: colors.muted }]}>
        Not now changes nothing. You'll be asked again next time you refresh.
      </Text>
    </PopupWindow>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '700' },
});
