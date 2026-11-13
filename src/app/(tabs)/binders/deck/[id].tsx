/* =====================================================================
   ONE DECK (/binders/deck/<id>)
   An opened deck. From top to bottom: the search bar for adding cards
   (see components/decks/DeckAddSearch.tsx: type a name, tap the "+" on
   the card you want; the first printing that comes up is added, and the
   switch under the bar limits the search to cards in your binders), one
   quiet line (the format and how many cards), then the deck's cards, one
   row each: picture, name, casting cost, type line, and the "− 3 +"
   copies bar (− on the last copy asks about removing the card).
   Tapping a card opens its window, the same one the binders' and lists'
   cards have: a big picture (tap it to open the card in the Card Finder),
   what it does, how many copies (− and +), Move to a binder (the card
   leaves the deck and goes into the binder's first empty pocket) and
   Delete from deck (it asks first).
   Too many copies: adding a card the deck already has as many of as its
   format allows (1 in Commander-style formats, 4 in the others) shows a
   window about it, with "Add anyway" because some cards break the limit.
   Basic lands, snow-covered basic lands and Wastes never ask.
   This is the first step of the deck screen: the commander slot, the
   sideboard, picking a different printing and the format's other rules
   come later. Decks are kept on this device only for now (see
   lib/deckStorage.ts).
   ===================================================================== */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import { useAccount } from '@/hooks/useAccount';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import HelpButton from '@/components/HelpButton';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import DeckAddSearch from '@/components/decks/DeckAddSearch';
import ManaCost from '@/components/lists/ManaCost';
import FoilFrame from '@/components/binder/FoilFrame';
import CopiesBar from '@/components/binder/CopiesBar';
import CardRules from '@/components/binder/CardRules';
import MoveCardDialog from '@/components/binder/MoveCardDialog';
import PopupWindow from '@/components/PopupWindow';
import Button from '@/components/Button';
import { addCardToDeck, copiesOf, findDeck, setDeckCardCount, type Deck, type DeckCard } from '@/lib/deckStorage';
import { deckFormat, skipsCopyWarning } from '@/lib/deckFormats';
import { CARD_BACK, costAndType, imageFor } from '@/lib/cards';
import { detailsOf, costAndTypeOf, finishParam } from '@/lib/cardDetails';
import { cardCount, cardCountText, loadBinder, loadBinderList, MAX_COPIES } from '@/lib/binderStorage';
import { cardByNamePath, loadOneCard } from '@/lib/scryfall';
import { pictureSource } from '@/lib/http';
import { askYesNo, showMessage } from '@/lib/dialogs';

// The page is never wider than this (points), with this space around it
const PAGE_MAX_WIDTH = 900;
const PAGE_PADDING = 16;

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

  const total = deck.cards.reduce((sum, card) => sum + cardCount(card), 0);
  const menuCard = menuIndex !== null ? deck.cards[menuIndex] : undefined;
  const movingCard = movingIndex !== null ? deck.cards[movingIndex] : undefined;

  return (
    // The keyboard pushes everything up instead of covering the search bar
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={deck.cards}
        keyExtractor={(card, index) => `${card.set}-${card.number}-${card.face}-${card.foil ? 'f' : 'n'}-${index}`}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        // At the top: the search bar (its drop-down floats over the cards
        // below), then the quiet line about the deck
        ListHeaderComponentStyle={styles.headerOnTop}
        ListHeaderComponent={
          <View style={styles.header}>
            <DeckAddSearch onAdd={add} note={note} />
            <Text style={[styles.summary, { color: colors.muted }]}>
              {deckFormat(deck.format).name} · {cardCountText(total)} · {deck.cards.length} different
            </Text>
          </View>
        }
        // No cards yet
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.muted }]}>No cards yet. Search above and tap the + on a card to add it.</Text>
        }
        renderItem={({ item, index }) => (
          // One card: picture, name, cost and type, and the copies bar
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            {/* The picture and name: tap them for the card's window */}
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}. Opens its menu.`}
                       onPress={() => setMenuIndex(index)}
                       style={({ pressed }) => [styles.rowMain, pressed && { backgroundColor: colors.surfaceHover }]}>
              <FoilFrame foil={item.foil === true} width={34} height={48} radius={4}>
                <Image source={pictureSource(item.image)} style={styles.thumb} contentFit="cover" />
              </FoilFrame>
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                {item.manaCost ? <ManaCost cost={item.manaCost} size={13} /> : null}
                {item.typeLine ? <Text style={[styles.type, { color: colors.muted }]} numberOfLines={1}>{item.typeLine}</Text> : null}
              </View>
            </Pressable>
            <CopiesBar name={item.name} count={cardCount(item)} style={styles.bar}
                       onFewer={() => changeCopies(index, -1)} onMore={() => changeCopies(index, 1)} />
          </View>
        )}
      />

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

// The screen's look
const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { padding: PAGE_PADDING, width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center', flexGrow: 1, paddingBottom: 60 },
  header: { gap: 10, marginBottom: 8, zIndex: 10 },
  headerOnTop: { zIndex: 10 },
  summary: { fontSize: 13 },
  empty: { fontSize: 15, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: '100%', height: '100%' },
  // The part of a row you tap for the card's window: the picture and the name
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  type: { fontSize: 12 },
  bar: { width: 84 },
  // The card's window: the copies, then the buttons
  menuCopies: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  menuCount: { fontSize: 16, fontWeight: '600', minWidth: 90, textAlign: 'center' },
  menu: { gap: 8 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingText: { fontSize: 16, textAlign: 'center' },
});
