/* =====================================================================
   ONE LIST (/binders/list/<id>)
   A list's cards, shown the way an opened binder shows its cards: as a
   LIST (picture, name, set and number, "− 3 +" copies bar, price) or a GRID
   of card pictures (zoomable on the website), with the same sort menu,
   rainbow border on foils, prices and total, and red "+" as a binder (see
   components/binder/CardList.tsx, ViewSwitch.tsx and AddCardsButton.tsx).
   A card list has no pockets, so it has no Binder view. The view chosen is
   remembered separately for a phone-sized window and a wide one, and the
   sort is the binders' (see lib/binderView.ts).
   Above the cards: a search box that narrows them to the cards whose name
   or type line matches what's typed.
   Touching a card: tap it for its window: a big picture, how many
   copies (− and +), "Open in Card Finder", "Move to a binder" (pick a
   binder from the list that pops up: the card goes into that binder's
   first empty pocket and leaves the list) and "Delete from list" (it
   asks first). The red "+" opens the Card Finder; its "+" there puts the
   card shown into this list and comes back here.
   (The screen as it was before this look, with each card's casting cost
   and type line in its row, is described in the project's notes: it was
   reworked on 2026-11-12.)
   THE HEADER, like a binder's: the list's name with a check mark beside
   it (green when everything is saved, red while it isn't: tap it to see
   which), then the download button (the list as a .csv file) and Help.
   Saving works like a binder's: every change is kept on this device
   straight away, then saved to Google Drive a moment later (when signed
   in). Rename the list on the Lists page.
   ===================================================================== */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import TextField from '@/components/TextField';
import Button from '@/components/Button';
import PopupWindow from '@/components/PopupWindow';
import HelpButton from '@/components/HelpButton';
import MoveCardDialog from '@/components/binder/MoveCardDialog';
import CardList2, { type CardEntry } from '@/components/binder/CardList';
import ViewSwitch, { ToolButton } from '@/components/binder/ViewSwitch';
import AddCardsButton from '@/components/binder/AddCardsButton';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import { useBinderPrices } from '@/hooks/useBinderPrices';
import { useContentWidth } from '@/hooks/useMenuStyle';
import { GRID_ZOOM_WIDTHS, binderGridZoom, binderSort, binderSortReversed, listViewMode, onBinderViewChange, onGridZoomChange, setListViewMode } from '@/lib/binderView';
import { sortEntries } from '@/lib/binderSort';
import { isSearching, makeNameFilter } from '@/lib/nameFilter';
import { finishParam } from '@/lib/cardDetails';
import { fillListDetails, findList, removeCardFromList, setListCardCount, type CardList, type ListCard } from '@/lib/listStorage';
import { DriveError, isSignedIn, signInWithGoogle, syncList } from '@/lib/googleDrive';
import { MAX_COPIES, cardCount, cardCountText, isLocalMode } from '@/lib/binderStorage';
import { downloadListCsv } from '@/lib/binderDownload';
import { RequestError, pictureSource } from '@/lib/http';
import { askYesNo, showMessage } from '@/lib/dialogs';
import { RADIUS } from '@/theme/colors';

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
    const finish = finishParam(card);
    if (finish) params.set('foil', finish);
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
          {/* The Binders / Lists / Decks switch (phones: a wide screen's side menu has them) */}
          <ShelfSwitch current="lists" />
          <HelpButton topic="my-binders-lists" />
        </View>
      ),
    });
  }, [navigation, list?.name, colors, saved, status.text, status.state]);

  /* ----- The cards as the list and grid show them ----- */

  // How the cards are shown (a list or a grid), the sort, and the grid's zoom
  const mode = useSyncExternalStore(onBinderViewChange, listViewMode, listViewMode);
  const sort = useSyncExternalStore(onBinderViewChange, binderSort, binderSort);
  const reversed = useSyncExternalStore(onBinderViewChange, binderSortReversed, binderSortReversed);
  const gridZoom = useSyncExternalStore(onGridZoomChange, binderGridZoom, binderGridZoom);
  const contentWidth = useContentWidth();

  // Every card, each with its "key": its spot in the whole list (0 is the
  // first), as text
  const allEntries = useMemo<CardEntry[]>(
    () => (list?.cards ?? []).map((card, index) => ({ key: String(index), card })),
    [list],
  );
  // The cards to show: all of them, or, as you type, those whose name
  // matches (a forgiving search, so small typos and spacing don't matter) or
  // whose type line contains what's typed
  const searching = isSearching(filter);
  const nameFilter = useMemo(() => makeNameFilter(allEntries, (entry) => entry.card.name), [allEntries]);
  const baseEntries = useMemo<CardEntry[]>(() => {
    if (!searching) return allEntries;
    const byName = new Set(nameFilter(filter).map((entry) => entry.key));
    const typed = filter.trim().toLowerCase();
    return allEntries.filter((entry) => byName.has(entry.key) || (entry.card as ListCard).typeLine.toLowerCase().includes(typed));
  }, [searching, nameFilter, filter, allEntries]);
  // What the cards are worth, and their details from Scryfall (for sorting
  // by something a card doesn't have saved yet). Looked up for the whole
  // list, so typing in the search box doesn't start a new lookup each time.
  const prices = useBinderPrices(allEntries);
  const entries = useMemo<CardEntry[]>(
    () => sortEntries(baseEntries, sort, reversed, { printings: prices.printings, prices: prices.byKey }),
    [baseEntries, sort, reversed, prices.printings, prices.byKey],
  );
  // Once the lookup arrives, save the missing details with the cards (once:
  // after that they have them, so there's nothing left to fill in)
  useEffect(() => {
    if (prices.printings && fillListDetails(id, prices.printings)) changed();
  }, [prices.printings, list]);

  /* ----- The card's window ----- */

  const menuCard = menuIndex !== null ? list?.cards[menuIndex] : undefined;
  const movingCard = movingIndex !== null ? list?.cards[movingIndex] : undefined;

  // "Delete from list": ask, then take the card out
  async function confirmDelete(index: number) {
    const card = list!.cards[index];
    setMenuIndex(null);
    const yes = await askYesNo(`Delete ${card.name}?`, `Take it out of ${list!.name}.`, 'Yes, delete', 'No');
    if (!yes) return;
    removeCardFromList(id, index);
    changed();
  }

  // One more or one fewer copy of the card at this spot. "−" on the last
  // copy is a delete (it asks first).
  function changeCopies(index: number, step: number) {
    const card = list?.cards[index];
    if (!card) return;
    const count = cardCount(card);
    if (step < 0 && count === 1) { confirmDelete(index); return; }
    const now = Math.min(MAX_COPIES, count + step);
    if (now === count) return;
    setListCardCount(id, index, now);
    changed();
    announce(`${now} ${now === 1 ? 'copy' : 'copies'} of ${card.name}.`);
  }
  // A version that never changes between redraws, for the rows
  const copiesRef = useRef(changeCopies);
  copiesRef.current = changeCopies;
  const onCopies = useCallback((key: string, step: number) => copiesRef.current(Number(key), step), []);

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

  // A list that doesn't exist (deleted, or a broken link): back to the lists
  if (!list) return <Redirect href={'/binders/lists' as never} />;

  return (
    // The keyboard pushes everything up instead of covering the search box
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      {/* The search box, and the List / Grid switch with the sort */}
      <View style={styles.top}>
        <TextField
          accessibilityLabel="Search this list"
          placeholder="Search this list…"
          value={filter}
          onChangeText={setFilter}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <ViewSwitch
          mode={mode} sort={sort} reversed={reversed} modes={['list', 'grid']} onView={setListViewMode}
          extras={(
            // Save (or share) the list as a .csv file
            <ToolButton icon="download-outline" label={`Download ${list.name} as a .CSV file`}
                        onPress={() => downloadListCsv(id).catch((err) => showMessage('Couldn\'t save the file', (err as Error).message))} />
          )}
        />
      </View>

      {/* THE CARDS, with the red "+" floating over them in the corner */}
      <View style={styles.listArea}>
        <CardList2
          entries={entries}
          mode={mode}
          width={contentWidth}
          onPick={(key) => setMenuIndex(Number(key))}
          onCopies={onCopies}
          minTile={GRID_ZOOM_WIDTHS[gridZoom]}
          prices={prices}
          searchOf={searching ? allEntries.length : undefined}
          // No cards (or none matching the search): say so, not a blank page
          empty={(
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {list.cards.length ? 'No cards match' : 'No cards yet'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {list.cards.length ? `None of the ${cardCountText(list.cards.length)} match "${filter.trim()}".` : 'Tap the red + to find one.'}
              </Text>
            </View>
          )}
        />
        <AddCardsButton onPress={() => router.push(finderLinkFor(id) as never)} />
      </View>

      {/* THE CARD'S WINDOW: its picture, how many copies, then Open in Card
          Finder, Move to a binder and Delete from list */}
      {menuCard && menuIndex !== null && (
        <PopupWindow title={menuCard.name} onClose={() => setMenuIndex(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuIndex(null), kind: 'secondary' }]}>
          <Image source={pictureSource(menuCard.image)} style={styles.menuPicture} contentFit="contain" />
          {/* How many copies: − and + */}
          <View style={styles.menuCopies}>
            <Button label="−" kind="secondary" accessibilityLabel={cardCount(menuCard) > 1 ? 'One fewer copy' : 'Delete from list'}
                    onPress={() => changeCopies(menuIndex, -1)} />
            <Text style={[styles.menuCount, { color: colors.text }]}>
              {cardCount(menuCard)} {cardCount(menuCard) === 1 ? 'copy' : 'copies'}
            </Text>
            <Button label="+" kind="secondary" accessibilityLabel="One more copy" disabled={cardCount(menuCard) >= MAX_COPIES}
                    onPress={() => changeCopies(menuIndex, 1)} />
          </View>
          <View style={styles.menu}>
            <Button label="Open in Card Finder" icon="search" kind="secondary"
                    onPress={() => { const card = menuCard; setMenuIndex(null); router.push(finderLinkFor(id, card) as never); }} />
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

// The page's look: the search box and switch at the top, the cards filling
// the rest
const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 8, zIndex: 10 },
  listArea: { flex: 1 },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS * 1.4, marginTop: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center' },
  // The header: the name and its check mark side by side, and the buttons
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  headerName: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { paddingHorizontal: 5 },
  pressed: { opacity: 0.5 },
  // The card's window: a big picture, the copies, then the buttons
  menuPicture: { width: '100%', height: 260 },
  menuCopies: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  menuCount: { fontSize: 17, fontWeight: '700' },
  menu: { gap: 8 },
});
