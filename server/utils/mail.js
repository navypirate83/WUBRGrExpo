/* =====================================================================
   SENDING EMAIL
   Emails (the password reset code) are sent through Resend, a mail
   service with a free plan, by one web request. It needs two settings in
   .env: RESEND_API_KEY (the secret key) and MAIL_FROM (the sender, like
   "WUBRG'r <onboarding@resend.dev>"). Without them, mailIsConfigured()
   is false and the reset routes say email isn't set up.
   ===================================================================== */

// Is email set up on this server?
export function mailIsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

// Send a plain-text email. Throws if the mail service refuses or is slow.
export async function sendMail({ to, subject, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Mail service answered ${response.status}`);
}
