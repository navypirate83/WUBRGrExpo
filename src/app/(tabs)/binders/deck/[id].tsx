/* =====================================================================
   ONE DECK (/binders/deck/<id>)
   An opened deck, with the basics of a list (see list/[id].tsx): its
   cards as a LIST or a GRID of card pictures (the buttons under the search
   bar, remembered the same way as a list's), the same sort menu, header
   bars between groups, foil borders, prices and the line of totals, the
   grid's zoom, and a download button (the deck as a .CSV file).
   From top to bottom: the search bar (see components/decks/DeckSearchBar.tsx)
   with its Search / Add switch, the List / Grid switch with the sort and
   download button, then the cards.
   - SEARCH (the switch's first position): the bar narrows the deck's own
     cards as you type, by name or type, like a list's search box.
   - ADD: type a card's name and tap the "+" on the card you want; the first
     printing that comes up is added. The drop-down closes when you tap
     anywhere else (the invisible cover below does that), and the switch
     under the bar limits the search to cards in your binders.
   - DRAGGING (computers): a card picture dragged in from Scryfall or EDHREC
     and dropped anywhere over the cards is added too, like in a list.
   Tapping a card opens its window, the same one the binders' and lists'
   cards have: a big picture (tap it to open the card in the Card Finder),
   what it does, how many copies (− and +), Move to a binder (the card
   leaves the deck and goes into the binder's first empty pocket) and
   Delete from deck (it asks first). The "− 3 +" bar on a card works as
   in a list: − on the last copy asks about deleting the card.
   Too many copies: adding a card the deck already has as many of as its
   format allows (1 in Commander-style formats, 4 in the others) shows a
   window about it, with "Add anyway" because some cards break the limit.
   Basic lands, snow-covered basic lands and Wastes never ask.
   More deck features (the commander slot, the sideboard, picking a
   different printing and the format's other rules) come later. Decks are
   kept on this device only for now (see lib/deckStorage.ts).
   ===================================================================== */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useColors } from '@/hooks/useTheme';
import { useAccount } from '@/hooks/useAccount';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import { useBinderPrices } from '@/hooks/useBinderPrices';
import { useContentWidth } from '@/hooks/useMenuStyle';
import HelpButton from '@/components/HelpButton';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import DeckSearchBar, { type DeckSearchMode } from '@/components/decks/DeckSearchBar';
import CardList, { type CardEntry } from '@/components/binder/CardList';
import ViewSwitch, { ToolButton } from '@/components/binder/ViewSwitch';
import CardRules from '@/components/binder/CardRules';
import MoveCardDialog from '@/components/binder/MoveCardDialog';
import PopupWindow from '@/components/PopupWindow';
import Button from '@/components/Button';
import { addCardToDeck, copiesOf, fillDeckDetails, findDeck, setDeckCardCount, type Deck, type DeckCard } from '@/lib/deckStorage';
import { deckFormat, skipsCopyWarning } from '@/lib/deckFormats';
import { GRID_ZOOM_WIDTHS, binderGridZoom, binderSort, binderSortReversed, listViewMode, onBinderViewChange, onGridZoomChange, setListViewMode, sortHeadersOn } from '@/lib/binderView';
import { headerFor, sortEntries } from '@/lib/binderSort';
import { CARD_BACK, costAndType, imageFor, isDoubleSided } from '@/lib/cards';
import { useCardAreaDrop } from '@/hooks/useCardAreaDrop';
import { binderCardFrom, lookupFromDrop } from '@/lib/cardDrop';
import { isSearching, makeNameFilter } from '@/lib/nameFilter';
import { detailsOf, costAndTypeOf, finishParam } from '@/lib/cardDetails';
import { cardCount, loadBinder, loadBinderList, MAX_COPIES, samePrinting } from '@/lib/binderStorage';
import { cardByNamePath, loadOneCard } from '@/lib/scryfall';
import { downloadDeckCsv } from '@/lib/binderDownload';
import { askYesNo, showMessage } from '@/lib/dialogs';

// The Card Finder's address for a card in this deck: that exact printing
// (side, language, foil), and which deck card it is (the deck and its spot),
// so the Card Finder's "+" can change that card to the printing picked
function finderLinkFor(deckId: string, index: number, card: DeckCard): string {
  const params = new URLSearchParams();
  params.set('set', card.set);
  params.set('number', card.number);
  if (card.face === 1) params.set('face', 'back');
  if (card.lang) params.set('lang', card.lang);
  const finish = finishParam(card);
  if (finish) params.set('foil', finish);
  params.set('deck', deckId);
  params.set('at', String(index));
  return `/search?${params}`;
}

export default function DeckScreen() {
  const colors = useColors();
  const { announce } = useAnnouncer();
  const navigation = useNavigation();
  const { usingBinders } = useAccount();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  // The deck (this device's copy), and the note under the search bar
  const [deck, setDeck] = useState<Deck | undefined>(() => findDeck(id));
  const [note, setNote] = useState('');
  // The search bar: Search (narrow this deck's cards) or Add, what's typed to
  // narrow them, and whether the Add drop-down is showing
  const [searchMode, setSearchMode] = useState<DeckSearchMode>('search');
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  // A card is being looked up: don't start a second add until it's done
  const busy = useRef(false);
  // The held card's window (its spot in the deck), and the card being moved
  // to a binder (the pop-up list of binders)
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [movingIndex, setMovingIndex] = useState<number | null>(null);

  /* ----- The cards as the list and grid show them (the same as a list) ----- */

  // How the cards are shown (a list or a grid), the sort, and the grid's zoom
  const mode = useSyncExternalStore(onBinderViewChange, listViewMode, listViewMode);
  const sort = useSyncExternalStore(onBinderViewChange, binderSort, binderSort);
  const reversed = useSyncExternalStore(onBinderViewChange, binderSortReversed, binderSortReversed);
  const gridZoom = useSyncExternalStore(onGridZoomChange, binderGridZoom, binderGridZoom);
  const headersOn = useSyncExternalStore(onBinderViewChange, sortHeadersOn, sortHeadersOn);
  const contentWidth = useContentWidth();

  // Every card, each with its "key": its spot in the deck (0 is the first), as text
  const allEntries = useMemo<CardEntry[]>(
    () => (deck?.cards ?? []).map((card, index) => ({ key: String(index), card })),
    [deck],
  );
  // The cards to show: all of them, or, in Search as you type, those whose
  // name matches (a forgiving search, so small typos and spacing don't
  // matter) or whose type line contains what's typed
  const searching = searchMode === 'search' && isSearching(filter);
  const nameFilter = useMemo(() => makeNameFilter(allEntries, (entry) => entry.card.name), [allEntries]);
  const baseEntries = useMemo<CardEntry[]>(() => {
    if (!searching) return allEntries;
    const byName = new Set(nameFilter(filter).map((entry) => entry.key));
    const typed = filter.trim().toLowerCase();
    return allEntries.filter((entry) => byName.has(entry.key) || ((entry.card as DeckCard).typeLine ?? '').toLowerCase().includes(typed));
  }, [searching, nameFilter, filter, allEntries]);
  // What the cards are worth, and their details from Scryfall (for sorting).
  // Looked up for the whole deck, so typing in the search box doesn't start
  // a new lookup each time.
  const prices = useBinderPrices(allEntries);
  const entries = useMemo<CardEntry[]>(
    () => sortEntries(baseEntries, sort, reversed, { printings: prices.printings, prices: prices.byKey }),
    [baseEntries, sort, reversed, prices.printings, prices.byKey],
  );
  // Which group each card falls under for the sort in use, so the list can
  // put a header bar between the groups (none if turned off in Settings)
  const headerOf = useCallback(
    (entry: CardEntry) => (headersOn ? headerFor(entry, sort, { printings: prices.printings }) : null),
    [headersOn, sort, prices.printings],
  );
  // Once the lookup arrives, save the missing details with the cards (once:
  // after that they have them, so there's nothing left to fill in)
  useEffect(() => {
    if (prices.printings && fillDeckDetails(id, prices.printings)) setDeck(findDeck(id));
  }, [prices.printings, deck]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Every time this page comes into view: read the deck again
  useFocusEffect(useCallback(() => { setDeck(findDeck(id)); }, [id]));

  // The header: the deck's name, then the Binders / Lists / Decks switch and Help
  useLayoutEffect(() => {
    navigation.setOptions({
      title: deck?.name ?? 'Deck',
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ShelfSwitch current="decks" />
          <HelpButton topic="my-binders-decks" />
        </View>
      ),
    });
  }, [navigation, deck?.name]);

  // The card to add, as the deck saves it. With "only my binders" on, it's
  // the printing you own (the first one found in your binders); otherwise
  // the first printing Scryfall gives for the name.
  async function cardToAdd(name: string, ownedOnly: boolean): Promise<DeckCard> {
    if (ownedOnly) {
      for (const binder of loadBinderList()) {
        const owned = Object.values(loadBinder(binder.id)).find((card) => card.name === name);
        if (owned) {
          const { count: _count, ...rest } = owned;
          return { ...rest, added: new Date().toISOString(), ...costAndTypeOf(owned) };
        }
      }
    }
    const print = await loadOneCard(cardByNamePath(name, true));
    return {
      name: print.name,
      set: print.set,
      number: print.collector_number,
      face: 0,
      image: imageFor(print, 0, ['normal', 'large']) ?? CARD_BACK,
      added: new Date().toISOString(),
      extra: detailsOf(print),
      ...costAndType(print, 0),
    };
  }

  // Warn if the deck has as many copies of this card as its format allows
  // (unless it's a basic land, a snow-covered basic or Wastes). True to go
  // ahead and add it.
  async function okToAdd(name: string): Promise<boolean> {
    const format = deckFormat(deck!.format);
    const have = copiesOf(findDeck(id), name);
    if (have < format.copyLimit || skipsCopyWarning(name)) return true;
    const why = format.copyLimit === 1
      ? `${format.name} decks are singleton: one copy of each card. (A few cards allow more.)`
      : `${format.name} decks allow up to ${format.copyLimit} copies of a card. (A few cards allow more.)`;
    return askYesNo(`${name} is already in this deck`, `The deck has ${have} ${have === 1 ? 'copy' : 'copies'}. ${why}`, 'Add anyway', 'Cancel');
  }

  // A "+" in the search: warn if the deck has as many as its format allows,
  // then add one copy
  async function add(name: string, ownedOnly: boolean) {
    if (!deck || busy.current) return;
    busy.current = true;
    try {
      if (!(await okToAdd(name))) return;
      const card = await cardToAdd(name, ownedOnly);
      addCardToDeck(id, card);
      setDeck(findDeck(id));
      setNote(`Added ${card.name}.`);
    } catch (err) {
      showMessage('Couldn\'t add the card', (err as Error).message);
    } finally {
      busy.current = false;
    }
  }

  // One more or one fewer copy of the card at this spot, the same as in a
  // list. "−" on the last copy is a delete (it asks first).
  function changeCopies(index: number, step: number) {
    const card = deck?.cards[index];
    if (!card) return;
    const count = cardCount(card);
    if (step < 0 && count === 1) { confirmDelete(index); return; }
    const now = Math.min(MAX_COPIES, count + step);
    if (now === count) return;
    setDeckCardCount(id, index, now);
    setDeck(findDeck(id));
    announce(`${now} ${now === 1 ? 'copy' : 'copies'} of ${card.name}.`);
  }

  /* ----- Dropping a picture from another website (computers) ----- */

  // Let go anywhere over the cards and the card is added: one more copy if
  // that exact printing is already in the deck, otherwise at the end. (After
  // the same warning about too many copies as the "+".) The view shows it
  // wherever the sort in use puts it, scrolls to it, and highlights it for a
  // moment.
  const listAreaRef = useRef<ComponentRef<typeof View>>(null);
  const [dropOver, setDropOver] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [addedNote, setAddedNote] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flash(key: string, text: string) {
    setFlashKey(key);
    setAddedNote(text);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => { setFlashKey(null); setAddedNote(null); }, 3000);
  }
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  useCardAreaDrop({
    areaRef: listAreaRef,
    enabled: true,
    onOver: setDropOver,
    onDrop: (dataTransfer) => { handleAreaDrop(dataTransfer); },
  });
  async function handleAreaDrop(dataTransfer: DataTransfer) {
    // (Read what was dropped now: the browser only allows it right away.)
    const lookup = lookupFromDrop(dataTransfer);
    if (!lookup) {
      showMessage('Couldn\'t add that', 'That isn\'t a card picture from Scryfall or EDHREC.');
      return;
    }
    if (!deck || busy.current) return;
    busy.current = true;
    try {
      const print = await loadOneCard(lookup.path);
      const face = isDoubleSided(print) ? lookup.face : 0;
      const card: DeckCard = { ...binderCardFrom(print, lookup.face), ...costAndType(print, face) };
      if (!(await okToAdd(card.name))) return;
      const current = findDeck(id);
      if (!current) return;
      const index = current.cards.findIndex((existing) => samePrinting(existing, card));
      addCardToDeck(id, card);
      setDeck(findDeck(id));
      flash(String(index >= 0 ? index : current.cards.length), `✓ Added ${card.name}${index >= 0 ? ' (one more copy)' : ''}`);
      announce(`Added ${card.name}${index >= 0 ? ', one more copy' : ''}.`);
    } catch (err) {
      showMessage('Couldn\'t add the card', (err as Error).message);
    } finally {
      busy.current = false;
    }
  }

  // A version that never changes between redraws, for the rows
  const copiesRef = useRef(changeCopies);
  copiesRef.current = changeCopies;
  const onCopies = useCallback((key: string, step: number) => copiesRef.current(Number(key), step), []);

  // "Delete from deck": ask, then take the card out
  async function confirmDelete(index: number) {
    const card = deck!.cards[index];
    setMenuIndex(null);
    const yes = await askYesNo(`Delete ${card.name}?`, `Take it out of ${deck!.name}.`, 'Yes, delete', 'No');
    if (!yes) return;
    setDeckCardCount(id, index, 0);
    setDeck(findDeck(id));
  }

  // "Move to a binder": close this window, then open the list of binders.
  // (iPhones can't open one pop-up while another is still fading away,
  // so there it waits a moment.)
  function moveToBinder(index: number) {
    setMenuIndex(null);
    setTimeout(() => setMovingIndex(index), Platform.OS === 'ios' ? 350 : 0);
  }

  // The card is safely in the binder: take it out of the deck
  function movedToBinder(moveNote: string) {
    if (movingIndex !== null) setDeckCardCount(id, movingIndex, 0);
    setMovingIndex(null);
    setNote(moveNote.replace('✓ ', ''));
    setDeck(findDeck(id));
  }

  if (!usingBinders) return <Redirect href="/binders" />;
  // No such deck (deleted, or a wrong address)
  if (!deck) {
    return (
      <View style={styles.missing}>
        <Text style={[styles.missingText, { color: colors.muted }]}>This deck isn't here (it may have been deleted).</Text>
      </View>
    );
  }

  const menuCard = menuIndex !== null ? deck.cards[menuIndex] : undefined;
  const movingCard = movingIndex !== null ? deck.cards[movingIndex] : undefined;

  return (
    // The keyboard pushes everything up instead of covering the search bar
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      {/* The search bar for adding cards (its drop-down floats over the
          cards below), and the List / Grid switch with the sort and the
          download button */}
      <View style={styles.top}>
        <DeckSearchBar
          mode={searchMode} onMode={setSearchMode}
          filter={filter} onFilter={setFilter}
          open={addOpen} onOpenChange={setAddOpen}
          onAdd={add} note={note}
        />
        <ViewSwitch
          mode={mode} sort={sort} reversed={reversed} modes={['list', 'grid']} onView={setListViewMode}
          extras={(
            // Save (or share) the deck as a .csv file
            <ToolButton icon="download-outline" label={`Download ${deck.name} as a .CSV file`}
                        onPress={() => downloadDeckCsv(id).catch((err) => showMessage('Couldn\'t save the file', (err as Error).message))} />
          )}
        />
      </View>

      {/* THE CARDS, with a picture dragged over them outlined */}
      <View ref={listAreaRef} style={styles.listArea} collapsable={false}>
        <CardList
          entries={entries}
          flashKey={flashKey}
          mode={mode}
          width={contentWidth}
          onPick={(key) => setMenuIndex(Number(key))}
          onCopies={onCopies}
          minTile={GRID_ZOOM_WIDTHS[gridZoom]}
          prices={prices}
          headerOf={headerOf}
          // The format, at the end of the line of totals (and the card just dropped)
          note={[deckFormat(deck.format).name, addedNote].filter(Boolean).join(' · ')}
          searchOf={searching ? allEntries.length : undefined}
          // No cards yet (or none matching the search)
          empty={(
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{deck.cards.length ? 'No cards match' : 'No cards yet'}</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {deck.cards.length ? `None of the ${deck.cards.length} cards match "${filter.trim()}".` : 'Flip the switch to Add, search for a card and tap the + on it.'}
              </Text>
            </View>
          )}
        />
        {dropOver && <View pointerEvents="none" style={[styles.dropOutline, { borderColor: colors.accent }]} />}
      </View>

      {/* While the Add drop-down is open, an invisible cover over everything
          below the bar: tapping anywhere closes the drop-down */}
      {searchMode === 'add' && addOpen && (
        <Pressable accessibilityLabel="Close the card search" style={styles.cover} onPress={() => setAddOpen(false)} />
      )}

      {/* THE CARD'S WINDOW: its picture (tap it to open the card in the Card
          Finder), what it does, how many copies, then Move to a binder and
          Delete from deck */}
      {menuCard && menuIndex !== null && (
        <PopupWindow title={menuCard.name} onClose={() => setMenuIndex(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuIndex(null), kind: 'secondary' }]}>
          <CardRules card={menuCard}
                     onOpen={() => { const card = menuCard; const spot = menuIndex; setMenuIndex(null); router.push(finderLinkFor(id, spot, card) as never); }} />
          {/* How many copies: − and + */}
          <View style={styles.menuCopies}>
            <Button label="−" kind="secondary" accessibilityLabel={cardCount(menuCard) > 1 ? 'One fewer copy' : 'Delete from deck'}
                    onPress={() => changeCopies(menuIndex, -1)} />
            <Text style={[styles.menuCount, { color: colors.text }]}>
              {cardCount(menuCard)} {cardCount(menuCard) === 1 ? 'copy' : 'copies'}
            </Text>
            <Button label="+" kind="secondary" accessibilityLabel="One more copy" disabled={cardCount(menuCard) >= MAX_COPIES}
                    onPress={() => changeCopies(menuIndex, 1)} />
          </View>
          <View style={styles.menu}>
            <Button label="Move to a binder" icon="albums-outline" kind="secondary" onPress={() => moveToBinder(menuIndex)} />
            <Button label="Delete from deck" icon="trash-outline" kind="danger" onPress={() => confirmDelete(menuIndex)} />
          </View>
        </PopupWindow>
      )}

      {/* "Move to a binder": the pop-up list of binders (the same one a
          binder's and a list's cards use). The deck's own extra details
          (cost and type) aren't part of a binder card. */}
      {movingCard && (
        <MoveCardDialog
          binderId=""
          card={(({ manaCost: _cost, typeLine: _type, ...binderCard }) => binderCard)(movingCard)}
          onMoved={(moveNote) => movedToBinder(moveNote)}
          onCancel={() => setMovingIndex(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// The screen's look: the search bar and switch at the top, the cards
// filling the rest
const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 8, zIndex: 10 },
  listArea: { flex: 1 },
  dropOutline: { position: 'absolute', top: 4, left: 8, right: 8, bottom: 4, borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, zIndex: 25 },
  // The invisible cover: it sits above the cards but below the search bar (which has zIndex 10)
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, marginTop: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center' },
  // The card's window: the copies, then the buttons
  menuCopies: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  menuCount: { fontSize: 16, fontWeight: '600', minWidth: 90, textAlign: 'center' },
  menu: { gap: 8 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingText: { fontSize: 16, textAlign: 'center' },
});
