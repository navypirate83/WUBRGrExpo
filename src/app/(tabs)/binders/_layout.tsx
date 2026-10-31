/* =====================================================================
   THE SHELF TAB'S STACK OF SCREENS
   Inside The Shelf tab, screens pile up like cards: the shelf of
   binders is at the bottom, and opening a binder slides its pages in on
   top (with a back arrow, and a swipe from the left edge to go back on
   iPhone). This "Stack" is what makes that work.
   - index.tsx: the shelf (/binders)
   - [id].tsx:  one binder (/binders/abc123: the part in [brackets] is
                the binder's id, which changes from binder to binder)
   ===================================================================== */

import { Stack } from 'expo-router';
import HelpButton from '@/components/HelpButton';
import { useColors } from '@/hooks/useTheme';

// The shelf is always at the bottom of this stack, even when a binder
// is opened straight from its address (a shared link, a reminder, or
// reloading the page), so the back arrow always leads to the shelf
export const unstable_settings = { initialRouteName: 'index' };

export default function BindersLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerRight: () => <HelpButton topic="my-binders" />,
      }}
    >
      {/* The shelf */}
      <Stack.Screen name="index" options={{ title: 'The Shelf' }} />
      {/* One binder: its title is set by the binder screen itself (the
          binder's name), and its Help goes to the binder topic */}
      <Stack.Screen name="[id]" options={{ title: 'Binder', headerRight: () => <HelpButton topic="binder" /> }} />
    </Stack>
  );
}
