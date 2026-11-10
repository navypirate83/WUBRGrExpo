/* =====================================================================
   LOGIN, CREATE ACCOUNT, AND FORGOT USERNAME/PASSWORD (/login)
   One screen with three "modes", chosen by the address (/login?mode=create):
   - login:   username or email + password, a "Forgot username/password?"
              link, and a "Create account" link
   - create:  name, email, an optional username (left empty, the email is
              the username) and a password
   - forgot:  step 1, type your email: the server emails you your username
              and a 6-digit code. Step 2, type the code and a new password.
   After signing in or creating an account the binders and lists on this
   device are sent to your account (see lib/serverSync.ts), then you go to
   your binders.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useTheme';
import { apiRequest, onServerWaking } from '@/lib/api';
import { logIn, signUp } from '@/lib/session';
import { syncQuietly } from '@/lib/serverSync';
import { MAX_CONTENT_WIDTH, SPACE } from '@/theme/colors';
import Button from '@/components/Button';
import TextField from '@/components/TextField';

// The three things this screen can be doing
type Mode = 'login' | 'create' | 'forgot';

export default function LoginScreen() {
  const colors = useColors();
  // Which mode to start in comes from the address (/login?mode=create)
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'create' ? 'create' : 'login');

  // What has been typed
  const [who, setWho] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  // Forgot mode: has the code been sent yet? (Then step 2 shows.)
  const [codeSent, setCodeSent] = useState(false);

  // The message under the buttons (a problem, or good news), and whether
  // something is under way (the buttons wait) and whether the server is
  // slow to answer (a sleeping server takes up to a minute to wake)
  const [message, setMessage] = useState('');
  const [good, setGood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  useEffect(() => onServerWaking(setWaking), []);

  // Change mode, starting with a clean message
  function go(next: Mode) {
    setMode(next);
    setMessage('');
    setGood(false);
    setCodeSent(false);
  }

  // Run something that talks to the server: block the buttons meanwhile,
  // and show the server's message if it fails
  async function run(job: () => Promise<void>) {
    setMessage('');
    setBusy(true);
    try {
      await job();
    } catch (err) {
      setGood(false);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // After signing in: send this device's binders up (and bring the
  // account's down), then show the binders
  async function finishSignIn() {
    const problem = await syncQuietly();
    if (problem) setMessage(`Signed in, but syncing didn't finish: ${problem}`);
    router.navigate('/binders');
  }

  // "Login"
  const login = () => run(async () => {
    await logIn(who, password);
    await finishSignIn();
  });

  // "Create account"
  const create = () => run(async () => {
    await signUp({ email, password, name, username: username.trim() || undefined });
    await finishSignIn();
  });

  // Forgot, step 1: ask the server to email the code
  const sendCode = () => run(async () => {
    const reply = await apiRequest<{ message: string }>('/auth/forgot', { method: 'POST', body: { email }, auth: false });
    setCodeSent(true);
    setGood(true);
    setMessage(reply.message);
  });

  // Forgot, step 2: the code and a new password
  const changePassword = () => run(async () => {
    await apiRequest('/auth/reset', { method: 'POST', body: { email, code, password }, auth: false });
    // Done: back to Login with the username filled in is not possible
    // (we don't know it), so just say so
    setMode('login');
    setCodeSent(false);
    setPassword('');
    setGood(true);
    setMessage('Password changed. Log in with your username (or email) and the new password.');
  });

  // The heading for each mode
  const heading = { login: 'Log in', create: 'Create account', forgot: 'Forgot username or password' }[mode];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{heading}</Text>

          {/* LOGIN */}
          {mode === 'login' && (
            <View style={styles.form}>
              <TextField label="Username or email" value={who} onChangeText={setWho} autoCapitalize="none" autoCorrect={false}
                         autoComplete="username" textContentType="username" returnKeyType="next" />
              <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
                         autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={login} />
              <Button label={busy ? 'Logging in…' : 'Log in'} icon="log-in-outline" disabled={busy || !who.trim() || !password} onPress={login} />
              {/* The forgot link lives in the login area */}
              <Button label="Forgot username/password?" kind="plain" onPress={() => go('forgot')} />
              <Button label="Create account" kind="plain" onPress={() => go('create')} />
            </View>
          )}

          {/* CREATE ACCOUNT */}
          {mode === 'create' && (
            <View style={styles.form}>
              <TextField label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={100} />
              <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
                         keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
              <TextField label="Username (optional)" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false}
                         placeholder="Leave empty to use your email" maxLength={30} />
              <TextField label="Password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
                         autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={create} />
              <Button label={busy ? 'Creating…' : 'Create account'} icon="person-add-outline"
                      disabled={busy || !name.trim() || !email.trim() || password.length < 8} onPress={create} />
              <Button label="I already have an account" kind="plain" onPress={() => go('login')} />
            </View>
          )}

          {/* FORGOT USERNAME OR PASSWORD */}
          {mode === 'forgot' && (
            <View style={styles.form}>
              <Text style={[styles.text, { color: colors.muted }]}>
                Type the email of your account. We email you your username and a 6-digit code to set a new password.
              </Text>
              <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
                         keyboardType="email-address" autoComplete="email" textContentType="emailAddress" editable={!codeSent} />
              {!codeSent ? (
                <Button label={busy ? 'Sending…' : 'Email me'} icon="mail-outline" disabled={busy || !email.trim()} onPress={sendCode} />
              ) : (
                <>
                  <TextField label="6-digit code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
                  <TextField label="New password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry
                             autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
                  <Button label={busy ? 'Changing…' : 'Change password'} icon="key-outline"
                          disabled={busy || code.trim().length !== 6 || password.length < 8} onPress={changePassword} />
                </>
              )}
              <Button label="Back to log in" kind="plain" onPress={() => go('login')} />
            </View>
          )}

          {/* Only the username? It is in the same email: no password change is needed. */}

          {/* Slow server: say why, so it doesn't look frozen */}
          {waking && <Text style={[styles.message, { color: colors.muted }]} accessibilityLiveRegion="polite">Waking the server… this can take up to a minute.</Text>}

          {/* A problem, or good news */}
          {message !== '' && (
            <Text style={[styles.message, { color: good ? colors.text : colors.error }]} accessibilityLiveRegion="polite">{message}</Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// The look: one centered column, no wider than 460 points
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: SPACE.l, paddingBottom: SPACE.xxl },
  column: { width: '100%', maxWidth: Math.min(460, MAX_CONTENT_WIDTH), alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: SPACE.l },
  form: { gap: SPACE.m },
  text: { fontSize: 15, lineHeight: 22 },
  message: { fontSize: 15, textAlign: 'center', marginTop: SPACE.l },
});
