/* =====================================================================
   HOME: THE WELCOME SCREEN (the first tab)
   A picture of an open binder full of cards, then a box with:
   - signed out: "Sign in with Google" and "Skip login, local use only"
   - signed in (or using the app locally): where the binders are kept,
     and a "Go to your binders" button
   Under that, a list of places to go: The Shelf, Card Finder, Lists,
   Decks and Help.
   Another screen can send a message to show here, like "You're signed
   out." (Settings does, after signing out): it comes in the address, as
   /?message=...
   Signing in with Google only works on the website for now: on a phone
   the button explains that (see lib/googleSignInNote.ts), and "Skip
   login" works everywhere.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useAccount } from '@/hooks/useAccount';
import { useColors } from '@/hooks/useTheme';
import { initGoogleSignIn, signInWithGoogle } from '@/lib/googleDrive';
import { setLocalMode } from '@/lib/binderStorage';
import { reconcileWithDrive } from '@/lib/driveSync';
import { GOOGLE_SIGN_IN_WORKS, explainPhoneSignIn } from '@/lib/googleSignInNote';
import { MAX_CONTENT_WIDTH, SPACE } from '@/theme/colors';
import Button from '@/components/Button';
import GoogleSignInButton from '@/components/home/GoogleSignInButton';
import HomeLinks from '@/components/home/HomeLinks';

export default function HomeScreen() {
  const colors = useColors();
  const { signedIn, localMode, usingBinders } = useAccount();
  // Already signed in, or using the app locally? Then it's "welcome back"
  // (no sign-in buttons).
  const welcomeBack = signedIn || localMode;

  /* ----- The message under the buttons ----- */

  // A message sent here by another screen (like "You're signed out.")
  const { message: sentMessage } = useLocalSearchParams<{ message?: string }>();
  // The message showing (sign-in problems are shown here too)
  const [message, setMessage] = useState(sentMessage ?? '');
  // Is signing in under way? (The Google button fades while it is.)
  const [busy, setBusy] = useState(false);

  // When a message arrives, show it, then take it out of the address, so
  // the same message sent again later still shows
  useEffect(() => {
    if (!sentMessage) return;
    setMessage(sentMessage);
    router.setParams({ message: undefined });
  }, [sentMessage]);

  /* ----- Signing in, or skipping it ----- */

  // Signed out, on the website: get Google's sign-in ready now, so tapping
  // the button can open Google's window straight away (browsers only
  // allow pop-up windows right after a click). If it can't load, say why.
  useEffect(() => {
    if (!welcomeBack && GOOGLE_SIGN_IN_WORKS) {
      initGoogleSignIn().catch((err: Error) => setMessage(err.message));
    }
  }, [welcomeBack]);

  // "Sign in with Google": on the website, open Google's sign-in window,
  // and once signed in, show the binders. On a phone, explain that it's
  // coming in the full app build.
  async function signIn() {
    if (!GOOGLE_SIGN_IN_WORKS) {
      explainPhoneSignIn();
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      await signInWithGoogle();
      // Compare this phone with Google Drive (asking which way to sync if
      // they differ: a first install with a collection already in Drive,
      // for one), then show the shelf
      await reconcileWithDrive({ fromUser: true });
      router.push('/binders');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // "Skip login, local use only": use the app without signing in, with
  // the binders saved on this device only. Binders already on this device
  // are kept (nothing but "Reset phone memory" in Settings removes them).
  function skipLogin() {
    setMessage('');
    setLocalMode(true);
    router.push('/binders');
  }

  // The line under the heading: what happens to your binders
  const explanation = !welcomeBack
    ? 'Sign in with your Google account. Your binders are saved in your own Google Drive, so you can open them on any computer or phone.'
    : localMode
      ? 'Your binders are saved on this device. Sign in with Google (in Settings) any time to keep them in your Google Drive too.'
      : 'You\'re signed in. Your binders are saved in your own Google Drive, so you can open them on any computer or phone.';

  return (
    // The whole screen scrolls, in case it's taller than a small phone
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.column}>
        {/* The open binder full of cards. Screen readers skip it: it's
            only decoration, and the heading says what the screen is. */}
        <Image
          source={require('@/assets/images/open-binder.png')}
          style={styles.art}
          contentFit="contain"
          accessible={false}
        />

        {/* THE BOX: heading, explanation, buttons and messages */}
        <View style={styles.box}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">Your Magic card binders</Text>
          <Text style={[styles.text, { color: colors.muted }]}>{explanation}</Text>

          {welcomeBack ? (
            // Already signed in (or using the app locally): a button to the shelf
            <Button label="Go to your binders" icon="arrow-forward" onPress={() => router.push('/binders')} />
          ) : (
            <>
              {/* "Sign in with Google", styled the way Google asks */}
              <GoogleSignInButton onPress={signIn} busy={busy} />

              {/* Use the app without signing in: a plain text button */}
              <Button label="Skip login, local use only" kind="plain" onPress={skipLogin} style={styles.skip} />
            </>
          )}

          {/* Messages (like "You're signed out." or "Sign-in was
              cancelled."), read out by screen readers when they appear */}
          {message !== '' && (
            <Text style={[styles.message, { color: colors.error }]} accessibilityLiveRegion="polite">{message}</Text>
          )}
        </View>

        {/* PLACES TO GO: The Shelf (for someone using the binders), Card
            Finder, Lists, Decks and Help */}
        <Text style={[styles.groupTitle, { color: colors.muted }]} accessibilityRole="header">Go to</Text>
        <HomeLinks showShelf={usingBinders} />
      </View>
    </ScrollView>
  );
}

// The screen's look: everything centered in one column (never wider than
// 560 points on a tablet or computer), with room around it
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: SPACE.l, paddingBottom: SPACE.xxl },
  column: { width: '100%', maxWidth: Math.min(560, MAX_CONTENT_WIDTH), alignSelf: 'center' },
  // The picture keeps its shape (760 wide by 458 tall), as wide as the column
  art: { width: '100%', aspectRatio: 760 / 458, marginTop: SPACE.s, marginBottom: SPACE.xl },
  box: { alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  text: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: SPACE.xl, maxWidth: 420 },
  skip: { marginTop: SPACE.m },
  message: { fontSize: 15, textAlign: 'center', marginTop: SPACE.l },
  groupTitle: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: SPACE.xxl, marginBottom: SPACE.s, marginLeft: SPACE.xs,
  },
});
