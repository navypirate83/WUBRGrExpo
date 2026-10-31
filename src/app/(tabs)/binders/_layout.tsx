/* =====================================================================
   THE SHELF TAB'S STACK OF SCREENS
   Inside The Shelf tab, screens pile up like cards: the shelf of
   binders is at the bottom, and opening a binder slides its pages in on
   top (with a back arrow, and a swipe from the left edge to go back on
   iPhone). This "Stack" is what makes that work.
   - index.tsx: the shelf (/binders)
   - lists.tsx: your lists (/binders/lists), switched to and from the
                shelf with the Binders / Lists buttons. It swaps in
                without sliding, since it's the shelf's other side.
   - list/[id].tsx: one list (/binders/list/abc123), sliding in over
                the lists
   - [id].tsx:  one binder (/binders/abc123: the part in [brackets] is
                the binder's id, which changes from binder to binder)
   ===================================================================== */

import { Stack } from 'expo-router';
import HelpButton from '@/components/HelpButton';
import AppHeader from '@/components/AppHeader';
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
        // Every screen's bar at the top is the app's own, so they're all
        // the same slim size (see AppHeader.tsx)
        header: (props) => <AppHeader {...props} />,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerRight: () => <HelpButton topic="my-binders" />,
      }}
    >
      {/* The shelf */}
      <Stack.Screen name="index" options={{ title: 'The Shelf' }} />
      {/* Your lists: no sliding in, and no back arrow (the switch goes back) */}
      <Stack.Screen name="lists" options={{ title: 'Lists', animation: 'none', headerBackVisible: false, headerLeft: () => null }} />
      {/* One list: it slides in over the lists, with a back arrow. Its
          title is set by the list screen itself (the list's name). */}
      <Stack.Screen name="list/[id]" options={{ title: 'List' }} />
      {/* One binder: its title is set by the binder screen itself (the
          binder's name), and its Help goes to the binder topic */}
      <Stack.Screen name="[id]" options={{ title: 'Binder', headerRight: () => <HelpButton topic="binder" /> }} />
    </Stack>
  );
}
