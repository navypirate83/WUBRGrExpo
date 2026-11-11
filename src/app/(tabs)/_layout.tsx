/* =====================================================================
   THE TABS ALONG THE BOTTOM
   The app's four main screens, one tab each: Home, The Shelf (your
   binders), Card Finder (searching Scryfall) and Settings. Tapping a
   tab switches screens; each screen stays as you left it (scrolled
   down, a search typed in) when you switch back.
   This is Expo Router's "Tabs": every file in this (tabs) folder is one
   tab, and the list below says each one's title and icon. (The brackets
   in "(tabs)" mean the folder's name isn't part of the address: Card
   Finder is just /search.)
   On a wide window (a tablet, an opened foldable, the website) the tabs
   move from the bottom to a menu down the left side, full or slim: see
   components/SideMenu.tsx and lib/layoutSize.ts for the rule. Narrow
   windows (phones) keep the bottom tabs exactly as before.
   ===================================================================== */

import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import HelpButton from '@/components/HelpButton';
import AppTitle from '@/components/AppTitle';
import AppHeader from '@/components/AppHeader';
import SideMenu from '@/components/SideMenu';
import { useMenuStyle } from '@/hooks/useMenuStyle';
import { useColors } from '@/hooks/useTheme';

// One tab's icon: an outline normally, filled in when it's the tab you're on
function tabIcon(name: keyof typeof Ionicons.glyphMap, filled: keyof typeof Ionicons.glyphMap) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) =>
    <Ionicons name={focused ? filled : name} size={size} color={color as string} />;
}

export default function TabsLayout() {
  const colors = useColors();
  // Which menu fits this window: "none" (the bottom tabs), "slim" or "full"
  const menu = useMenuStyle();
  return (
    <Tabs
      // On a wide window, draw our own side menu instead of the bottom
      // tabs (undefined = the usual bottom tabs)
      tabBar={menu === 'none' ? undefined : () => <SideMenu style={menu} />}
      screenOptions={{
        // The tab bar goes down the left side when there's a side menu
        tabBarPosition: menu === 'none' ? 'bottom' : 'left',
        // Every screen's bar at the top is the app's own, so they're all
        // the same slim size (see AppHeader.tsx)
        header: (props) => <AppHeader {...props} />,
        // The tab you're on is orange; the others are the quieter gray
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        // Just the icons, no words under them (each tab's name is still
        // read out by screen readers)
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* Home: the welcome screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // The app's name, in the five Magic colors (see AppTitle.tsx)
          headerTitle: () => <AppTitle />,
          tabBarIcon: tabIcon('home-outline', 'home'),
          headerRight: () => <HelpButton />,
        }}
      />
      {/* The Shelf: its own stack of screens (the shelf, then a binder
          slides in on top), which draws its own headers */}
      <Tabs.Screen
        name="binders"
        options={{ title: 'The Shelf', headerShown: false, tabBarIcon: tabIcon('library-outline', 'library') }}
      />
      {/* Card Finder: searching for any Magic card */}
      <Tabs.Screen
        name="search"
        options={{
          title: 'Card Finder',
          tabBarIcon: tabIcon('search-outline', 'search'),
          headerRight: () => <HelpButton topic="finder" />,
        }}
      />
      {/* Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: tabIcon('settings-outline', 'settings'),
          headerRight: () => <HelpButton topic="settings" />,
        }}
      />
    </Tabs>
  );
}
