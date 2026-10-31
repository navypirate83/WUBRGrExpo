/* =====================================================================
   GOOGLE SIGN-IN: WHERE IT WORKS
   Signing in with Google works on the website (Google's own sign-in
   window: see googleDrive.ts) and in the WUBRG'r app itself (the phone's
   Google account picker: see phoneGoogleSignIn.ts). It doesn't work in
   Expo Go (the app used to try out the code while it's being written),
   which can't run the sign-in add-on, so there the sign-in buttons
   explain that instead, and point to "Skip login, local use only",
   which works everywhere.
   Used by the Home and Settings screens.
   Plain TypeScript with no React in it.
   ===================================================================== */

import { Platform } from 'react-native';
import { showMessage } from './dialogs';
import { PHONE_SIGN_IN_AVAILABLE } from './phoneGoogleSignIn';

// Can this device sign in with Google right now? (A web browser, or the
// app's own build: not Expo Go.)
export const GOOGLE_SIGN_IN_WORKS = Platform.OS === 'web' || PHONE_SIGN_IN_AVAILABLE;

// The message shown when a "Sign in with Google" button is tapped in Expo Go
export function explainPhoneSignIn(): void {
  showMessage(
    'Google sign-in needs the full app',
    'Expo Go can\'t sign in with Google: the WUBRG\'r app itself can.\n\n' +
    'For now, use "Skip login, local use only": everything works, with your binders ' +
    'saved on this device. You can sign in later, and they\'ll be copied to Google Drive then. ' +
    '(Google sign-in also works on the website: navypirate83.github.io/WUBRGrExpo.)',
  );
}
