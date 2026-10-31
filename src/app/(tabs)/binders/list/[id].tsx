/* =====================================================================
   ONE LIST (/binders/list/<id>)
   A list's cards, one row each, in the order they were added. Each row
   has a small picture of the card, and beside it:
     - the card's name (bold, on top)
     - its casting cost, as Magic's symbols
     - its type line (like "Creature — Elf Druid")
   Above the cards:
     - a search box that narrows the rows to the cards whose name or type
       matches what's typed
     - "Add card": opens the Card Finder; its "+" then puts the card
       shown into this list and comes back here
   Touching a card: tap it to open it in the Card Finder; press and HOLD
   it for its window: a big picture of it, "Move to a binder" (pick a
   binder from the list that pops up: the card goes into that binder's
   first empty pocket and leaves the list) and "Delete from list" (it
   asks first).
   THE HEADER, like a binder's: the list's name with a check mark beside
   it (green when everything is saved, red while it isn't: tap it to see
   which), then the download button (the list as a .csv file) and Help.
   Saving works like a binder's: every change is kept on this device
   straight away, then saved to Google Drive a moment later (when signed
   in). Rename the list on the Lists page.
   ===================================================================== */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import TextField from '@/components/TextField';
import Button from '@/components/Button';
import PopupWindow from '@/components/PopupWindow';
import HelpButton from '@/components/HelpButton';
import ManaCost from '@/components/lists/ManaCost';
import MoveCardDialog from '@/components/binder/MoveCardDialog';
import { findList, removeCardFromList, type CardList, type ListCard } from '@/lib/listStorage';
import { DriveError, isSignedIn, signInWithGoogle, syncList } from '@/lib/googleDrive';
import { cardCountText, isLocalMode } from '@/lib/binderStorage';
import { downloadListCsv } from '@/lib/binderDownload';
import { CARD_BACK } from '@/lib/cards';
import { RequestError, pictureSource } from '@/lib/http';
import { askYesNo, showMessage } from '@/lib/dialogs';
import { hapticTap } from '@/lib/haptics';
import { RADIUS } from '@/theme/colors';

// The card pictures in the rows: this wide (points), and as tall as a
// card that wide (a card is 63 by 88 millimeters)
const PICTURE_WIDTH = 60;
const PICTURE_HEIGHT = Math.round(PICTURE_WIDTH * 88 / 63);

// The page is never wider than this (points), centered on big screens
const PAGE_MAX_WIDTH = 760;

// Saving to Drive: wait this long after a change (so quick changes go
// together in one save), and this long before trying a failed save again
const DRIVE_SAVE_DELAY_MS = 1200;
const DRIVE_RETRY_MS = 30000;

// The Card Finder's address for a card in this list: that exact
// printing (side, language, foil), and which list it came from (so the
// Card Finder's back arrow and "+" lead back here)
function finderLinkFor(listId: string, card?: ListCard): string {
  const params = new URLSearchParams();
  if (card) {
    params.set('set', card.set);
    params.set('number', card.number);
    if (card.face === 1) params.set('face', 'back');
    if (card.lang) params.set('lang', card.lang);
    if (card.foil) params.set('foil', '1');
  }
  params.set('list', listId);
  return `/search?${params}`;
}

export default function ListScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const { announce } = useAnnouncer();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  // The list (this device's copy), and what's typed in the search box
  const [list, setList] = useState<CardList | undefined>(() => findList(id));
  const [filter, setFilter] = useState('');
  // The held card's window (its spot in the list), and the card being
  // moved to a binder (the pop-up list of binders)
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [movingIndex, setMovingIndex] = useState<number | null>(null);

  /* ----- Saving (the same as a binder: see binders/[id].tsx) ----- */

  // The save state: 'saved', 'saving', 'error' or 'signed-out', with
  // what to say when the check mark is tapped
  const [status, setStatus] = useState<{ state: string; text: string }>({ state: '', text: '' });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Bring this list up to date with Google Drive now (or, used on this
  // device only, it's already saved)
  async function sync() {
    clearTimeout(saveTimer.current);
    if (isLocalMode()) { setStatus({ state: 'saved', text: 'Saved on this device.' }); return; }
    if (!isSignedIn()) { setStatus({ state: 'signed-out', text: 'Not saved to Google Drive yet.' }); return; }
    setStatus({ state: 'saving', text: 'Saving…' });
    try {
      await syncList(id);
      setList(findList(id));
      setStatus({ state: 'saved', text: 'Saved to Google Drive.' });
    } catch (err) {
      if (err instanceof DriveError && err.signedOut) {
        setStatus({ state: 'signed-out', text: 'Not saved to Google Drive yet.' });
        return;
      }
      // No internet, or a Drive problem: the change is safe on this
      // device, so say so, and try again in a while
      setStatus({ state: 'error', text: err instanceof RequestError && err.offline
        ? 'Offline: changes are kept on this device.'
        : 'Couldn\'t save to Google Drive yet: will try again.' });
      saveTimer.current = setTimeout(() => syncRef.current(), DRIVE_RETRY_MS);
    }
  }
  // The newest sync, for timers set earlier
  const syncRef = useRef(sync);
  syncRef.current = sync;

  // After a change: show it, then save to Drive in a moment
  function changed() {
    setList(findList(id));
    if (isLocalMode()) { sync(); return; }
    setStatus({ state: 'saving', text: 'Saving…' });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => syncRef.current(), DRIVE_SAVE_DELAY_MS);
  }

  // Every time this page comes into view (a card may just have been
  // added in the Card Finder): read the list, and bring it up to date
  useFocusEffect(useCallback(() => {
    setList(findList(id));
    syncRef.current();
  }, [id]));
  // Stop a waiting save when the page closes
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // Tapping the check mark says what it means: saved (and where), or why
  // not. Signed out of Google: offer to connect again.
  async function explainStatus() {
    if (status.state === 'signed-out') {
      const yes = await askYesNo('Not saved to Google Drive yet',
        'Your Google sign-in has run out. Your changes are kept on this device until you connect again.',
        'Connect Drive', 'Not now');
      if (!yes) return;
      try {
        await signInWithGoogle();
        sync();
      } catch (err) {
        showMessage('Couldn\'t connect to Google Drive', (err as Error).message);
      }
      return;
    }
    if (status.state === 'saved') showMessage('Saved', status.text);
    else showMessage('Not saved yet', status.text || 'Saving…');
  }

  /* ----- The header: the name and its check mark, download, Help ----- */

  const saved = status.state === 'saved';
  useLayoutEffect(() => {
    navigation.setOptions({
      title: list?.name ?? 'List',
      // The name, then the check mark (green: saved; red: not yet)
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{list?.name ?? 'List'}</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={explainStatus}
                     accessibilityLabel={saved ? 'Saved' : `Not saved yet. ${status.text}`}
                     style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons name="checkmark-circle" size={20} color={saved ? colors.success : colors.error} />
          </Pressable>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerButtons}>
          {/* Save (or share) the list as a .csv file */}
          <Pressable accessibilityRole="button" accessibilityLabel={`Download ${list?.name ?? 'the list'} as a .CSV file`} hitSlop={6}
                     onPress={() => downloadListCsv(id).catch((err) => showMessage('Couldn\'t save the file', (err as Error).message))}
                     style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons name="download-outline" size={24} color={colors.text} />
          </Pressable>
          <HelpButton topic="my-binders-lists" />
        </View>
      ),
    });
  }, [navigation, list?.name, colors, saved, status.text, status.state]);

  // A list that doesn't exist (deleted, or a broken link): back to the lists
  if (!list) return <Redirect href={'/binders/lists' as never} />;

  // The cards to show: all of them, or those whose name or type contains
  // what's typed (capitals don't matter). "index" is each card's spot
  // in the whole list.
  const wanted = filter.trim().toLowerCase();
  const rows = list.cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => !wanted || card.name.toLowerCase().includes(wanted) || card.typeLine.toLowerCase().includes(wanted));

  /* ----- The held card's window ----- */

  const menuCard = menuIndex !== null ? list.cards[menuIndex] : undefined;
  const movingCard = movingIndex !== null ? list.cards[movingIndex] : undefined;

  // "Delete from list": ask, then take the card out
  async function confirmDelete(index: number) {
    const card = list!.cards[index];
    setMenuIndex(null);
    const yes = await askYesNo(`Delete ${card.name}?`, `Take it out of ${list!.name}.`, 'Yes, delete', 'No');
    if (!yes) return;
    removeCardFromList(id, index);
    changed();
  }

  // "Move to a binder": close this window, then open the list of binders.
  // (iPhones can't open one pop-up while another is still fading away,
  // so there it waits a moment.)
  function moveToBinder(index: number) {
    setMenuIndex(null);
    setTimeout(() => setMovingIndex(index), Platform.OS === 'ios' ? 350 : 0);
  }

  // The card is safely in the binder: take it out of the list
  function movedToBinder(note: string) {
    if (movingIndex !== null) removeCardFromList(id, movingIndex);
    setMovingIndex(null);
    announce(note.replace('✓ ', ''));
    changed();
  }

  return (
    // The keyboard pushes everything up instead of covering the search box
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={rows}
        keyExtractor={({ card, index }) => `${index}-${card.set}-${card.number}`}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        // At the top: the search box and Add card
        ListHeaderComponent={
          <View style={styles.header}>
            <TextField
              accessibilityLabel="Search this list"
              placeholder="Search this list…"
              value={filter}
              onChangeText={setFilter}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Button label="Add card" icon="add" onPress={() => router.push(finderLinkFor(id) as never)} />
          </View>
        }
        // No cards (or none matching the search): say so, not a blank page
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {list.cards.length ? 'No cards match' : 'No cards yet'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {list.cards.length ? `None of the ${cardCountText(list.cards.length)} match "${filter.trim()}".` : 'Tap Add card above to find one.'}
            </Text>
          </View>
        }
        renderItem={({ item: { card, index } }) => (
          // One card: tap to open it in the Card Finder, hold for its window
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${card.name}, ${card.typeLine}`}
            accessibilityHint="Opens the card in the Card Finder. Hold to move it to a binder or delete it."
            onPress={() => router.push(finderLinkFor(id, card) as never)}
            onLongPress={() => { hapticTap(); setMenuIndex(index); }}
            delayLongPress={500}
            style={({ pressed }) => [styles.row, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfaceHover }]}
          >
            {/* The card's picture, shrunk */}
            <Image source={pictureSource(card.image)} placeholder={pictureSource(CARD_BACK)}
                   style={styles.picture} contentFit="cover" recyclingKey={card.image} />
            {/* Its name, casting cost and type line */}
            <View style={styles.words}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{card.name}</Text>
              <ManaCost cost={card.manaCost} />
              <Text style={[styles.type, { color: colors.muted }]} numberOfLines={2}>{card.typeLine}</Text>
            </View>
          </Pressable>
        )}
      />

      {/* THE HELD CARD'S WINDOW: its picture, then Move to a binder and
          Delete from list */}
      {menuCard && menuIndex !== null && (
        <PopupWindow title={menuCard.name} onClose={() => setMenuIndex(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuIndex(null), kind: 'secondary' }]}>
          <Image source={pictureSource(menuCard.image)} style={styles.menuPicture} contentFit="contain" />
          <View style={styles.menu}>
            <Button label="Move to a binder" icon="albums-outline" kind="secondary" onPress={() => moveToBinder(menuIndex)} />
            <Button label="Delete from list" icon="trash-outline" kind="danger" onPress={() => confirmDelete(menuIndex)} />
          </View>
        </PopupWindow>
      )}

      {/* "Move to a binder": the pop-up list of binders (the same one a
          binder's cards use, with every binder in it). The list's own
          extra details (cost and type) aren't part of a binder card. */}
      {movingCard && (
        <MoveCardDialog
          binderId=""
          card={(({ manaCost: _cost, typeLine: _type, ...binderCard }) => binderCard)(movingCard)}
          onMoved={(note) => movedToBinder(note)}
          onCancel={() => setMovingIndex(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// The page's look: the rows sit in a column, each with a thin line under
// it, the picture on the left and the words beside it
const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: 16, width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center', flexGrow: 1 },
  header: { gap: 10, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  picture: { width: PICTURE_WIDTH, height: PICTURE_HEIGHT, borderRadius: 4 },
  words: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '700' },
  type: { fontSize: 14 },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS * 1.4, marginTop: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center' },
  // The header: the name and its check mark side by side, and the buttons
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  headerName: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { paddingHorizontal: 8 },
  pressed: { opacity: 0.5 },
  // The held card's window: a big picture, then the two buttons
  menuPicture: { width: '100%', height: 260 },
  menu: { gap: 8 },
});
