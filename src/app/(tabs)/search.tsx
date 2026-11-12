/* =====================================================================
   CARD FINDER (the Search tab): THE MTG CARD FINDER
   Look up any Magic card by name, see its picture and details, and pick
   the exact set, version and language. The search box is at the top;
   everything about the card is in the card area under it (CardPanel).
   A shared link (like /search?set=isd&number=51) opens one exact card.
   The card data comes from Scryfall, through TanStack Query, which
   remembers each answer so nothing is downloaded twice.
   Opened from a binder, the address also says which binder (and maybe
   which pocket) the "+" Add to binder button fills, and a back arrow
   beside the screen's title leads back to that binder. Opened from a
   list ("?list=<id>"), the "+" puts the card into that list instead,
   and the back arrow leads back to the list.
   The card area shows one of four clearly different states: Searching…
   (loading), a red-edged box with "Try again" (error), "No cards found"
   (empty), or the card itself (data). See SearchStates.tsx.
   Keyboard handling: the whole screen is a KeyboardAvoidingView, which
   shrinks the screen to the space above the phone's keyboard, so the
   keyboard never covers the search box or its list of suggestions.
   ===================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type TextInput,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  cardByNamePath, cardBySetPath, loadCard, loadCardNames, loadSetIcons,
} from '@/lib/scryfall';
import { prepareNames } from '@/lib/nameSearch';
import { plural } from '@/lib/cards';
import { binderName, findBinder } from '@/lib/binderStorage';
import { findList } from '@/lib/listStorage';
import { RequestError } from '@/lib/http';
import { useShortcutKeys, useShowKeyHints } from '@/hooks/useShortcutKeys';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import { useAccount } from '@/hooks/useAccount';
import { useColors } from '@/hooks/useTheme';
import { MAX_CONTENT_WIDTH } from '@/theme/colors';
import ShortcutsDialog, { type Shortcut } from '@/components/ShortcutsDialog';
import SearchBox, { MIN_CHARS } from '@/components/search/SearchBox';
import CardPanel from '@/components/search/CardPanel';
import { NoCardsFound, SearchError, Searching } from '@/components/search/SearchStates';
import { addressValue, pocketFromAddress } from '@/components/search/AddToBinder';

// One card lookup: the Scryfall address that finds it, which side and
// language a shared link asked for, the name typed (for "Searching…"),
// and a number that's new for every lookup (so searching for the same
// card again starts it fresh).
type Lookup = {
  path: string;
  face: number;
  lang: string | null;
  name?: string;
  number: number;
};

// The keys listed in this screen's Keyboard shortcuts window (press ?;
// computers only)
const searchShortcuts: Shortcut[] = [
  { keys: '/', does: 'Jump to the search box' },
  { keys: 'Esc', does: 'Leave the search box, so these keys work' },
  { keys: '[  ]', does: 'Previous / next version in this set' },
  { keys: '{  }', does: 'Previous / next set (Shift + [ / ])' },
  { keys: 'F', does: 'Flip a two-sided card' },
  { keys: 'A', does: 'Add to binder (when signed in or using the app locally)' },
  { keys: 'S', does: 'Share: copy a link to this card' },
  { keys: 'B', does: 'Back to the binder you came from' },
  { keys: '?', does: 'Show this list' },
];

// A counter for numbering lookups
let lookupCount = 0;

// The lookup for one exact printing in a shared link's address (null if
// the address doesn't name one)
function lookupFromAddress(set: string | null, number: string | null, face: string | null, lang: string | null): Lookup | null {
  if (!set || !number) return null;
  return { path: cardBySetPath(set, number), face: face === 'back' ? 1 : 0, lang, number: ++lookupCount };
}

// Did a lookup fail because Scryfall has no such card (the "empty"
// state), rather than because something went wrong (the "error" state)?
// Scryfall's "not found" answers can't be fixed by trying again, and
// come with Scryfall's own message (not "Scryfall had a problem...").
function isNotFound(error: unknown): boolean {
  return error instanceof RequestError && !error.offline && !error.retryable
    && !error.message.startsWith('Scryfall had a problem');
}

export default function CardFinderScreen() {
  const colors = useColors();
  // The header's height: the keyboard handling below needs it to work
  // out how much of the screen the keyboard covers
  const headerHeight = useHeaderHeight();

  // The address's "?set=...&number=..." details, from a shared link or
  // from a binder
  const params = useLocalSearchParams();
  const setParam = addressValue(params.set);
  const numberParam = addressValue(params.number);
  const faceParam = addressValue(params.face);
  const langParam = addressValue(params.lang);
  const foilParam = addressValue(params.foil);

  // The card to look up. A shared link sets the first one: one exact
  // printing, maybe its back side ("face=back") or another language
  // ("lang=ja"). Otherwise there's nothing to look up until a search.
  const [lookup, setLookup] = useState<Lookup | null>(
    () => lookupFromAddress(setParam, numberParam, faceParam, langParam),
  );

  // Is Foil on? It carries on from card to card. A shared link with
  // "foil=1" starts with it on.
  const [foil, setFoil] = useState(() => foilParam === '1');

  // A message from adding to a binder (like "That binder is full."),
  // shown under the search box instead of the usual one until the next
  // card is looked up
  const [addMessage, setAddMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // This screen is a tab, so it stays open when another screen sends it
  // a new card (a binder's "look this card up"). When the address names
  // a different printing from last time, look that one up. (This is done
  // right here while drawing: React allows it, and redraws straight away.)
  const addressKey = setParam && numberParam ? [setParam, numberParam, faceParam, langParam].join('|') : null;
  const [seenAddress, setSeenAddress] = useState(addressKey);
  if (addressKey !== seenAddress) {
    setSeenAddress(addressKey);
    const next = lookupFromAddress(setParam, numberParam, faceParam, langParam);
    if (next) {
      setLookup(next);
      setFoil(foilParam === '1');
      setAddMessage(null);
    }
  }

  // Is someone using the binders? And was this screen opened from a
  // binder ("?binder=<id>", maybe with the pocket to fill)? (A binder
  // that no longer exists is ignored.)
  const { usingBinders } = useAccount();
  const binderParam = addressValue(params.binder);
  const fromBinder = binderParam && findBinder(binderParam) ? binderParam : null;
  const pocket = pocketFromAddress(params);
  // Or was it opened from a list ("?list=<id>")? (A list that no longer
  // exists is ignored.)
  const listParam = addressValue(params.list);
  const fromList = listParam && findList(listParam) ? listParam : null;

  // What's typed in the search box, and a handle on the box
  const [text, setText] = useState('');
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  // The scrolling card area (scrolled back to the top for each new card)
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // The Keyboard shortcuts window, and reading messages out to screen readers
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { announce } = useAnnouncer();

  /* ----- Downloads (TanStack Query runs these and remembers them) ----- */

  // Every card name, downloaded once and prepared for the fuzzy search.
  // ("select" prepares it; it's only redone if the names change.)
  const names = useQuery({ queryKey: ['card-names'], queryFn: loadCardNames, select: prepareNames });

  // Every set's symbol picture, for the Set picker
  const setIcons = useQuery({ queryKey: ['set-icons'], queryFn: loadSetIcons });

  // The card being looked up, and all its printings. While a new one
  // loads, the old card stays on show ("keepPreviousData"), dimmed with
  // a spinner, instead of the screen going blank.
  const cardQuery = useQuery({
    queryKey: ['card', lookup?.path],
    queryFn: () => loadCard(lookup!.path),
    enabled: lookup !== null,
    placeholderData: keepPreviousData,
  });

  // The lookup whose card is on show: the current one once its answer
  // has arrived, the one before while it's still loading, and none
  // after a lookup fails. (Updated right here while drawing, so the new
  // card and its lookup always show together.)
  const [shownLookup, setShownLookup] = useState<Lookup | null>(null);
  const arrived = cardQuery.isSuccess && !cardQuery.isPlaceholderData;
  if (arrived && shownLookup !== lookup) setShownLookup(lookup);
  const result = cardQuery.isError ? undefined : cardQuery.data;

  // When a card arrives, put its full name in the search box.
  const cardName = arrived ? cardQuery.data?.card.name : undefined;
  useEffect(() => {
    if (cardName) setText(cardName);
  }, [cardName, lookup?.number]);

  // Each new card starts with the screen scrolled to the top
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [shownLookup?.number]);

  // Look up a card by name. "exact" is true when the name came from the
  // suggestion list; otherwise Scryfall guesses the closest match.
  function searchFor(name: string, exact: boolean) {
    setAddMessage(null);
    setLookup({ path: cardByNamePath(name, exact), face: 0, lang: null, name, number: ++lookupCount });
  }

  /* ----- Which of the four states the card area is in ----- */

  // error or empty: the lookup failed (and isn't being tried again by
  // itself); "notFound" tells the two apart
  const failed = cardQuery.isError;
  const notFound = failed && isNotFound(cardQuery.error);
  // loading, with no card to keep showing in the meantime
  const firstLoad = !failed && cardQuery.isFetching && !(result && shownLookup);

  /* ----- The message under the search box ----- */

  // Is this a computer-sized screen (not the phone app or a phone-sized
  // window)? Only there does the letters reminder below show.
  const onComputer = useShowKeyHints();
  const { hint, hintIsError } = useMemo(() => {
    if (cardQuery.isFetching) return { hint: 'Loading…', hintIsError: false };
    if (cardQuery.isError) return { hint: notFound ? 'No cards found.' : 'Couldn\'t load that card.', hintIsError: true };
    if (cardQuery.data) {
      const setCount = new Set(cardQuery.data.prints.map((p) => p.set)).size;
      return {
        hint: `${plural(cardQuery.data.prints.length, 'printing')} across ${plural(setCount, 'set')}.`,
        hintIsError: false,
      };
    }
    if (names.isPending) return { hint: 'Loading card names…', hintIsError: false };
    // Nothing looked up yet: on a computer, a reminder of how many
    // letters bring up suggestions; on a phone, nothing (it's clutter)
    if (!onComputer) return { hint: '', hintIsError: false };
    return { hint: `Type at least ${MIN_CHARS} letters to see suggestions.`, hintIsError: false };
  }, [cardQuery.isFetching, cardQuery.isError, notFound, cardQuery.data, names.isPending, onComputer]);

  /* ----- Going back to the binder this screen was opened from ----- */

  // Where "back" goes when this screen was opened from a list or a
  // binder (that list or binder), and what screen readers call it; null
  // when it was opened on its own
  const back = fromList
    ? { to: `/binders/list/${encodeURIComponent(fromList)}`, name: findList(fromList)?.name ?? 'the list' }
    : usingBinders && fromBinder
      ? { to: `/binders/${encodeURIComponent(fromBinder)}`, name: binderName(fromBinder) }
      : null;
  const backTo = back?.to ?? null;

  // The back arrow at the top left is the same as on every other page (see
  // AppHeader.tsx): it goes to the page you were just on, which is the list
  // or binder this screen was opened from. The B key on a computer (in
  // CardPanel) and Android's own Back below go straight to that list or
  // binder.

  // Android's own Back (the swipe in from the screen's edge, or the Back
  // button) does the same as the arrow while this screen is showing:
  // back to the list or binder it was opened from. (Without this, it
  // would jump to the Home tab instead.) "useFocusEffect" listens only
  // while this screen is in view; returning true says "handled".
  useFocusEffect(useCallback(() => {
    if (!backTo) return undefined;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      router.navigate(backTo as never);
      return true;
    });
    return () => listener.remove();
  }, [backTo]));

  /* ----- Shortcut keys that work even before a card is shown (computers) ----- */

  //  /  jump to the search box (its text is selected, so typing replaces it)
  //  ?  the Keyboard shortcuts window
  useShortcutKeys((event) => {
    if (event.key === '/') {
      event.preventDefault();   // "/" would otherwise start the browser's quick find
      searchRef.current?.focus();
    } else if (event.key === '?') {
      event.preventDefault();
      setShortcutsOpen(true);
    }
  });

  return (
    // The whole screen shrinks to the space above the keyboard while
    // it's up ("padding" adds room at the bottom the size of the part
    // the keyboard covers). Browsers handle this by themselves.
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'web' ? undefined : 'padding'}
      keyboardVerticalOffset={headerHeight}
    >
      <SearchBox
        value={text}
        onChange={setText}
        names={names.data}
        onChoose={searchFor}
        onLeave={() => announce('Left the search box. The shortcut keys work now: press ? to see them.')}
        hint={addMessage ? addMessage.text : hint}
        hintIsError={addMessage ? addMessage.isError : hintIsError}
        onShowShortcuts={() => setShortcutsOpen(true)}
        inputRef={searchRef}
      >
        {/* The card area, which scrolls. "handled" lets taps on buttons
            work while the keyboard is up; dragging the card area puts
            the keyboard away. */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {failed ? (
            // ERROR or EMPTY: say what happened, instead of a card
            notFound ? (
              <NoCardsFound message={(cardQuery.error as Error).message} />
            ) : (
              <SearchError
                message={(cardQuery.error as Error).message || 'Something went wrong.'}
                onRetry={() => cardQuery.refetch()}
                retrying={cardQuery.isFetching}
              />
            )
          ) : firstLoad ? (
            // LOADING, with no card to show yet
            <Searching name={lookup?.name} />
          ) : (
            // DATA (or, before any search, the back of a card). "key"
            // makes React draw a fresh card area for each card looked
            // up, so it starts on the printing Scryfall found.
            <CardPanel
              key={result && shownLookup ? shownLookup.number : 'empty'}
              result={result && shownLookup ? result : undefined}
              startFace={shownLookup?.face ?? 0}
              startLang={shownLookup?.lang ?? null}
              setIcons={setIcons.data}
              foil={foil}
              setFoil={setFoil}
              busy={cardQuery.isFetching}
              announce={announce}
              usingBinders={usingBinders}
              fromBinder={fromBinder}
              pocket={pocket}
              toList={fromList}
              onMessage={(message, isError = false) => setAddMessage(message === null ? null : { text: message, isError })}
            />
          )}
        </ScrollView>
      </SearchBox>

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        intro="These work anywhere on the screen, except while you're typing in a box."
        shortcuts={searchShortcuts}
      />
    </KeyboardAvoidingView>
  );
}

// The screen's look: the card area is centered, never wider than the
// app's widest content, with 16 points of room at each side and extra
// room at the bottom so the last box isn't against the tab bar
const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  content: {
    width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 48,
  },
  // The back arrow beside the title, with room around it to tap
});
