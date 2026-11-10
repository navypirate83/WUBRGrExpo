/* =====================================================================
   WHO'S USING THE APP?
   A hook that tells a screen whether someone is signed in to the
   WUBRG'r server, signed in to Google (the Drive backup), using the app
   locally, or using the binders at all, and draws the screen again
   whenever that changes (signing in or out, "Skip login", or the list of
   binders changing: see lib/accountEvents.ts).
   ===================================================================== */

import { useSyncExternalStore } from 'react';
import { accountVersion, onAccountChange } from '@/lib/accountEvents';
import { isSignedIn, isUsingBinders } from '@/lib/googleDrive';
import { isLocalMode } from '@/lib/binderStorage';
import { getServerUser, isServerSignedIn } from '@/lib/session';

export function useAccount() {
  // "useSyncExternalStore" is React's way to follow something kept
  // outside React: it calls onAccountChange to listen, and redraws when
  // accountVersion() comes back different.
  useSyncExternalStore(onAccountChange, accountVersion);
  return {
    // Signed in to Google (the Drive backup)
    signedIn: isSignedIn(),
    // Signed in to the WUBRG'r server, and who
    serverSignedIn: isServerSignedIn(),
    serverUser: getServerUser(),
    localMode: isLocalMode(),
    usingBinders: isUsingBinders() || isServerSignedIn(),
  };
}
