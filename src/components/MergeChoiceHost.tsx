/* =====================================================================
   THE "SAME NAME ON BOTH" WINDOW
   Drawn once, by the app's outer frame (app/_layout.tsx), and invisible
   until the sync code asks a question (see lib/mergeChoice.ts). It says
   that this device and your account each have a binder or list of this
   name with different cards, how many cards each has, and offers:
   - Combine: one binder with the cards from both (a card on both counts
     once). Nothing is lost, but a card you moved on one device may show
     up in both of its places, to delete by hand.
   - Keep this device's: this device's cards replace the account's
   - Keep the account's: the account's cards replace this device's
   - Decide later: change nothing now (also what tapping outside does).
     It's asked again the next time the app opens.
   A switch lets one answer apply to all the others with this problem.
   ===================================================================== */

import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import {
  answerMergeQuestion, currentMergeQuestion, onMergeQuestionChange, type MergeChoice,
} from '@/lib/mergeChoice';
import PopupWindow from './PopupWindow';

export default function MergeChoiceHost() {
  const colors = useColors();
  // Redraws whenever a question appears or is answered
  const pending = useSyncExternalStore(onMergeQuestionChange, currentMergeQuestion, currentMergeQuestion);
  // The switch "do the same for the others" (off for every new question)
  const [forAll, setForAll] = useState(false);
  if (!pending) return null;
  const { kind, name, device, account, combined } = pending.question;
  const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

  // Give the answer, and reset the switch for the next question
  function answer(choice: MergeChoice | null) {
    const same = forAll && choice !== null;
    setForAll(false);
    answerMergeQuestion({ choice, forAll: same });
  }

  return (
    <PopupWindow
      title={`"${name}" is on both`}
      onClose={() => answer(null)}
      buttons={[
        { label: 'Decide later', kind: 'plain', onPress: () => answer(null) },
        { label: 'Keep the account\'s', kind: 'secondary', onPress: () => answer('keep-account') },
        { label: 'Keep this device\'s', kind: 'secondary', onPress: () => answer('keep-device') },
        { label: 'Combine', onPress: () => answer('combine') },
      ]}
    >
      <Text style={[styles.text, { color: colors.text }]}>
        This device and your account each have a {kind} called "{name}", with different cards.
      </Text>
      <Text style={[styles.text, { color: colors.text }]}>
        This device: {cards(device)}{'\n'}Your account: {cards(account)}{'\n'}Combined: {cards(combined)}
      </Text>
      <Text style={[styles.text, { color: colors.text }]}>
        <Text style={styles.bold}>Combine:</Text> keeps the cards from both. A card on both counts once.
        If you moved a card to another {kind} on one of them, it may now be in both places.
      </Text>
      <Text style={[styles.text, { color: colors.text }]}>
        <Text style={styles.bold}>Keep this device's</Text> or <Text style={styles.bold}>the account's</Text>:
        that one's cards replace the other's. Cards only on the other side are lost.
      </Text>
      <View style={styles.row}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>Do the same for the others with this problem</Text>
        <Switch value={forAll} onValueChange={setForAll} accessibilityLabel="Do the same for the others with this problem" />
      </View>
      <Text style={[styles.text, { color: colors.muted }]}>
        Decide later changes nothing now. You'll be asked again the next time the app opens.
      </Text>
    </PopupWindow>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22 },
  bold: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, lineHeight: 22 },
});
