/* =====================================================================
   THE MENU DOWN THE LEFT SIDE (tablets, opened foldables, the website)
   When the window is wide enough (see lib/layoutSize.ts), this replaces
   the tabs along the bottom. It has two sizes:
     - "full": the app's name in its five colors, then Home, a "Shelf"
       group with Binders, Lists and Decks under it, Card Finder, Settings,
       Help, and your account at the bottom
     - "slim": the same, but icons only, in a narrow strip
   The Binders, Lists and Decks lines go to the last place in that section
   (the binder you had open, say), and "The Shelf" is a button that goes
   back to the last place in the shelf (see lib/shelfMemory.ts). The
   exception: while you're INSIDE a binder, list or deck, the line for that
   same part (and "The Shelf") goes up to that part's main page instead.
   When the window is short (a phone held sideways) and not every line fits,
   the whole menu scrolls up and down, down to the account block at its end.
   A button above Help collapses the full menu to the slim one (and
   expands it again): it's remembered on this device.
   The page you're on is highlighted. The icons are the app's own (the
   same ones as the bottom tabs, and the binder, notebook and deck box
   drawings from the shelf's Binders / Lists / Decks switch).
   The account block at the bottom shows who is logged in; tapping it
   opens a small menu with Account settings, Sync now and Log out (which
   asks "Are you sure?" first). Logged out, it shows Log in and Create
   account instead.
   ===================================================================== */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAccount } from '@/hooks/useAccount';
import { useFullMenuFits } from '@/hooks/useMenuStyle';
import { useColors } from '@/hooks/useTheme';
import { askYesNo, showMessage } from '@/lib/dialogs';
import { changedSinceSync, syncQuietly } from '@/lib/serverSync';
import { setMenuCollapsed } from '@/lib/menuPreference';
import { sectionHref, shelfHref, shelfRootHref, type ShelfSection } from '@/lib/shelfMemory';
import { signOut as serverSignOut } from '@/lib/session';
import { FULL_MENU_WIDTH, SLIM_MENU_WIDTH } from '@/lib/layoutSize';
import { RADIUS, SPACE } from '@/theme/colors';

// The app's three drawn icons (binder, notebook and Commander deck box)
const BINDER_PICTURE = require('../../assets/images/binder-outline.svg') as number;
const NOTEBOOK_PICTURE = require('../../assets/images/notebook-outline.svg') as number;
const DECK_BOX_PICTURE = require('../../assets/images/deckbox-outline.svg') as number;

// An Ionicons icon's name, written the way the icon set spells it
type IconName = keyof typeof Ionicons.glyphMap;

// Is this address the Lists page (or one list), or the Decks page (or one deck)?
// Everything else under /binders is the Binders page (the shelf, or one binder).
const LISTS_ADDRESS = /^\/binders\/lists?(\/|$)/;
const DECKS_ADDRESS = /^\/binders\/decks?(\/|$)/;

export default function SideMenu({ style }: { style: 'slim' | 'full' }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slim = style === 'slim';
  // Room for the full menu? Then there's a Collapse / Expand button
  // (a slim menu on a small window has nothing to expand into)
  const canResize = useFullMenuFits();
  // The account block's little menu: open or not, and the words shown in the
  // block while it syncs or logs out. They live here because the little
  // menu is drawn over the page, outside the scrolling area.
  const [accountOpen, setAccountOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Which page we're on, from the address ("/", "/binders", "/search"...)
  const path = usePathname();

  const onHome = path === '/';
  const onLists = LISTS_ADDRESS.test(path);
  const onDecks = DECKS_ADDRESS.test(path);
  const onBinders = path.startsWith('/binders') && !onLists && !onDecks;
  const onSearch = path === '/search';
  const onSettings = path === '/settings';
  // The main page of the part of the shelf you're in (the shelf of binders,
  // the lists page or the decks page), or null when you're not in the shelf
  const mainHere = shelfRootHref(path);
  // Where a Binders / Lists / Decks line goes: if you're inside that part
  // already, up to its main page; otherwise the last place you were in it
  const goTo = (section: ShelfSection, inside: boolean) => {
    router.navigate((inside && mainHere ? mainHere : sectionHref(section)) as never);
  };

  return (
    // The whole menu. It sits above the page (zIndex) so the account menu
    // can open over the page's edge.
    <View
      accessibilityRole="menu"
      style={[
        styles.menu,
        {
          width: slim ? SLIM_MENU_WIDTH : FULL_MENU_WIDTH,
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
          paddingTop: insets.top + SPACE.m,
          paddingBottom: Math.max(insets.bottom, SPACE.s),
          paddingHorizontal: slim ? SPACE.s : SPACE.m,
        },
      ]}
    >
      {/* A small round button at the top that collapses the full menu or
          expands the slim one (the app's name isn't repeated here, since
          the page header already shows it). */}
      {/* Everything except the account block sits in a scrolling area, so on
          a short window (a phone held sideways) the lines that don't fit
          can be scrolled to. The spacer below pushes Help to the bottom
          when there IS room. */}
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.logo, slim && styles.logoSlim]}>
        {canResize && (
          <Pressable
            onPress={() => setMenuCollapsed(!slim)}
            accessibilityRole="button"
            accessibilityLabel={slim ? 'Expand menu' : 'Collapse menu'}
            hitSlop={8}
            style={[styles.collapseButton, slim && styles.collapseButtonSlim, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}
          >
            <Ionicons name={slim ? 'chevron-forward' : 'chevron-back'} size={16} color={colors.text} />
          </Pressable>
        )}
      </View>

      <MenuItem slim={slim} label="Home" icon="home-outline" activeIcon="home" active={onHome} onPress={() => router.navigate('/')} />

      {/* The Shelf: a button back to where you were in the shelf, with the
          things on it under it */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="The Shelf"
        accessibilityHint="Goes back to where you were in the shelf, or up to the main page if you're inside a binder, list or deck"
        onPress={() => router.navigate((mainHere ?? shelfHref()) as never)}
        style={({ pressed }) => [styles.groupHeading, slim && styles.centered, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name={onBinders || onLists || onDecks ? 'library' : 'library-outline'} size={22} color={colors.text} />
        {!slim && <Text style={[styles.groupText, { color: colors.text }]}>The Shelf</Text>}
      </Pressable>
      <View style={[styles.subItems, !slim && { borderLeftColor: colors.border }, slim && styles.subItemsSlim]}>
        <MenuItem slim={slim} sub label="Binders" picture={BINDER_PICTURE} active={onBinders} onPress={() => goTo('binders', onBinders)} />
        <MenuItem slim={slim} sub label="Lists" picture={NOTEBOOK_PICTURE} active={onLists} onPress={() => goTo('lists', onLists)} />
        <MenuItem slim={slim} sub label="Decks" picture={DECK_BOX_PICTURE} active={onDecks} onPress={() => goTo('decks', onDecks)} />
      </View>

      <MenuItem slim={slim} label="Card Finder" icon="search-outline" activeIcon="search" active={onSearch} onPress={() => router.navigate('/search')} />
      <MenuItem slim={slim} label="Settings" icon="settings-outline" activeIcon="settings" active={onSettings} onPress={() => router.navigate('/settings')} />

      {/* Pushes everything below to the bottom of the menu */}
      <View style={styles.grow} />

      <MenuItem slim={slim} label="Help" icon="help-circle-outline" activeIcon="help-circle" active={false} onPress={() => router.navigate('/help')} />
      <AccountBlock slim={slim} open={accountOpen} setOpen={setAccountOpen} busy={busy} />
      </ScrollView>
      {/* The account's little menu: drawn here, over the bottom of the menu and the page, not inside the scrolling area (which would cut it off) */}
      <AccountPopup open={accountOpen} setOpen={setAccountOpen} setBusy={setBusy} bottom={Math.max(insets.bottom, SPACE.s) + 8} />
    </View>
  );
}

/* ---------------------------------------------------------------------
   ONE MENU LINE: an icon, and (in the full menu) its name. The page
   you're on gets a lighter background and an orange mark down its left
   edge. "sub" lines (Binders, Lists) are a little smaller.
   --------------------------------------------------------------------- */
function MenuItem({ slim, label, icon, activeIcon, picture, active, sub, onPress }: {
  slim: boolean;
  label: string;
  icon?: IconName;            // an Ionicons icon (outline), or...
  activeIcon?: IconName;      // ...its filled version, for the page you're on
  picture?: number;           // ...one of the app's drawings
  active: boolean;
  sub?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const tint = active ? colors.text : colors.muted;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        sub && styles.itemSub,
        slim && styles.centered,
        active && { backgroundColor: colors.surfaceHover, borderLeftColor: colors.accent },
        pressed && { backgroundColor: colors.surfaceHover },
      ]}
    >
      {picture !== undefined
        ? <Image source={picture} style={styles.picture} contentFit="contain" tintColor={tint} />
        : <Ionicons name={active && activeIcon ? activeIcon : icon!} size={22} color={tint} />}
      {!slim && <Text style={[styles.itemText, sub && styles.itemTextSub, { color: tint }]} numberOfLines={1}>{label}</Text>}
    </Pressable>
  );
}

/* ---------------------------------------------------------------------
   THE ACCOUNT BLOCK at the bottom of the menu.
   Logged in: a round badge with your initial (and, in the full menu,
   your name and whether your changes are synced). Tapping it opens a
   small menu above it. Logged out: Log in and Create account.
   --------------------------------------------------------------------- */
function AccountBlock({ slim, open, setOpen, busy }: { slim: boolean; open: boolean; setOpen: (open: boolean | ((now: boolean) => boolean)) => void; busy: string | null }) {
  const colors = useColors();
  const { serverSignedIn, serverUser, signedIn } = useAccount();

  // NOT LOGGED IN: Log in and Create account (just a log-in icon when slim)
  if (!serverSignedIn) {
    return (
      <View style={[styles.account, { borderTopColor: colors.border }]}>
        {slim ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Log in" onPress={() => router.navigate('/login')}
                     style={({ pressed }) => [styles.item, styles.centered, pressed && { backgroundColor: colors.surfaceHover }]}>
            <Ionicons name="log-in-outline" size={22} color={colors.accent} />
          </Pressable>
        ) : (
          <View style={styles.loginBox}>
            <Text style={[styles.loginNote, { color: colors.muted }]}>
              Log in to keep your binders safe and in sync on every device.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/login')}
                       style={({ pressed }) => [styles.loginButton, { backgroundColor: colors.accent }, pressed && { opacity: 0.85 }]}>
              <Text style={[styles.loginButtonText, { color: colors.accentText }]}>Log in</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/login', params: { mode: 'create' } })}
                       style={({ pressed }) => [styles.loginButton, { borderColor: colors.border, borderWidth: 1 }, pressed && { backgroundColor: colors.surfaceHover }]}>
              <Text style={[styles.loginButtonText, { color: colors.text }]}>Create account</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // LOGGED IN: who, and whether everything is synced
  const name = serverUser?.name || serverUser?.username || 'Account';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const waiting = changedSinceSync();

  return (
    <View style={[styles.account, { borderTopColor: colors.border }]}>
      {/* The block: badge, and name + status when there's room */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Account: ${name}`}
        accessibilityState={{ expanded: open }}
        disabled={busy !== null}
        onPress={() => setOpen((now) => !now)}
        style={({ pressed }) => [styles.me, slim && styles.centered, (open || pressed) && { backgroundColor: colors.surfaceHover }]}
      >
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text style={[styles.badgeText, { color: colors.accentText }]}>{initial}</Text>
        </View>
        {!slim && (
          <View style={styles.meText}>
            <Text style={[styles.meName, { color: colors.text }]} numberOfLines={1}>{busy ?? name}</Text>
            <Text style={[styles.meStatus, { color: colors.muted }]} numberOfLines={1}>
              {waiting ? 'Changes waiting to sync' : 'Synced'}{signedIn ? ' · Drive backup on' : ''}
            </Text>
          </View>
        )}
        {!slim && <Ionicons name={open ? 'chevron-down' : 'chevron-up'} size={14} color={colors.muted} />}
      </Pressable>
    </View>
  );
}

/* ---------------------------------------------------------------------
   THE ACCOUNT'S LITTLE MENU: your email, whether things are synced, and
   Account settings, Sync now and Log out. Opened by tapping the account
   block; drawn over the bottom of the menu.
   --------------------------------------------------------------------- */
function AccountPopup({ open, setOpen, setBusy, bottom }: { open: boolean; setOpen: (open: boolean) => void; setBusy: (words: string | null) => void; bottom: number }) {
  const colors = useColors();
  const { serverSignedIn, serverUser, signedIn } = useAccount();
  if (!open || !serverSignedIn) return null;
  const name = serverUser?.name || serverUser?.username || 'Account';
  const waiting = changedSinceSync();

  // "Sync now": send changes to the account and bring new ones back
  async function syncNow() {
    setOpen(false);
    setBusy('Syncing…');
    const problem = await syncQuietly();
    setBusy(null);
    if (problem) showMessage('Couldn\'t sync', problem);
  }

  // "Log out": asks first, and says whether anything is still unsynced.
  // Then it sends the last changes, logs out of this device and goes
  // Home. The binders and lists stay on this device.
  async function logOut() {
    setOpen(false);
    const note = waiting
      ? 'Some changes haven\'t synced yet. They will be sent first if the internet is working.'
      : 'Everything is synced.';
    const ok = await askYesNo(
      'Log out of WUBRG\'r?',
      `You will be logged out on this device. Your binders stay safe in your account and come back when you log in again.\n\n${note}${signedIn ? '\nGoogle Drive backup is on.' : ''}`,
      'Log out',
    );
    if (!ok) return;
    setBusy('Logging out…');
    try {
      await syncQuietly();
      await serverSignOut();
      setBusy(null);
      router.navigate({ pathname: '/', params: { message: 'You\'re logged out. Your binders and lists are still on this device.' } });
    } catch (err) {
      setBusy(null);
      showMessage('Couldn\'t log out', (err as Error).message);
    }
  }

  return (
    <View style={[styles.popup, { bottom, backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
          <Text style={[styles.popupEmail, { color: colors.muted, borderBottomColor: colors.border }]} numberOfLines={1}>
            {serverUser?.email ?? name}
          </Text>
          <View style={[styles.statusBox, { backgroundColor: colors.bg }]}>
            <StatusRow label="Sync" value={waiting ? 'Changes waiting' : 'Up to date'} good={!waiting} />
            <StatusRow label="Google Drive backup" value={signedIn ? 'On' : 'Off'} good={signedIn} />
          </View>
          <PopupItem label="Account settings" onPress={() => { setOpen(false); router.navigate('/settings'); }} />
          <PopupItem label="Sync now" onPress={syncNow} />
          <PopupItem label="Log out" danger onPress={logOut} />
        </View>
  );
}

// One line in the account menu's status box: a label and its value
function StatusRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.statusRow}>
      <Text style={[styles.statusLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.statusValue, { color: good ? colors.success : colors.accent }]}>{value}</Text>
    </View>
  );
}

// One button in the account menu ("Log out" is drawn in the error color)
function PopupItem({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="menuitem" onPress={onPress}
               style={({ pressed }) => [styles.popupItem, pressed && { backgroundColor: colors.surfaceHover }]}>
      <Text style={[styles.popupItemText, { color: danger ? colors.error : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

// The look of everything above
const styles = StyleSheet.create({
  // The whole menu: a column down the left, with a line along its right edge
  menu: { borderRightWidth: 1, zIndex: 10, gap: 2 },
  grow: { flex: 1 },
  // The scrolling area: takes the room above the account block; its lines
  // are spaced like the menu's (minHeight 0 lets it shrink and scroll)
  scroller: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1, gap: 2 },
  centered: { justifyContent: 'center' },
  // The app's name at the top
  logo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: SPACE.s, paddingBottom: SPACE.m, paddingTop: SPACE.xs },
  logoSlim: { flexDirection: 'column', gap: SPACE.s, paddingHorizontal: 0, paddingBottom: SPACE.m },
  // The small round collapse / expand button by the name
  collapseButton: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  collapseButtonSlim: { alignSelf: 'center' },
  // One menu line
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: 10, paddingHorizontal: SPACE.m, borderRadius: RADIUS, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  itemSub: { paddingVertical: 7 },
  itemText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  itemTextSub: { fontSize: 14 },
  picture: { width: 20, height: 20 },
  // The "Shelf" heading, and the lines under it (with a thin line down their left in the full menu)
  groupHeading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingHorizontal: SPACE.m, paddingTop: 10, paddingBottom: 4 },
  groupText: { fontSize: 15, fontWeight: '700' },
  subItems: { marginLeft: 22, paddingLeft: SPACE.s, borderLeftWidth: 1, borderLeftColor: 'transparent', marginBottom: 2 },
  subItemsSlim: { marginLeft: 0, paddingLeft: 0 },
  // The account block
  account: { borderTopWidth: 1, marginTop: SPACE.s, paddingTop: SPACE.s },
  me: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, padding: SPACE.s, borderRadius: RADIUS },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 16, fontWeight: '800' },
  meText: { flex: 1, minWidth: 0 },
  meName: { fontSize: 14, fontWeight: '700' },
  meStatus: { fontSize: 12 },
  // Logged out
  loginBox: { gap: SPACE.s, padding: SPACE.xs },
  loginNote: { fontSize: 12.5, lineHeight: 17, paddingHorizontal: SPACE.xs },
  loginButton: { alignItems: 'center', paddingVertical: 10, borderRadius: RADIUS },
  loginButtonText: { fontSize: 14, fontWeight: '700' },
  // The little menu that opens above the account block (it can be wider than a slim menu)
  popup: { position: 'absolute', left: 0, width: 224, borderWidth: 1, borderRadius: RADIUS + 2, padding: SPACE.xs, zIndex: 20 },
  popupEmail: { fontSize: 12, paddingHorizontal: SPACE.m, paddingTop: SPACE.s, paddingBottom: SPACE.m, borderBottomWidth: 1, marginBottom: SPACE.xs },
  statusBox: { marginHorizontal: SPACE.xs, marginBottom: SPACE.xs, padding: SPACE.m, borderRadius: RADIUS - 2, gap: 6 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.s },
  statusLabel: { fontSize: 12.5 },
  statusValue: { fontSize: 12.5, fontWeight: '700' },
  popupItem: { paddingVertical: 9, paddingHorizontal: SPACE.m, borderRadius: RADIUS - 2 },
  popupItemText: { fontSize: 14 },
});
