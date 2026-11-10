/* =====================================================================
   SENDING EMAIL
   Emails (the password reset code, the welcome email) are sent through
   Resend, a mail service with a free plan, by one web request. It needs
   two settings in .env: RESEND_API_KEY (the secret key) and MAIL_FROM
   (the sender, like "WUBRG'r <onboarding@resend.dev>"). Without them,
   mailIsConfigured() is false: the reset routes say email isn't set up,
   and the welcome email is quietly skipped.
   ===================================================================== */

import { welcomeEmail } from './emailTemplates.js';

// Is email set up on this server?
export function mailIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

// Send an email: plain text, and also an HTML version if "html" is given
// (mail programs show the HTML and fall back to the text). Throws if the
// mail service refuses or is slow.
export async function sendMail({ to, subject, text, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, ...(html ? { html } : {}) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Mail service answered ${response.status}`);
}

// Send the welcome email to a person who just made an account. It NEVER
// holds up or breaks signing up: it isn't waited for, and if email isn't
// set up or the mail service fails, the only trace is a line in the
// server's log. Nothing secret is in it (see emailTemplates.js).
export function sendWelcomeEmail(user) {
  if (!mailIsConfigured()) return;
  sendMail({ to: user.email, ...welcomeEmail(user) }).catch((err) => {
    console.error('Could not send the welcome email:', err.message);
  });
}
