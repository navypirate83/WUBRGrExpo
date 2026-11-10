/* =====================================================================
   THE WORDS OF THE EMAILS
   What each email says, kept apart from how it's sent (mail.js). Each
   one comes in two forms: plain text (every email program can show it,
   and it's what's used if pictures and styling are switched off) and a
   simple HTML version (a little styling, and a button). Nothing secret is
   ever put in the welcome email: no password, no code.
   ===================================================================== */

// Where the website is (the link in the welcome email). Set APP_URL in
// the server's settings to change it.
export function appUrl() {
  return (process.env.APP_URL || 'https://navypirate83.com/wubrgr/').trim();
}

// Make text safe to put inside HTML: "<" and "&" would otherwise be read
// as HTML, so a name like "<b>Sam</b>" could change how the email looks.
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// The welcome email for a new person: { subject, text, html }.
// user needs name, username and email.
export function welcomeEmail(user) {
  const name = (user.name || '').trim() || 'there';
  // For people who signed up with Google (or left the username empty) the
  // username IS their email, so don't say the same thing twice
  const showUsername = user.username && user.username.toLowerCase() !== String(user.email).toLowerCase();
  const url = appUrl();

  const subject = 'Welcome to WUBRG\'r';

  const text = [
    `Hi ${name},`,
    '',
    'Your WUBRG\'r account is ready.',
    '',
    ...(showUsername ? [`Your username: ${user.username}`, 'You can log in with this or with your email address.', ''] : []),
    'What you can do now:',
    '- Keep your Magic card binders and lists in your account, and open them on any phone or computer.',
    '- Everything also stays on your device, so the app works with no internet.',
    '- Look up any card in the Card Finder.',
    '',
    `Open WUBRG'r on the web: ${url}`,
    '',
    'Forgot your username or password? On the login screen choose "Forgot username/password?" and we\'ll email you a code.',
    '',
    'If you didn\'t create this account, you can ignore this email, or use "Forgot username/password?" to set a new password.',
    '',
    '- WUBRG\'r',
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:22px;">Welcome to WUBRG'r</h1>
      <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 12px;font-size:16px;line-height:24px;">Your WUBRG'r account is ready.</p>
      ${showUsername
        ? `<p style="margin:0 0 12px;font-size:16px;line-height:24px;">Your username: <strong>${escapeHtml(user.username)}</strong><br>You can log in with this or with your email address.</p>`
        : ''}
      <p style="margin:16px 0 4px;font-size:16px;font-weight:bold;">What you can do now</p>
      <ul style="margin:0 0 20px;padding-left:20px;font-size:16px;line-height:24px;">
        <li>Keep your Magic card binders and lists in your account, and open them on any phone or computer.</li>
        <li>Everything also stays on your device, so the app works with no internet.</li>
        <li>Look up any card in the Card Finder.</li>
      </ul>
      <p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#e0875a;color:#1b1b1f;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;">Open WUBRG'r</a></p>
      <p style="margin:0 0 12px;font-size:14px;line-height:21px;color:#52606d;">Forgot your username or password? On the login screen choose <em>Forgot username/password?</em> and we'll email you a code.</p>
      <p style="margin:0;font-size:14px;line-height:21px;color:#52606d;">If you didn't create this account, you can ignore this email, or use <em>Forgot username/password?</em> to set a new password.</p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
