/* =====================================================================
   KEEPING THE SERVER UP TO DATE BY ITSELF
   While you're signed in to the WUBRG'r server, this checks every few
   seconds whether anything on the device changed (a card moved, a binder
   renamed...) and sends it. It also asks the server for news from your
   other devices every couple of minutes. Checking for a change needs no
   internet; only an actual sync does, and having none is fine: it tries
   again at the next check. Used once, in the root layout.
   ===================================================================== */

import { useEffect } from 'react';
import { changedSinceSync, syncQuietly } from '@/lib/serverSync';
import { useAccount } from '@/hooks/useAccount';

// How often to look for local changes, and how often to ask the server
// for news (milliseconds)
const CHECK_EVERY_MS = 5000;
const PULL_EVERY_MS = 120000;

export function useAutoSync() {
  const { serverSignedIn } = useAccount();

  useEffect(() => {
    if (!serverSignedIn) return;
    // Sync once straight away (sign-in, or the app opening)
    syncQuietly();
    let lastPull = Date.now();
    const timer = setInterval(() => {
      const due = Date.now() - lastPull >= PULL_EVERY_MS;
      if (due || changedSinceSync()) {
        lastPull = Date.now();
        syncQuietly();
      }
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [serverSignedIn]);
}
