/* =====================================================================
   CHECKING A GOOGLE SIGN-IN (Option A)
   The app signs in with Google and sends us Google's "access token".
   We can't trust it just because the app says so, so we ask Google:
   1. "Was this token made for MY app?" (tokeninfo). A token made for some
      other app must be refused, or anyone could sign in with a token
      taken from another website.
   2. "Who does it belong to?" (userinfo: the person's id, email, name).
   Needs the openid, email and profile permissions (the app asks for them
   next to Drive access).
   ===================================================================== */

// The Google client ids this server accepts (the website's and the phone's
// may differ), from GOOGLE_CLIENT_ID separated by commas
function allowedClientIds() {
  return (process.env.GOOGLE_CLIENT_ID ?? '').split(',').map((id) => id.trim()).filter(Boolean);
}

// Is Google sign-in set up on this server at all?
export function googleIsConfigured() {
  return allowedClientIds().length > 0;
}

// Asks Google, with a time limit so a slow answer can't hang us
async function askGoogle(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return response.json();
}

// Returns { sub, email, emailVerified, name } for a good token, or null
// when the token is fake, expired, or made for another app
export async function checkGoogleAccessToken(accessToken) {
  const info = await askGoogle(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  if (!info) return null;
  const allowed = allowedClientIds();
  if (!allowed.includes(info.aud) && !allowed.includes(info.azp)) return null;

  const profile = await askGoogle('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profile || typeof profile.sub !== 'string' || typeof profile.email !== 'string') return null;
  return {
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    emailVerified: profile.email_verified === true || profile.email_verified === 'true',
    name: typeof profile.name === 'string' ? profile.name.slice(0, 100) : '',
  };
}
