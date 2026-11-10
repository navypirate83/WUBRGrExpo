/* =====================================================================
   BEING SIGNED IN TO THE WUBRG'R SERVER
   Creating an account, signing in and out, and staying signed in.
   - The server gives two "tokens" (long secret codes) when you sign in:
       access token   works for 15 minutes; kept only in memory (api.ts)
       refresh token  works for 60 days and is swapped for a new pair; kept
                      on the device so you stay signed in. On a phone it
                      goes in the phone's secure vault (expo-secure-store);
                      on the website, in the browser's saved values.
   - Who you are (name, username, email) is saved too, so the app knows
     you're signed in even with no internet. Being offline never signs you
     out: only the server saying "that login is finished" does.
   Plain TypeScript with no React in it. Screens follow changes through
   accountChanged() (see accountEvents.ts and hooks/useAccount.ts).
   ===================================================================== */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ApiError, apiRequest, refreshOnce, setAccessToken, setAuthHandlers } from './api';
import { accountChanged } from './accountEvents';
import { storageGet, storageRemove, storageSet } from './storage';

// Who is signed in (what the server tells us about the account)
export type ServerUser = { id: string; username: string; email: string; name: string; role: string };

// What the server sends back after any sign-in
type SessionReply = { accessToken: string; refreshToken: string; user: ServerUser };

// The names things are saved under
const REFRESH_KEY = 'serverRefreshToken';
const USER_KEY = 'serverUser';

// Who is signed in right now (null = nobody), and the refresh token in memory
let user: ServerUser | null = null;
let refreshToken: string | null = null;

/* ---------- keeping the refresh token safely ---------- */

// Save it (phone: secure vault; website: saved values)
async function saveRefreshToken(token: string): Promise<void> {
  refreshToken = token;
  if (Platform.OS === 'web') storageSet(REFRESH_KEY, token);
  else await SecureStore.setItemAsync(REFRESH_KEY, token);
}

// Forget it everywhere
async function forgetRefreshToken(): Promise<void> {
  refreshToken = null;
  if (Platform.OS === 'web') storageRemove(REFRESH_KEY);
  else await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => { /* already gone */ });
}

// Read it back when the app starts
async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') return storageGet(REFRESH_KEY);
  return SecureStore.getItemAsync(REFRESH_KEY).catch(() => null);
}

/* ---------- what screens can ask ---------- */

export function getServerUser(): ServerUser | null {
  return user;
}
export function isServerSignedIn(): boolean {
  return user !== null;
}

/* ---------- starting, signing in, signing out ---------- */

// Take a sign-in reply: remember the tokens and who you are
async function startSession(reply: SessionReply): Promise<ServerUser> {
  setAccessToken(reply.accessToken);
  await saveRefreshToken(reply.refreshToken);
  user = reply.user;
  storageSet(USER_KEY, JSON.stringify(reply.user));
  accountChanged();
  return reply.user;
}

// Forget the login on this device (the binders and lists stay)
async function endSession(): Promise<void> {
  setAccessToken(null);
  await forgetRefreshToken();
  user = null;
  storageRemove(USER_KEY);
  accountChanged();
}

// Make an account and sign in to it. The username is optional (left out,
// it's the email).
export function signUp(details: { email: string; password: string; name: string; username?: string }): Promise<ServerUser> {
  return apiRequest<SessionReply>('/auth/signup', { method: 'POST', body: details, auth: false }).then(startSession);
}

// Sign in with a username or email, and the password
export function logIn(who: string, password: string): Promise<ServerUser> {
  return apiRequest<SessionReply>('/auth/login', { method: 'POST', body: { username: who, password }, auth: false })
    .then(startSession);
}

// Sign in with a Google access token (the server checks it with Google)
export function logInWithGoogle(googleAccessToken: string): Promise<ServerUser> {
  return apiRequest<SessionReply>('/auth/google', { method: 'POST', body: { accessToken: googleAccessToken }, auth: false })
    .then(startSession);
}

// Sign out of this device. We tell the server (so the login can't be
// used again) but if it can't be reached we sign out here anyway.
export async function signOut(): Promise<void> {
  const token = refreshToken;
  if (token) {
    await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken: token }, auth: false }).catch(() => { /* signed out here anyway */ });
  }
  await endSession();
}

// Sign out of every phone and browser at once. This needs the server,
// so if it can't be reached it says so instead of pretending it worked.
export async function signOutEverywhere(): Promise<void> {
  await apiRequest('/auth/logout-all', { method: 'POST' });
  await endSession();
}

/* ---------- staying signed in ---------- */

// Swap the saved refresh token for a fresh pair. Returns true on success.
// If the server says the login is finished (401), sign out here too and
// return false. If the server just can't be reached, the error is passed
// on and you stay signed in (offline use must keep working).
async function refreshSession(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    await startSession(await apiRequest<SessionReply>('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }));
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await endSession();
      return false;
    }
    throw err;
  }
}

// Run once when the app starts: pick up a saved login and renew it in
// the background. It doesn't wait for the internet: the app opens
// straight away as "signed in" if a login was saved.
export async function loadSession(): Promise<void> {
  // Let api.ts renew expired access tokens through us, and sign us out
  // here when the server says the login is over
  setAuthHandlers({ refresh: refreshSession, signedOut: () => { void endSession(); } });

  refreshToken = await readRefreshToken();
  const saved = storageGet(USER_KEY);
  if (!refreshToken || !saved) return;
  try { user = JSON.parse(saved) as ServerUser; } catch { return; }
  accountChanged();
  // Get a fresh access token now; if there's no internet it waits until
  // the first request needs one
  // (Through refreshOnce, so it shares a refresh already running: using
  // the same refresh token twice would sign us out)
  refreshOnce().catch(() => { /* offline: stay signed in */ });
}
