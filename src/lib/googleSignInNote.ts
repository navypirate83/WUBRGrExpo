/* =====================================================================
   GOOGLE SIGN-IN: WHERE IT WORKS YET
   Signing in with Google works on the website (the browser loads
   Google's own sign-in window: see googleDrive.ts). In the phone app it
   needs the full app build, which isn't made yet, so the sign-in
   buttons on phones explain that instead, and point to "Skip login,
   local use only", which works everywhere.
   Used by the Home and Settings screens.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Platform } from 'react-native';
import { showMessage } from './dialogs';

// Can this device sign in with Google right now? (Only in a web browser.)
export const GOOGLE_SIGN_IN_WORKS = Platform.OS === 'web';

// The message a phone shows when a "Sign in with Google" button is tapped
export function explainPhoneSignIn(): void {
  showMessage(
    'Google sign-in is coming soon',
    'Saving your binders to Google Drive from a phone will work in the full app build, ' +
    'which is on its way.\n\n' +
    'For now, use "Skip login, local use only": everything works, with your binders ' +
    'saved on this device. You can sign in later, and they\'ll be copied to Google Drive then. ' +
    '(Google sign-in already works on the website: navypirate83.github.io/WUBRGrExpo.)',
  );
}
