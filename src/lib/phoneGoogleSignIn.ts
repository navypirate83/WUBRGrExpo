/* =====================================================================
   GOOGLE SIGN-IN IN THE PHONE APP
   On phones, signing in uses the phone's own Google account picker,
   through the "@react-native-google-signin/google-signin" add-on. It
   hands back the same kind of access token as the website's sign-in (a
   temporary pass to the person's Google Drive: see googleDrive.ts).
   The add-on has phone code of its own, so it only works in the app's
   own build (made with EAS Build), not in Expo Go. In Expo Go it isn't
   even loaded (loading it there would crash the app), and sign-in says
   it needs the full app.
   (The website uses Google's sign-in window instead: phoneGoogleSignIn.web.ts
   is the website's empty version of this file.)
   Plain TypeScript with no React in it.
   ===================================================================== */

import Constants, { ExecutionEnvironment } from 'expo-constants';

// The add-on, if this is the app's own build ("storeClient" means Expo Go)
type SignInLibrary = typeof import('@react-native-google-signin/google-signin');
let library: SignInLibrary | null = null;
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  try {
    library = require('@react-native-google-signin/google-signin') as SignInLibrary;
  } catch {
    library = null;   // missing from this build: sign-in explains
  }
}

// Can this phone sign in with Google? (Only the app's own build can.)
export const PHONE_SIGN_IN_AVAILABLE = library !== null;

// Tell the add-on which Google app is asking (the "web client ID": the
// same one as the website) and what it may use (Drive files it made).
// Only needed once.
let setUp = false;
function setUpOnce(clientId: string, scope: string) {
  if (setUp || !library) return;
  library.GoogleSignin.configure({ webClientId: clientId, scopes: [scope] });
  setUp = true;
}

// Sign in and get an access token.
//  - "quiet": only sign in again without asking (someone who signed in
//    before, when their pass has run out); fails if that's not possible
//  - otherwise: try quietly first, then show the phone's account picker
// Rejects with a message if it doesn't work (or is cancelled).
export async function phoneSignIn(clientId: string, scope: string, quiet = false): Promise<string> {
  if (!library) {
    throw new Error('Google sign-in needs the full WUBRG\'r app (it doesn\'t work in Expo Go).');
  }
  setUpOnce(clientId, scope);
  const { GoogleSignin } = library;
  // Android needs Google Play services (it offers to update them if old)
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: !quiet });
  const again = await GoogleSignin.signInSilently();
  if (again.type !== 'success') {
    if (quiet) throw new Error('Not signed in.');
    const picked = await GoogleSignin.signIn();
    if (picked.type !== 'success') throw new Error('Sign-in was cancelled.');
  }
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

// Sign out: cancel the app's access to Drive, and forget the account
export async function phoneSignOut(): Promise<void> {
  if (!library) return;
  try { await library.GoogleSignin.revokeAccess(); } catch { /* already gone */ }
  try { await library.GoogleSignin.signOut(); } catch { /* already signed out */ }
}
