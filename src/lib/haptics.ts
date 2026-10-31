/* =====================================================================
   HAPTIC FEEDBACK (a small buzz or tick you feel in the phone)
   Used when a held card (or binder) lifts and can be dragged, or a
   swipe goes far enough to act, so a finger can feel that it worked.
   On phones, Expo's "expo-haptics" asks the phone's vibration motor for
   a light tap. (The web has its own version of this file,
   haptics.web.ts, since browsers do it differently.)
   Plain TypeScript with no React in it.
   ===================================================================== */

import * as Haptics from 'expo-haptics';

// One short, light tap. If the phone can't (or haptics are turned off
// in its settings), nothing happens and everything else carries on.
export function hapticTap(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { /* no haptics here */ });
}
