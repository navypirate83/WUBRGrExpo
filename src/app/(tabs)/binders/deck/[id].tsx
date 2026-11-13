/* =====================================================================
   ONE DECK (/binders/deck/<id>)
   An opened deck, with the basics of a list (see list/[id].tsx): its
   cards as a LIST or a GRID of card pictures (the buttons under the search
   bar, remembered the same way as a list's), the same sort menu, header
   bars between groups, foil borders, prices and the line of totals, the
   grid's zoom, and a download button (the deck as a .CSV file).
   From top to bottom: the search bar for adding cards (see
   components/decks/DeckAddSearch.tsx: type a name, tap the "+" on the
   card you want; the first printing that comes up is added, and the
   switch under the bar limits the search to cards in your binders), the
   List / Grid switch with the sort and download button, then the cards.
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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useColors } from '@/hooks/useTheme';
import { useAccount } from '@/hooks/useAccount';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import { useBinderPrices } from '@/hooks/useBinderPrices';
import { useContentWidth } from '@/hooks/useMenuStyle';
import HelpButton from '@/components/HelpButton';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import DeckAddSearch from '@/components/decks/DeckAddSearch';
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
import { CARD_BACK, costAndType, imageFor } from '@/lib/cards';
import { detailsOf, costAndTypeOf, finishParam } from '@/lib/cardDetails';
import { cardCount, loadBinder, loadBinderList, MAX_COPIES } from '@/lib/binderStorage';
import { cardByNamePath, loadOneCard } from '@/lib/scryfall';
import { downloadDeckCsv } from '@/lib/binderDownload';
import { askYesNo, showMessage } from '@/lib/dialogs';

// The Card Finder's address for a card in this deck: that exact printing
// (side, language, foil)
function finderLinkFor(card: DeckCard): string {
  const params = new URLSearchParams();
  params.set('set', card.set);
  params.set('number', card.number);
  if (card.face === 1) params.set('face', 'back');
  if (card.lang) params.set('lang', card.lang);
  const finish = finishParam(card);
  if (finish) params.set('foil', finish);
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
  // What the cards are worth, and their details from Scryfall (for sorting)
  const prices = useBinderPrices(allEntries);
  const entries = useMemo<CardEntry[]>(
    () => sortEntries(allEntries, sort, reversed, { printings: prices.printings, prices: prices.byKey }),
    [allEntries, sort, reversed, prices.printings, prices.byKey],
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

  // A "+" in the search: warn if the deck has as many as its format allows
  // (unless it's a basic land or Wastes), then add one copy
  async function add(name: string, ownedOnly: boolean) {
    if (!deck || busy.current) return;
    busy.current = true;
    try {
      const format = deckFormat(deck.format);
      const have = copiesOf(findDeck(id), name);
      if (have >= format.copyLimit && !skipsCopyWarning(name)) {
        const why = format.copyLimit === 1
          ? `${format.name} decks are singleton: one copy of each card. (A few cards allow more.)`
          : `${format.name} decks allow up to ${format.copyLimit} copies of a card. (A few cards allow more.)`;
        const yes = await askYesNo(`${name} is already in this deck`, `The deck has ${have} ${have === 1 ? 'copy' : 'copies'}. ${why}`, 'Add anyway', 'Cancel');
        if (!yes) return;
      }
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
        <DeckAddSearch onAdd={add} note={note} />
        <ViewSwitch
          mode={mode} sort={sort} reversed={reversed} modes={['list', 'grid']} onView={setListViewMode}
          extras={(
            // Save (or share) the deck as a .csv file
            <ToolButton icon="download-outline" label={`Download ${deck.name} as a .CSV file`}
                        onPress={() => downloadDeckCsv(id).catch((err) => showMessage('Couldn\'t save the file', (err as Error).message))} />
          )}
        />
      </View>

      {/* THE CARDS */}
      <View style={styles.listArea}>
        <CardList
          entries={entries}
          mode={mode}
          width={contentWidth}
          onPick={(key) => setMenuIndex(Number(key))}
          onCopies={onCopies}
          minTile={GRID_ZOOM_WIDTHS[gridZoom]}
          prices={prices}
          headerOf={headerOf}
          // The format, at the end of the line of totals
          note={deckFormat(deck.format).name}
          // No cards yet
          empty={(
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No cards yet</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Search above and tap the + on a card to add it.</Text>
            </View>
          )}
        />
      </View>

      {/* THE CARD'S WINDOW: its picture (tap it to open the card in the Card
          Finder), what it does, how many copies, then Move to a binder and
          Delete from deck */}
      {menuCard && menuIndex !== null && (
        <PopupWindow title={menuCard.name} onClose={() => setMenuIndex(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuIndex(null), kind: 'secondary' }]}>
          <CardRules card={menuCard}
                     onOpen={() => { const card = menuCard; setMenuIndex(null); router.push(finderLinkFor(card) as never); }} />
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
