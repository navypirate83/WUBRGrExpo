/* =====================================================================
   SIMPLE MESSAGES AND YES/NO QUESTIONS (on phones)
   - showMessage: a small message with an OK button ("That file isn't a
     readable binder file.")
   - askYesNo: a question with two buttons; answers true for yes
   Phones use React Native's "Alert", which shows the phone's own
   message box. (The web has its own version, dialogs.web.ts, since
   Alert does nothing in a browser.)
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Alert } from 'react-native';

// Show a message with an OK button
export function showMessage(title: string, message?: string): void {
  Alert.alert(title, message);
}

// Ask a question. "yes" and "no" are the buttons' words (like "Delete"
// and "Cancel"). Closing it any other way (Android's Back button)
// counts as no.
export function askYesNo(title: string, message: string, yes = 'OK', no = 'Cancel'): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: no, style: 'cancel', onPress: () => resolve(false) },
      { text: yes, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
