/* =====================================================================
   SETTINGS → ACCOUNT
   How you're using the app, and the buttons to log in or out:
   - logged in to your WUBRG'r account: who you are, "Log out" and "Log
     out everywhere". Not logged in: "Log in" and "Create account".
   - Google is now an optional BACKUP to your Drive (below):
   - signed in with Google: your Google name and email, and "Sign out"
   - using the app locally: "Sign in with Google", which compares this
     device's binders with your Google Drive (asking which way to sync)
   - your Google sign-in has run out (or you signed out): "Sign in with
     Google". Your binders and lists stay on this device either way.
   - not using the binders yet: a button to Home, where you start
   Signing in with Google only works on the website for now: on a phone
   the button explains that (see lib/googleSignInNote.ts).
   ===================================================================== */

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAccount } from '@/hooks/useAccount';
import {
  getDriveUser, initGoogleSignIn, signInWithGoogle, signOutKeepingCollection,
} from '@/lib/googleDrive';
import { reconcileWithDrive } from '@/lib/driveSync';
import { signOut as serverSignOut, signOutEverywhere } from '@/lib/session';
import { forgetServerLinks, syncQuietly } from '@/lib/serverSync';
import { askYesNo } from '@/lib/dialogs';
import { syncSettings } from '@/lib/settings';
import { showMessage } from '@/lib/dialogs';
import { GOOGLE_SIGN_IN_WORKS, explainPhoneSignIn } from '@/lib/googleSignInNote';
import { SPACE } from '@/theme/colors';
import Button from '@/components/Button';
import { SettingRow, SettingsSection } from './SettingsParts';

export default function AccountSection() {
  const { signedIn, serverSignedIn, serverUser, localMode, usingBinders } = useAccount();
  // Signed in before, but the Google pass (it lasts about an hour) ran out
  const expired = usingBinders && !signedIn && !localMode && !serverSignedIn;

  // While signing in or out: the words the busy button shows instead
  const [busyText, setBusyText] = useState<string | null>(null);

  // Who's signed in ("Jo Smith · jo@gmail.com"), asked of Google Drive
  // whenever someone signs in. (If Drive can't say, it's just left out.)
  const [who, setWho] = useState('');
  useEffect(() => {
    if (!signedIn) { setWho(''); return; }
    let stillHere = true;
    getDriveUser()
      .then((user) => {
        if (stillHere) setWho([user.displayName, user.emailAddress].filter(Boolean).join(' · '));
      })
      .catch(() => { /* not shown: the row still says you're signed in */ });
    // (If the screen goes away first, don't update it)
    return () => { stillHere = false; };
  }, [signedIn]);

  // On the website, with a sign-in button showing: get Google's sign-in
  // ready now, so tapping the button can open Google's window straight
  // away (browsers only allow pop-up windows right after a click)
  useEffect(() => {
    if ((localMode || expired) && GOOGLE_SIGN_IN_WORKS) initGoogleSignIn().catch(() => { /* the tap explains */ });
  }, [localMode, expired]);

  // "Sign in with Google": sign in, then compare this device's binders and
  // lists with Google Drive (a window asks which way to sync if they
  // differ; nothing is removed from this device unless "Drive to phone"
  // is chosen), then bring the settings up to date with Drive.
  async function signIn() {
    if (!GOOGLE_SIGN_IN_WORKS) {
      explainPhoneSignIn();
      return;
    }
    setBusyText('Signing in…');
    try {
      await signInWithGoogle();
      setBusyText('Comparing with Google Drive…');
      await reconcileWithDrive({ fromUser: true });
      await syncSettings();
      setBusyText(null);
      if (localMode && !serverSignedIn) router.navigate('/binders');
    } catch (err) {
      setBusyText(null);
      showMessage('Couldn\'t sign in', (err as Error).message);
    }
  }

  // "Sign out": send any unsaved changes to Drive if possible, disconnect
  // from Google, then go to Home, which says "You're signed out." The
  // binders and lists stay on this device.
  async function signOut() {
    setBusyText('Signing out…');
    try {
      await signOutKeepingCollection();
      setBusyText(null);
      router.navigate({ pathname: '/', params: { message: 'You\'re signed out. Your binders and lists are still on this device.' } });
    } catch (err) {
      setBusyText(null);
      showMessage('Couldn\'t sign out', (err as Error).message);
    }
  }

  // "Log out": send the last changes to the server if we can, then log out
  // of this device. The binders and lists stay on this device.
  async function serverLogOut() {
    setBusyText('Logging out…');
    try {
      await syncQuietly();
      await serverSignOut();
      forgetServerLinks();
      setBusyText(null);
      router.navigate({ pathname: '/', params: { message: 'You\'re logged out. Your binders and lists are still on this device.' } });
    } catch (err) {
      setBusyText(null);
      showMessage('Couldn\'t log out',(err as Error).message);
    }
  }

  // "Log out everywhere": ends every login of this account (other phones
  // and browsers too). It needs the internet, and asks first.
  async function logOutEverywhere() {
    if (!(await askYesNo('Log out everywhere?', 'Every phone and computer logged in to your account will need to log in again. Your binders and lists are kept.', 'Log out everywhere'))) return;
    setBusyText('Logging out…');
    try {
      await syncQuietly();
      await signOutEverywhere();
      forgetServerLinks();
      setBusyText(null);
      router.navigate({ pathname: '/', params: { message: 'You\'re logged out everywhere. Your binders and lists are still on this device.' } });
    } catch (err) {
      setBusyText(null);
      showMessage('Couldn\'t log out everywhere',(err as Error).message);
    }
  }

  // Is a sign-in or sign-out under way? (The buttons wait till it's done.)
  const busy = busyText !== null;

  return (
    <SettingsSection title="Account">
      {/* LOGGED IN TO THE WUBRG'R SERVER: who, and the log out buttons */}
      {serverSignedIn && (
        <SettingRow
          name={`Logged in as ${serverUser?.username ?? ''}`}
          description={[serverUser?.name, serverUser?.email].filter(Boolean).join(' · ') + '. Your binders and lists are saved in your account and on this device.'}
        />
      )}
      {serverSignedIn && (
        <View style={styles.buttons}>
          <Button label={busyText ?? 'Log out'} kind="secondary" icon="log-out-outline" disabled={busy} onPress={serverLogOut} />
          <Button label="Log out everywhere" kind="plain" disabled={busy} onPress={logOutEverywhere} />
        </View>
      )}

      {/* NOT LOGGED IN, USING THE APP ON THIS DEVICE: "Log in" */}
      {!serverSignedIn && (
        <View style={styles.buttons}>
          <Button label="Log in" icon="log-in-outline" disabled={busy} onPress={() => router.navigate('/login')} />
          <Button label="Create account" kind="plain" disabled={busy} onPress={() => router.navigate({ pathname: '/login', params: { mode: 'create' } })} />
        </View>
      )}

      {/* SIGNED IN WITH GOOGLE: who, and "Sign out" */}
      {signedIn && (
        <SettingRow name="Google Drive backup is on" description={who || 'Your binders and settings are saved in your Google Drive.'} />
      )}
      {signedIn && (
        <View style={styles.buttons}>
          <Button label={busyText ?? 'Sign out'} kind="secondary" icon="log-out-outline" disabled={busy} onPress={signOut} />
        </View>
      )}

      {/* USING THE APP LOCALLY: "Sign in with Google" */}
      {localMode && !serverSignedIn && (
        <SettingRow
          name="On this device only"
          description="Your binders are saved on this device. Log in to keep them in your account, or sign in with Google below to back them up to your Google Drive."
        />
      )}
      {localMode && !serverSignedIn && (
        <View style={styles.buttons}>
          <Button label={busyText ?? 'Sign in with Google'} icon="logo-google" disabled={busy} onPress={signIn} />
        </View>
      )}

      {/* NOT CONNECTED (the sign-in ran out, or signed out): "Sign in with
          Google". The binders and lists stay on this device. */}
      {expired && (
        <SettingRow
          name="Not connected to Google"
          description="Your binders and lists are still on this device. Sign in with Google to sync them with your Google Drive."
        />
      )}
      {expired && (
        <View style={styles.buttons}>
          <Button label={busyText ?? 'Sign in with Google'} icon="logo-google" disabled={busy} onPress={signIn} />
        </View>
      )}

      {/* LOGGED IN, GOOGLE BACKUP OFF: offer the Google Drive backup */}
      {serverSignedIn && !signedIn && (
        <SettingRow
          name="Google Drive backup"
          description="Optional. Sign in with Google to also keep a copy of your binders in your own Google Drive, so you can reach your files outside the app."
        />
      )}
      {serverSignedIn && !signedIn && (
        <View style={styles.buttons}>
          <Button label={busyText ?? 'Sign in with Google'} icon="logo-google" kind="secondary" disabled={busy} onPress={signIn} />
        </View>
      )}

      {/* NOT USING THE BINDERS YET: start on Home */}
      {!usingBinders && (
        <SettingRow
          name="Not signed in"
          description={'Log in or create an account, or choose "Skip login, local use only", on the Home screen to start your binders.'}
        />
      )}
      {!usingBinders && (
        <View style={styles.buttons}>
          <Button label="Go to Home" kind="secondary" icon="home-outline" onPress={() => router.navigate('/')} />
        </View>
      )}
    </SettingsSection>
  );
}

// The buttons: side by side (wrapping if there isn't room), with room around them
const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.m, padding: SPACE.m },
});
