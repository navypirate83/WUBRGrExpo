/* =====================================================================
   GOOGLE SIGN-IN IN THE PHONE APP (the website's empty version)
   The website signs in with Google's own sign-in window (see
   googleDrive.ts), so the phone app's sign-in (phoneGoogleSignIn.ts)
   isn't used here. These stand-ins let the shared code call the same
   names on every device.
   Plain TypeScript with no React in it.
   ===================================================================== */

// The website never uses the phone sign-in
export const PHONE_SIGN_IN_AVAILABLE = false;

// Not used on the website
export async function phoneSignIn(_clientId: string, _scope: string, _quiet = false): Promise<string> {
  throw new Error('The website signs in with Google\'s sign-in window instead.');
}

// Not used on the website
export async function phoneSignOut(): Promise<void> {
  /* nothing to do */
}
