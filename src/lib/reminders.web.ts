/* =====================================================================
   REMINDERS ON THE WEB
   Reminders are phone notifications (see reminders.ts). A website can't
   reliably send one later (only while its tab stays open), so on the
   web the "Remind me" button explains that reminders are in the phone
   app instead.
   Plain TypeScript with no React in it.
   ===================================================================== */

// Can this device show reminders? (Not the web.)
export const REMINDERS_AVAILABLE = false;

// Kept so screens can call these the same way on every device
export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}
export async function scheduleReminder(_title: string, _body: string, _seconds: number): Promise<boolean> {
  return false;
}
