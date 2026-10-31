/* =====================================================================
   REMINDERS (phone notifications)
   "Remind me" in a binder schedules a notification on the phone, like
   "Time to sort your new cards into Modern", for a little later (in
   10 seconds to try it out, in an hour, or tomorrow).
   Before the first one, the phone asks the person whether the app may
   send notifications (the permission dialog). If they say no, nothing
   is scheduled and the screen says how to turn them on.
   These are "local" notifications: the phone schedules them itself, so
   no server or internet is needed. Expo's "expo-notifications" does the
   work. (The web has its own version, reminders.web.ts.)
   Plain TypeScript with no React in it.
   ===================================================================== */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Android groups notifications into "channels" the person can turn on
// and off in the phone's settings; this app's reminders use this one
const CHANNEL_ID = 'reminders';

// Can this device show reminders? (Phones can; the web can't.)
export const REMINDERS_AVAILABLE = true;

// What to do with a notification that arrives while the app is open:
// still show it as a banner (and in the notification list)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Make sure the app may send notifications, asking the person if it
// hasn't asked before. Answers true if allowed. (On Android 13 and
// later, the question only appears once a channel exists, so the
// channel is made first.)
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // Asked before and refused: the phone won't ask again (it must be
  // turned on in the phone's settings)
  if (!current.canAskAgain) return false;
  const answer = await Notifications.requestPermissionsAsync();
  return answer.granted;
}

// Schedule a reminder "seconds" from now. Answers false if the person
// didn't allow notifications.
export async function scheduleReminder(title: string, body: string, seconds: number): Promise<boolean> {
  if (!(await ensureNotificationPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(seconds)),
      channelId: CHANNEL_ID,
    },
  });
  return true;
}
