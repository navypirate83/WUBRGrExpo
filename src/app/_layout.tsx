/* =====================================================================
   THE APP'S OUTERMOST FRAME (the "root layout")
   Expo Router draws this around every screen. It:
   - keeps the splash screen (the app's icon on a dark background) up
     until everything saved on this device has been read into memory
     (see lib/storage.ts), so no screen ever starts out empty
   - sets up the things every screen shares: gestures (swipes and long
     presses), TanStack Query (which fetches and remembers Scryfall's
     card data), and the light/dark colors for the navigation bars
   - lays out the screens as a "Stack": the tabs at the bottom, and
     screens that slide in on top of them (Help, Lists, Decks)
   ===================================================================== */

import { useEffect, useState } from 'react';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loadStorage } from '@/lib/storage';
import { RequestError } from '@/lib/http';
import { useColors, useTheme } from '@/hooks/useTheme';

// Keep the splash screen showing until we say it can go (below)
SplashScreen.preventAutoHideAsync().catch(() => { /* already hidden */ });

// TanStack Query runs the requests for Scryfall's card data, and keeps
// ("caches") the answers, so looking at the same card again is instant.
// These are its settings for every request:
//  - staleTime Infinity: card details don't change while the app is
//    open, so an answer it already has is never downloaded again.
//  - retry: when a request fails in a way that trying again might fix
//    (no reply, or Scryfall too busy), try again up to 2 more times.
//    A "card not found" answer isn't tried again: it would just fail again.
//  - refetchOnWindowFocus false: don't re-download when you come back
//    to the app.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: (failureCount, error) => error instanceof RequestError && error.retryable && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});

// The tabs are always at the bottom of the stack, even when a screen
// like Help is opened straight from its address (a link, or reloading
// the page), so its back arrow always leads back to the tabs
export const unstable_settings = { initialRouteName: '(tabs)' };

// The frame itself
export default function RootLayout() {
  // Has everything saved on this device been read yet?
  const [ready, setReady] = useState(false);

  // Read it all once, when the app starts, then hide the splash screen
  useEffect(() => {
    loadStorage().finally(() => {
      setReady(true);
      SplashScreen.hideAsync().catch(() => { /* already hidden */ });
    });
  }, []);

  // Until then, draw nothing (the splash screen is still covering it)
  if (!ready) return null;

  return (
    // GestureHandlerRootView: swipes and long presses only work inside it,
    // so it wraps everything
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemedStack />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// The screens, colored for the theme. (A separate piece, because it
// needs useColors, which only works once the saved theme has been read.)
function ThemedStack() {
  const theme = useTheme();
  const colors = useColors();

  // The colors React Navigation uses for its own parts (the bars at the
  // top and bottom, and the background behind sliding screens), started
  // from its built-in light or dark set
  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      {/* The phone's own status bar (clock, battery): light text on the
          dark theme, dark text on the light one */}
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {/* The tabs (Home, The Shelf, Card Finder, Settings) draw their
            own headers, so this one is hidden */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'WUBRG\'r' }} />
        {/* Screens that slide in on top of the tabs */}
        <Stack.Screen name="help" options={{ title: 'Help' }} />
        <Stack.Screen name="lists" options={{ title: 'Lists' }} />
        <Stack.Screen name="decklists" options={{ title: 'Decks' }} />
      </Stack>
    </ThemeProvider>
  );
}
