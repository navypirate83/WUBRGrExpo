/* =====================================================================
   ONE BINDER: ITS CARDS (/binders/<id>)
   A binder opens as a LIST of its cards (the usual way), a GRID of card
   pictures, or its pages of pockets (the "Binder" view): the buttons under
   the search bar switch between them, and the app remembers your choice
   (see lib/binderView.ts and components/binder/CardList.tsx).
   Tapping a card in the list or grid opens its menu. A red "+" in the
   corner of the list and grid opens the Card Finder aimed at the
   binder's next empty pocket (adding a page when every pocket is full).
   In the Binder view, a Clean-up button moves every card forward to fill
   the empty pockets.
   The rest of this note is about the Binder view.
   The Binder view shows its pages like a real binder lying open: one
   page at a time on a phone, two side by side on a wider screen (a
   tablet, or a computer's browser window). Each page has the pockets
   across and down chosen in Settings (see Pocket.tsx and
   lib/pageLayout.ts).
   Touching the binder:
   - SWIPE left or right to turn the page (or tap Previous / Next): the
     page swings over like a real page turning
   - TAP a card to open it in the Card Finder, or an empty pocket's "+"
     to pick a card for it
   - the "− 3 +" bar changes how many copies you own
   - REST a finger on a card, then drag it (with a mouse: press and
     drag) onto another pocket, swapping with any card there. Holding it
     at the binder's left or right edge turns the page.
   - HOLD a card still for half a second for its menu: copies, open it,
     move it to another binder, or remove it.
   On a computer, the arrow and Page Up / Down keys turn pages, and card
   pictures dragged in from Scryfall or EDHREC fill empty pockets.
   Every change is saved on this device straight away, then to Google
   Drive a moment later (the line under the search bar says where it's
   saved). The bell in the header sets a reminder about this binder.
   ===================================================================== */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { GestureDetector, ScrollView, useCompetingGestures, usePanGesture } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAccount } from '@/hooks/useAccount';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import { useColors } from '@/hooks/useTheme';
import { useShortcutKeys, useShowKeyHints } from '@/hooks/useShortcutKeys';
import { useCardDrop } from '@/hooks/useCardDrop';
import { useCardAreaDrop } from '@/hooks/useCardAreaDrop';
import { usePointerKind } from '@/hooks/usePointerKind';
import ShortcutsDialog, { type Shortcut } from '@/components/ShortcutsDialog';
import PopupWindow from '@/components/PopupWindow';
import Button from '@/components/Button';
import TextField from '@/components/TextField';
import HelpButton from '@/components/HelpButton';
import BinderSearch from '@/components/binders/BinderSearch';
import Pocket from '@/components/binder/Pocket';
import CardList, { Summary, type CardEntry } from '@/components/binder/CardList';
import ViewSwitch, { ToolButton } from '@/components/binder/ViewSwitch';
import AddCardsButton from '@/components/binder/AddCardsButton';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import { useBinderPrices } from '@/hooks/useBinderPrices';
import MoveCardDialog from '@/components/binder/MoveCardDialog';
import {
  MAX_COPIES, binderDirtyStamp, binderName, binderPages, cardCount, findBinder, firstEmptyPocket, isLocalMode, loadBinder,
  loadBinderList, pocketKey, samePrinting, saveBinder, saveBinderList, withCount, type BinderCard, type BinderCards,
} from '@/lib/binderStorage';
import { DriveError, initGoogleSignIn, isSignedIn, signInWithGoogle, syncBinder, updateBinderDetails } from '@/lib/googleDrive';
import { APP_HEADERS, RequestError, pictureSource } from '@/lib/http';
import { binderCardFrom, lookupFromDrop } from '@/lib/cardDrop';
import { loadOneCard } from '@/lib/scryfall';
import { hapticTap } from '@/lib/haptics';
import { downloadBinderCsv } from '@/lib/binderDownload';
import { layoutKey, onLayoutChange, pageLayout } from '@/lib/pageLayout';
import { GRID_ZOOM_WIDTHS, binderGridZoom, binderSort, binderSortReversed, binderViewMode, onBinderViewChange, onGridZoomChange } from '@/lib/binderView';
import { sortEntries } from '@/lib/binderSort';
import { isSearching, makeNameFilter } from '@/lib/nameFilter';
import { fillDetails, finishParam } from '@/lib/cardDetails';
import { rememberBinderPage, rememberedBinderPage } from '@/lib/shelfMemory';
import { useContentWidth } from '@/hooks/useMenuStyle';
import { askYesNo, showMessage } from '@/lib/dialogs';
import { REMINDERS_AVAILABLE, scheduleReminder } from '@/lib/reminders';

/* ---------------------------------------------------------------------
   SETTINGS
   --------------------------------------------------------------------- */

// The pictures of this many pages either side of the ones showing are
// downloaded ahead of time, so turning the page shows them straight away
const PICTURE_PAGES_AHEAD = 2;

// A sideways swipe this long (points), or this fast, turns the page
const SWIPE_DISTANCE = 50;
const SWIPE_SPEED = 500;

// Picking up a card: rest your finger on it at least this long
// (milliseconds), then move, and the card follows your finger. A finger
// that moves sooner than this is a swipe (it turns the page) instead.
const REST_MS = 150;

// Hold a card still this long (milliseconds) and let go without moving,
// and its menu opens (a shorter press opens the card, like a tap)
const MENU_HOLD_MS = 500;

// How far (points) a resting finger must move to pick its card up (less
// than this is just a finger wobbling)
const LIFT_DISTANCE = 8;

// How close to the binder's left or right edge (points) a dragged card
// must be held to turn the page, and how long it must stay there
const EDGE_ZONE = 26;
const EDGE_WAIT_MS = 550;

// How long one page turn takes (milliseconds)
const TURN_MS = 520;

// The binder's shape: the black cover around the pages, the gap down the
// middle (the spine) when two pages show, the space inside each page,
// and the gap between pockets. A card is 63 by 88 millimeters.
const COVER = 10;
const SPINE = 14;
const PAD = 8;
const GAP = 5;
const CARD_RATIO = 88 / 63;

// The strip under the binder (Previous / Next and the page number)
const BAR_HEIGHT = 24;

// In the phone app with two pages showing, pockets shrink to fit the
// page on screen, but never narrower than this (points): a longer page
// scrolls instead
const MIN_POCKET_W = 80;

// While dragging a card, holding it this close (points) to the top or
// bottom of the binder's space scrolls the page, this far at a time,
// this often (milliseconds)
const SCROLL_EDGE = 60;
const SCROLL_STEP = 14;
const SCROLL_EVERY_MS = 30;

// Two pages show side by side once the screen is at least this wide
const TWO_PAGE_WIDTH = 700;

// Saving to Drive: wait this long after a change (so quick changes go
// together in one save), and this long before trying a failed save again
const DRIVE_SAVE_DELAY_MS = 1200;
const DRIVE_RETRY_MS = 30000;

// The keys listed in this screen's Keyboard shortcuts window (computers)
const binderShortcuts: Shortcut[] = [
  { keys: '← →  PgUp PgDn', does: 'Turn the page back / forward' },
  { keys: 'D', does: 'Download this binder as a .CSV file' },
  { keys: '?', does: 'Show this list' },
];

/* ---------------------------------------------------------------------
   SMALL HELPERS
   --------------------------------------------------------------------- */

// "page 3, pocket 5" for a pocket key like "3-5"
function placeName(key: string): string {
  const [page, slot] = key.split('-');
  return `page ${page}, pocket ${slot}`;
}

// The page number of a pocket key ("3-5" → 3), and its pocket number (→ 5)
const pageOf = (key: string) => Number(key.split('-')[0]);
const slotOf = (key: string) => Number(key.split('-')[1]);

// The numbers from "first" to "last"
function range(first: number, last: number): number[] {
  const list: number[] = [];
  for (let n = first; n <= last; n++) list.push(n);
  return list;
}

// The Card Finder's address for one pocket. If the pocket holds a card,
// it also says which card to open (the same set / number / face /
// language / foil as a shared link). Either way it carries this binder,
// page and pocket along, so "+" over there puts the card in this pocket.
function searchLinkFor(binderId: string, key: string, card?: BinderCard): string {
  const params = new URLSearchParams();
  if (card) {
    params.set('set', card.set);
    params.set('number', card.number);
    if (card.face === 1) params.set('face', 'back');
    if (card.lang) params.set('lang', card.lang);   // e.g. "ja" for Japanese
    const finish = finishParam(card);               // opens with Foil (or Etched) already on
    if (finish) params.set('foil', finish);
  }
  params.set('binder', binderId);
  params.set('binderPage', String(pageOf(key)));
  params.set('binderSlot', String(slotOf(key)));
  return `/search?${params}`;
}

// Each binder gets a fresh screen (so moving from one binder to another
// starts again from scratch): "key" makes React draw a new one. The same
// happens when the page layout changes in Settings: the cards have been
// moved to the new layout, so the screen starts again with them.
export default function BinderScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const layout = useSyncExternalStore(onLayoutChange, layoutKey, layoutKey);
  return <BinderView key={`${id} ${layout}`} binderId={id} />;
}

function BinderView({ binderId }: { binderId: string }) {
  const colors = useColors();
  // Show the keyboard shortcuts button? (Computers only: see useShortcutKeys)
  const showKeyHints = useShowKeyHints();
  const navigation = useNavigation();
  const { usingBinders } = useAccount();
  const params = useLocalSearchParams<{ page?: string; highlight?: string }>();
  const binder = findBinder(binderId);
  const { announce } = useAnnouncer();
  const reduceMotion = useReducedMotion();
  // The pockets across and down each page (from Settings)
  const layout = pageLayout();
  const perPage = layout.across * layout.down;

  /* ----- The cards, and saving them ----- */

  // This binder's cards (this device's working copy). "cardsRef" always
  // holds the newest copy, for code that runs later (timers, Drive).
  const [cards, setCardsState] = useState<BinderCards>(() => loadBinder(binderId));
  const cardsRef = useRef(cards);

  // How many pages: the binder's own number, but never fewer than the
  // highest page that has a card on it, so no card is ever out of sight.
  // (Worked out each time, so a page added by the "+" button, or a card
  // added on a new page, shows up straight away.)
  const highestUsed = useMemo(() => Math.max(0, ...Object.keys(cards).map(pageOf)), [cards]);
  const totalPages = Math.max(binderPages(binderId), highestUsed);

  // Keep a new set of cards: save it on this device and show it.
  // Returns false (and changes nothing) if saving isn't working.
  function commit(next: BinderCards): boolean {
    if (!saveBinder(next, binderId)) return false;
    cardsRef.current = next;
    setCardsState(next);
    return true;
  }

  // Coming back to this binder (from the Card Finder, which may have
  // added a card): show this device's newest copy of the cards
  useFocusEffect(useCallback(() => {
    const fresh = loadBinder(binderId);
    if (JSON.stringify(fresh) !== JSON.stringify(cardsRef.current)) {
      cardsRef.current = fresh;
      setCardsState(fresh);
    }
  }, [binderId]));

  /* ----- How the cards are shown: a list, a grid or the binder's pockets ----- */

  // The view and sort chosen (remembered on this device)
  const mode = useSyncExternalStore(onBinderViewChange, binderViewMode, binderViewMode);
  const sort = useSyncExternalStore(onBinderViewChange, binderSort, binderSort);
  const reversed = useSyncExternalStore(onBinderViewChange, binderSortReversed, binderSortReversed);
  // The room beside the side menu (the whole window on a phone)
  const contentWidth = useContentWidth();
  // How big the grid's pictures are at least (the website can zoom them)
  const gridZoom = useSyncExternalStore(onGridZoomChange, binderGridZoom, binderGridZoom);
  // The cards for the list and grid. First as they come (the prices and
  // the cards' details are looked up from these), then put in the order
  // chosen (see lib/binderSort.ts: some orders need the details and the
  // prices, so until they arrive the cards are in name order).
  const baseEntries = useMemo<CardEntry[]>(() => Object.entries(cards).map(([key, card]) => ({ key, card })), [cards]);
  // What's typed in the search bar (while it searches this binder): the
  // cards narrow to those whose name matches, as you type (a forgiving
  // search). In the Binder view the matches are shown on their own, as a
  // grid, and tapping one jumps to its pocket.
  const [query, setQuery] = useState('');
  const [clearToken, setClearToken] = useState(0);
  const searching = isSearching(query);
  const nameFilter = useMemo(() => makeNameFilter(baseEntries, (entry) => entry.card.name), [baseEntries]);
  const matchingEntries = useMemo(() => (searching ? nameFilter(query) : baseEntries), [searching, nameFilter, query, baseEntries]);
  // What the cards are worth at the store chosen in Settings (for the line
  // above the cards in every view, and the prices in the list). The cards are
  // looked up on the internet for this, and the answers are kept for a while.
  const prices = useBinderPrices(baseEntries);
  const entries = useMemo<CardEntry[]>(
    () => sortEntries(matchingEntries, sort, reversed, { printings: prices.printings, prices: prices.byKey }),
    [matchingEntries, sort, reversed, prices.printings, prices.byKey],
  );
  // Once the lookup arrives, save the missing details with the cards (once:
  // after that they have them, so there's nothing left to fill in)
  useEffect(() => {
    if (!prices.printings) return;
    const filled = fillDetails(cardsRef.current, prices.printings);
    if (filled && commit(filled)) scheduleDriveSave();
  }, [prices.printings, cards]);

  /* ----- The binder's size (worked out from the space on the screen) ----- */

  // The space the binder can fill (measured once it's drawn, and again
  // if the screen changes size, like a phone turned sideways)
  const [area, setArea] = useState({ width: 0, height: 0 });
  function onAreaLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width !== area.width || height !== area.height) setArea({ width, height });
  }

  // One page at a time on a phone, two on wider screens
  const perView = area.width >= TWO_PAGE_WIDTH ? 2 : 1;

  // How big a pocket can be: "widthFit" fills the space across, and
  // "heightFit" fits every row down.
  // - On the website, the whole page always fits on the screen (the
  //   smaller of the two), so it never scrolls.
  // - In the phone app with one page showing, pockets are always as wide
  //   as fits across, and a page too tall for the screen (like 3 across
  //   × 6 down) scrolls up and down. With two pages (a tablet, or a phone
  //   turned sideways), the page fits down too, unless that would make
  //   pockets smaller than MIN_POCKET_W: then it scrolls instead.
  // Then the size of a page and of the whole open binder.
  const widthFit = (area.width - 2 * COVER - (perView - 1) * SPINE - perView * (2 * PAD + (layout.across - 1) * GAP)) / (perView * layout.across);
  const heightFit = (area.height - BAR_HEIGHT - 2 * COVER - 2 * PAD - (layout.down - 1) * GAP) / layout.down / CARD_RATIO;
  const pocketFit = Platform.OS === 'web' ? Math.min(widthFit, heightFit)
    : perView === 1 ? widthFit : Math.min(widthFit, Math.max(heightFit, MIN_POCKET_W));
  const pocketW = Math.max(20, Math.floor(pocketFit));
  const pocketH = Math.floor(pocketW * CARD_RATIO);
  const pageW = 2 * PAD + layout.across * pocketW + (layout.across - 1) * GAP;
  const pageH = 2 * PAD + layout.down * pocketH + (layout.down - 1) * GAP;
  const binderW = 2 * COVER + perView * pageW + (perView - 1) * SPINE;
  const binderH = 2 * COVER + pageH;

  // The scrolling area the binder sits in (a tall page scrolls up and
  // down), and how far down it's scrolled right now
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  // Back to the top of the page (after a page turn)
  function scrollToTop() {
    scrollY.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  /* ----- Pages showing ----- */

  // The page shown first (on the left when two show). It starts on the
  // page named in the address, if any ("?page=3", e.g. after adding a
  // card in the Card Finder). With two pages showing, the left page is
  // always odd (1–2, 3–4…), like a real binder opened flat.
  const [currentPageState, setCurrentPage] = useState(() => {
    const start = parseInt(params.page ?? '', 10);
    if (start >= 1 && start <= totalPages) return start;
    // No page in the address: the page this binder was on when you left it
    const before = rememberedBinderPage(binderId);
    return before !== undefined && before >= 1 && before <= totalPages ? before : 1;
  });
  const currentPage = perView === 2 && currentPageState % 2 === 0 ? currentPageState - 1 : currentPageState;
  const currentRef = useRef(currentPage);
  currentRef.current = currentPage;
  // Remember the page, so coming back to this binder opens on it
  useEffect(() => { rememberBinderPage(binderId, currentPage); }, [binderId, currentPage]);
  const lastShown = Math.min(currentPage + perView - 1, totalPages);
  const shown = range(currentPage, lastShown);

  // A new "?page=" in the address (the Card Finder sent us back here
  // after adding a card): go to that page
  useEffect(() => {
    const page = parseInt(params.page ?? '', 10);
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }, [params.page]);

  // Download the pictures of the pages either side ahead of time
  useEffect(() => {
    const near = range(Math.max(1, currentPage - PICTURE_PAGES_AHEAD), Math.min(totalPages, lastShown + PICTURE_PAGES_AHEAD));
    const urls = Object.entries(cardsRef.current)
      .filter(([key]) => near.includes(pageOf(key)) && !shown.includes(pageOf(key)))
      .map(([, card]) => card.image);
    if (urls.length) Image.prefetch(urls, { headers: APP_HEADERS }).catch(() => { /* they'll download when shown */ });
  }, [currentPage, lastShown]);

  /* =====================================================================
     SAVING TO GOOGLE DRIVE
     The binder's real home is its file in Google Drive. This screen works
     on the device's copy and keeps Drive up to date:
     - When it opens, it fetches the binder from Drive (in case it was
       changed on another device), or sends this device's changes.
     - After each change, it saves to Drive a moment later.
     - If the Google sign-in has run out, changes are kept on this device
       and a "Connect Drive" button appears to sign in again and save.
     ===================================================================== */

  // The save status: 'saved', 'saving', 'error', or 'signed-out' (which
  // shows the Connect Drive button)
  const [status, setStatus] = useState<{ state: string; text: string }>({ state: '', text: '' });
  const driveSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A note to read out to screen readers once a change is saved (like
  // "✓ Moved to Blue, page 1"). Nothing is written on the screen: the
  // check mark in the header shows that it saved.
  const savedNote = useRef<string | null>(null);
  function sayNote() {
    if (savedNote.current) announce(savedNote.current.replace('✓ ', ''));
    savedNote.current = null;
  }
  // The finger resting on the binder, ready to drag (see startDrag), if
  // any: the pocket it's on (null between pockets), whether that pocket
  // has a card, whether the card has been picked up yet, when the finger
  // came down, how far it has moved sideways, and (once picked up) the
  // pocket the card would drop into
  const dragRef = useRef<{
    from: string | null; hasCard: boolean; lifted: boolean; startedAt: number; dx: number;
    target: string | null;
  } | null>(null);

  // Bring this binder up to date with Google Drive now.
  async function syncWithDrive() {
    clearTimeout(driveSaveTimer.current);
    if (isLocalMode()) {
      // Used locally: every change is already saved on this device.
      setStatus({ state: 'saved', text: 'Saved on this device.' });
      sayNote();
      return;
    }
    if (!isSignedIn()) {
      setStatus({ state: 'signed-out', text: binderDirtyStamp(binderId) ? 'Not saved to Drive yet' : '' });
      return;
    }
    setStatus({ state: 'saving', text: 'Saving…' });
    const before = JSON.stringify(cardsRef.current);
    try {
      const fresh = await syncBinder(binderId);
      // Drive had a different version (changed elsewhere): show that one.
      // (Not while a card is being dragged, so it doesn't vanish mid-drag.)
      if (!dragRef.current && JSON.stringify(fresh) !== before) {
        cardsRef.current = fresh;
        setCardsState(fresh);
      }
      setStatus({ state: 'saved', text: 'Saved to Google Drive.' });
      sayNote();
    } catch (err) {
      if (err instanceof DriveError && err.signedOut) {
        setStatus({ state: 'signed-out', text: 'Not saved to Drive yet' });
        return;
      }
      // No internet, or a Drive problem: the changes are safe on this
      // device, so say so, and try again in a while.
      setStatus({ state: 'error', text: err instanceof RequestError && err.offline
        ? 'Offline: changes are kept on this device'
        : 'Couldn\'t save to Google Drive yet: will try again' });
      driveSaveTimer.current = setTimeout(() => syncRef.current(), DRIVE_RETRY_MS);
    }
  }
  // The newest syncWithDrive, for timers set earlier
  const syncRef = useRef(syncWithDrive);
  syncRef.current = syncWithDrive;

  // After a change: save to Drive in a moment (restarting the wait if
  // more changes come in quickly).
  function scheduleDriveSave() {
    clearTimeout(driveSaveTimer.current);
    if (isLocalMode()) { syncWithDrive(); return; }
    if (!isSignedIn()) { setStatus({ state: 'signed-out', text: 'Not saved to Drive yet' }); return; }
    setStatus({ state: 'saving', text: 'Saving…' });
    driveSaveTimer.current = setTimeout(() => syncRef.current(), DRIVE_SAVE_DELAY_MS);
  }

  // When the screen opens: get Google's sign-in ready (for Connect Drive,
  // on the web) and bring the binder up to date. On the web, when the
  // internet comes back, save straight away if there are changes waiting.
  useEffect(() => {
    if (Platform.OS === 'web') initGoogleSignIn().catch(() => { /* the Connect button explains if needed */ });
    syncRef.current();
    const onOnline = () => {
      if (!isLocalMode() && binderDirtyStamp(binderId)) syncRef.current();
    };
    if (Platform.OS === 'web') window.addEventListener('online', onOnline);
    return () => {
      if (Platform.OS === 'web') window.removeEventListener('online', onOnline);
      clearTimeout(driveSaveTimer.current);
    };
  }, [binderId]);

  // "Connect Drive": sign in to Google again, then save.
  async function connectDrive() {
    try {
      await signInWithGoogle();
      syncWithDrive();
    } catch (err) {
      showMessage('Couldn\'t connect to Google Drive', (err as Error).message);
    }
  }

  /* =====================================================================
     TURNING PAGES
     The pages swing around the spine like a door on a hinge (in 3D): the
     old page swings away until it's edge-on, then the new page swings in
     from edge-on to flat. "turn" goes from 0 to 1 (or -1) and back to 0,
     and the animated style below turns that into the swing.
     ===================================================================== */

  const turn = useSharedValue(0);          // the swing: 0 is flat
  const swipeShift = useSharedValue(0);    // the pages follow a finger a little while swiping
  const [hinge, setHinge] = useState<'left' | 'right'>('left');
  const turning = useRef(false);

  // Move forward (+1) or back (-1): two pages at a time on wide screens.
  // Returns false if there's no page that way (or a turn is under way).
  function turnPage(direction: number): boolean {
    if (turning.current) return false;
    const target = currentRef.current + perView * direction;
    if (target < 1 || target > totalPages) return false;
    announce(`Page ${target} of ${totalPages}`);

    // A new page starts at its top, like opening to it in a real binder
    // (except while a card is being dragged across pages: it stays put,
    // so the card can be dropped at the same spot on the new page)
    const startAtTop = () => { if (!dragRef.current) scrollToTop(); };

    // No animation for "reduce motion" (a phone setting)
    if (reduceMotion) {
      setCurrentPage(target);
      currentRef.current = target;
      startAtTop();
      return true;
    }
    // First half: the old page swings away (around the spine on the
    // left going forward, on the right going back)...
    turning.current = true;
    setHinge(direction > 0 ? 'left' : 'right');
    turn.value = withTiming(direction, { duration: TURN_MS / 2 });
    setTimeout(() => {
      // ...halfway (edge-on, so nothing shows): swap to the new page...
      setCurrentPage(target);
      currentRef.current = target;
      startAtTop();
      turn.value = -direction;
      // ...and the second half: the new page swings in to lie flat
      turn.value = withTiming(0, { duration: TURN_MS / 2 });
      setTimeout(() => { turning.current = false; }, TURN_MS / 2);
    }, TURN_MS / 2);
    return true;
  }
  const turnRef = useRef(turnPage);
  turnRef.current = turnPage;

  /* ----- Going straight to a page you type in ----- */

  // Tapping the page number opens a small window with a box to type a page
  // number in. "goText" is what's typed so far, and "goError" the red
  // message under the box when it isn't a page this binder has.
  const [goOpen, setGoOpen] = useState(false);
  const [goText, setGoText] = useState('');
  const [goError, setGoError] = useState('');

  // Open the window, with the box empty
  function openGoToPage() {
    setGoText('');
    setGoError('');
    setGoOpen(true);
  }

  // Jump to the typed page. It must be a whole number from 1 to the last
  // page. The binder jumps straight there, with no page-turn swing (it
  // could be many pages away), and starts at the top of the page. (On a
  // wide screen two pages show, always starting on an odd one, so typing
  // 4 shows pages 3 and 4.)
  function goToPage() {
    const typed = goText.trim();
    const target = Number(typed);
    if (!/^\d+$/.test(typed) || target < 1 || target > totalPages) {
      setGoError(`Type a page number from 1 to ${totalPages}.`);
      return;
    }
    if (turning.current) return;   // a page is mid-turn: wait for it to finish
    setGoOpen(false);
    setCurrentPage(target);
    currentRef.current = perView === 2 && target % 2 === 0 ? target - 1 : target;
    scrollToTop();
    announce(`Page ${target} of ${totalPages}`);
  }

  // The swing, as a style: a 3D turn ("rotateY") seen from a little way
  // off ("perspective"), dimming as it goes edge-on, plus the small
  // follow-the-finger shift while swiping
  const pagesStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(turn.value) * 0.55,
    transform: [
      { perspective: 1400 },
      { translateX: swipeShift.value },
      { rotateY: `${-turn.value * 90}deg` },
    ],
  }));

  /* =====================================================================
     CHANGING CARDS
     ===================================================================== */

  // Move the card in one pocket to another (swapping with any card
  // there), and save. Returns false if saving isn't working.
  function moveCard(fromKey: string, toKey: string): boolean {
    const next = { ...cardsRef.current };
    const moving = next[fromKey];
    const swapped = next[toKey];
    next[toKey] = moving;
    if (swapped) next[fromKey] = swapped;
    else delete next[fromKey];
    if (!commit(next)) {
      showMessage('Couldn\'t save', 'Saving isn\'t working on this device, so the card could not be moved.');
      return false;
    }
    scheduleDriveSave();
    announce(`Moved ${moving.name} to ${placeName(toKey)}.` + (swapped ? ` ${swapped.name} moved to ${placeName(fromKey)}.` : ''));
    return true;
  }

  // Take a card out of its pocket (all its copies), and save.
  function removeCard(key: string) {
    const next = { ...cardsRef.current };
    const card = next[key];
    if (!card) return;
    delete next[key];
    if (!commit(next)) { showMessage('Couldn\'t save', 'Saving isn\'t working on this device, so the card could not be removed.'); return; }
    scheduleDriveSave();
    announce(`Removed ${card.name}.`);
  }

  // One more (+1) or one fewer (-1) copy. One fewer on the last copy asks
  // first ("Remove card?") instead. Returns the new number (0 when the
  // Remove window was opened).
  function changeCopies(key: string, step: number): number {
    const card = cardsRef.current[key];
    if (!card) return 0;
    const count = cardCount(card);
    if (step < 0 && count === 1) { setRemovingKey(key); return 0; }
    const now = step > 0 ? Math.min(count + 1, MAX_COPIES) : count - 1;
    if (!commit({ ...cardsRef.current, [key]: withCount(card, now) })) {
      showMessage('Couldn\'t save', 'Saving isn\'t working on this device, so the number could not be changed.');
      return count;
    }
    scheduleDriveSave();
    announce(`${now} ${now === 1 ? 'copy' : 'copies'} of ${card.name}.`);
    return now;
  }
  // Versions that never change between redraws, for the pockets (so the
  // pockets don't all redraw every time something changes)
  const changeCopiesRef = useRef(changeCopies);
  changeCopiesRef.current = changeCopies;
  const onCopies = useCallback((key: string, step: number) => { changeCopiesRef.current(key, step); }, []);

  // Open a pocket: its card in the Card Finder (or, empty, the Card
  // Finder ready to pick a card for it)
  const openPocket = useCallback((key: string) => {
    setHighlightKey(null);
    router.push(searchLinkFor(binderId, key, cardsRef.current[key]) as never);
  }, [binderId]);

  // Tapping a pocket opens it. A tap while a finger is resting on the
  // binder, or right after one let go, doesn't count: the drag code
  // below has already dealt with that touch.
  const lastHoldEnd = useRef(0);
  const onOpen = useCallback((key: string) => {
    if (dragRef.current || Date.now() - lastHoldEnd.current < 400) return;
    openPocket(key);
  }, [openPocket]);

  // The red "+" (List and Grid views): the Card Finder, aimed at this
  // binder's next available spot, the first empty pocket. If every pocket
  // is full, a page is added at the end first and its first pocket is used.
  function addCards() {
    const spot = nextSpot();
    router.push(searchLinkFor(binderId, pocketKey(spot.page, spot.slot)) as never);
  }

  // This binder's next available spot: its first empty pocket. If every
  // pocket is full, a page is added at the end first and its first pocket is
  // used.
  function nextSpot(): { page: number; slot: number } {
    const found = firstEmptyPocket(cardsRef.current, totalPages);
    if (found) return found;
    const pages = totalPages + 1;
    const list = loadBinderList();
    const entry = list.find((b) => b.id === binderId);
    if (entry) {
      entry.pages = pages;
      saveBinderList(list);
      // Tell the account (or Drive) about the new page; if that can't be
      // reached now, the card's save later will carry it
      updateBinderDetails(binderId, { pages }).catch(() => { /* retried when the card is saved */ });
    }
    return { page: pages, slot: 1 };
  }

  // Are there empty pockets with cards after them? (Clean-up has something to do.)
  // The cards fill pockets 1, 2, 3... in order when there are no gaps, so a
  // gap means some card sits further along than the number of cards.
  const hasGaps = useMemo(() => {
    const count = Object.keys(cards).length;
    return Object.keys(cards).some((key) => (pageOf(key) - 1) * perPage + slotOf(key) > count);
  }, [cards, perPage]);

  // Clean-up (Binder view): after asking, move every card forward, keeping
  // their order (page by page, pocket by pocket), so all the empty pockets
  // are at the end. The number of pages stays as it is.
  async function cleanUp() {
    if (!hasGaps) return;
    const yes = await askYesNo('Clean up this binder?',
      'Every card moves forward to fill the empty pockets, keeping its order. The empty pockets end up at the end.',
      'Clean up', 'Cancel');
    if (!yes) return;
    const ordered = Object.entries(cardsRef.current).sort(([a], [b]) => pageOf(a) - pageOf(b) || slotOf(a) - slotOf(b));
    const next: BinderCards = {};
    ordered.forEach(([, card], index) => {
      next[pocketKey(Math.floor(index / perPage) + 1, (index % perPage) + 1)] = card;
    });
    if (!commit(next)) {
      showMessage('Couldn\'t save', 'Saving isn\'t working on this device, so the cards could not be moved.');
      return;
    }
    scrollToTop();
    announce('Cards moved together');
  }

  // The windows: the card's menu, "Remove card?" and "Move card to…"
  // (each with the pocket it's about), the reminder, and Keyboard shortcuts
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [movingKey, setMovingKey] = useState<string | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // The copies are safely in the other binder: take them out of this one
  // (the whole card if all went, otherwise just lower its count), close
  // the window, and save this binder too.
  function takeMovedCardOut(key: string, note: string, amount: number) {
    const next = { ...cardsRef.current };
    const left = cardCount(next[key]) - amount;
    if (left > 0) next[key] = withCount(next[key], left);
    else delete next[key];
    commit(next);
    setMovingKey(null);
    savedNote.current = note;   // read out once saved
    scheduleDriveSave();
  }

  /* =====================================================================
     GESTURES: SWIPING PAGES, AND HOLDING AND DRAGGING CARDS
     Two finger gestures watch the whole binder, and whichever starts
     first wins ("competing"):
     - the swipe: a finger that slides sideways straight away (it gives
       up if it goes up or down first)
     - the drag: a finger that rests still for REST_MS first. Then, on a
       card, moving picks the card up; letting go without moving opens
       the card (or, held for MENU_HOLD_MS, its menu). Not on a card, it
       works like a slow swipe.
     Where the finger is, is worked out from the binder's measurements
     (which page, which row and column), so no pocket needs its own.
     ===================================================================== */

  // The pocket at a point inside the binder (any pocket, or null)
  function pocketAt(x: number, y: number): string | null {
    const pages = range(currentRef.current, Math.min(currentRef.current + perView - 1, totalPages));
    for (let i = 0; i < pages.length; i++) {
      const left = COVER + i * (pageW + SPINE) + PAD;
      const px = x - left;
      const py = y - COVER - PAD;
      if (px < 0 || py < 0) continue;
      const column = Math.floor(px / (pocketW + GAP));
      const row = Math.floor(py / (pocketH + GAP));
      if (column < layout.across && row < layout.down) return pocketKey(pages[i], row * layout.across + column + 1);
    }
    return null;
  }

  // Where things are on the screen ("in the window"), measured when a
  // finger comes to rest: the space the binder fills (the floating card
  // is drawn there) and the scrolling part of it (for scrolling while
  // dragging)
  type Box = { x: number; y: number; width: number; height: number };
  const areaRef = useRef<ComponentRef<typeof View>>(null);
  const boxes = useRef<{ area?: Box; scroll?: Box }>({});
  function measureBoxes() {
    // "save" makes the function that keeps one measurement once it arrives
    const save = (name: 'area' | 'scroll') => (x: number, y: number, width: number, height: number) => {
      boxes.current[name] = { x, y, width, height };
    };
    areaRef.current?.measureInWindow(save('area'));
    scrollRef.current?.measureInWindow(save('scroll'));
  }

  // The card being dragged (its pocket), the pocket it would drop into,
  // and the edge it's held at (-1 left, 1 right)
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const edgeRef = useRef(0);
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The floating copy of the card that follows the finger (where it is
  // in the binder's space)
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const startPoint = useRef({ x: 0, y: 0 });
  // While a finger rests on the binder, the page can't scroll (so moving
  // it drags the card instead)
  const [holding, setHolding] = useState(false);

  // SCROLLING WHILE DRAGGING: holding a card near the top or bottom of
  // the binder's space scrolls the page that way, a little at a time,
  // until the card moves away from the edge or the page can't go further.
  // "lastPoint" is the finger's latest place on the page (it moves down
  // the page as the page scrolls up under a still finger).
  const scrollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const scrollDirection = useRef(0);
  const lastPoint = useRef({ x: 0, y: 0, absX: 0, absY: 0 });
  function setScrollDirection(next: number) {
    if (next === scrollDirection.current) return;
    scrollDirection.current = next;
    clearInterval(scrollTimer.current);
    if (next === 0) return;
    scrollTimer.current = setInterval(() => {
      const box = boxes.current.scroll;
      const most = Math.max(0, binderH - (box?.height ?? 0));   // how far down it can go
      const to = Math.min(most, Math.max(0, scrollY.current + scrollDirection.current * SCROLL_STEP));
      if (to === scrollY.current) return;
      const moved = to - scrollY.current;
      scrollY.current = to;
      scrollRef.current?.scrollTo({ y: to, animated: false });
      // The finger hasn't moved, but the page has: check what's under it now
      const p = lastPoint.current;
      moveDrag(p.x, p.y + moved, p.absX, p.absY);
    }, SCROLL_EVERY_MS);
  }

  // Start or stop the "turn the page" countdown when the card reaches or
  // leaves an edge. While it's held there, the page keeps turning.
  function setEdge(next: number) {
    if (next === edgeRef.current) return;
    edgeRef.current = next;
    clearTimeout(edgeTimer.current);
    if (next !== 0) edgeTimer.current = setTimeout(turnFromEdge, EDGE_WAIT_MS);
  }
  function turnFromEdge() {
    if (!dragRef.current || edgeRef.current === 0) return;
    turnRef.current(edgeRef.current);   // does nothing at the first or last page
    edgeTimer.current = setTimeout(turnFromEdge, TURN_MS + EDGE_WAIT_MS);
  }

  // The finger has rested on the binder for REST_MS without moving: note
  // where it is, ready for it to move. (Nothing lifts yet: see moveDrag.)
  function startDrag(x: number, y: number) {
    if (turning.current) return;
    const from = pocketAt(x, y);
    dragRef.current = {
      from, hasCard: Boolean(from && cardsRef.current[from]), lifted: false,
      startedAt: Date.now() - REST_MS, dx: 0, target: null,
    };
    startPoint.current = { x, y };
    setHolding(true);
    measureBoxes();
  }

  // Mouse or finger? (They drag differently: see the gestures below.)
  const withMouse = usePointerKind() === 'mouse';

  // With a mouse, holding the button down on a card without moving opens
  // its menu (a finger gets the same from the drag code below)
  const onHoldPocket = useCallback((key: string) => {
    if (cardsRef.current[key]) setMenuKey(key);
  }, []);

  // The resting finger moved. x and y are its place on the page; absX
  // and absY its place on the screen.
  function moveDrag(x: number, y: number, absX: number, absY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    lastPoint.current = { x, y, absX, absY };
    drag.dx = x - startPoint.current.x;
    // Not on a card: the pages follow the finger, like a swipe
    if (!drag.hasCard) {
      swipeShift.value = drag.dx * 0.3;
      return;
    }
    // On a card: once the finger has moved a little, pick the card up
    // (a small buzz on most phones), and from then on it follows the finger
    if (!drag.lifted) {
      if (Math.hypot(drag.dx, y - startPoint.current.y) < LIFT_DISTANCE) return;
      drag.lifted = true;
      hapticTap();
      setHighlightKey(null);
      setDragFrom(drag.from);
    }
    // The card follows the finger, and the pocket under it lights up
    const area = boxes.current.area;
    ghostX.value = absX - (area?.x ?? 0);
    ghostY.value = absY - (area?.y ?? 0);
    const target = pocketAt(x, y);
    drag.target = target;
    setDragTarget(target && target !== drag.from ? target : null);
    // At the left or right edge of the binder: turn the page (see setEdge)
    const nearHeight = y > -40 && y < binderH + 20;
    setEdge(nearHeight && x < EDGE_ZONE ? -1 : nearHeight && x > binderW - EDGE_ZONE ? 1 : 0);
    // Near the top or bottom of the scrolling space: scroll the page that way
    const box = boxes.current.scroll;
    setScrollDirection(!box ? 0
      : absY < box.y + SCROLL_EDGE ? -1
      : absY > box.y + box.height - SCROLL_EDGE && absY < box.y + box.height ? 1 : 0);
  }

  // The finger let go. (This also runs at the end of every plain tap and
  // swipe, when no finger rested: then it stops early, and the tap or
  // swipe does its usual job.)
  function endDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragFrom(null);
    setDragTarget(null);
    setEdge(0);
    setScrollDirection(0);
    setHolding(false);
    if (!drag) return;
    // This touch is dealt with here, so the pocket's own tap mustn't
    // count it too
    lastHoldEnd.current = Date.now();
    const from = drag.from;

    // Not on a card: moved far enough sideways, turn the page; barely
    // moved, it was a slow tap on an empty pocket, so open it
    if (!drag.hasCard || !from) {
      swipeShift.value = withTiming(0, { duration: 150 });
      if (Math.abs(drag.dx) >= SWIPE_DISTANCE) turnRef.current(drag.dx < 0 ? 1 : -1);
      else if (from && Math.abs(drag.dx) < LIFT_DISTANCE) openPocket(from);
      return;
    }

    // On a card that never moved: a long hold opens its menu, a shorter
    // one opens the card (like a tap)
    if (!drag.lifted) {
      if (Date.now() - drag.startedAt >= MENU_HOLD_MS) setMenuKey(from);
      else openPocket(from);
      return;
    }

    // A picked-up card: move it to the pocket it's over, or (anywhere
    // else) it goes back where it was. (Removing it, or moving it to
    // another binder, is in its menu: hold it still.)
    if (drag.target && drag.target !== from) moveCard(from, drag.target);
  }

  // The swipe: the pages follow the finger a little; let go far enough
  // (or fast enough) sideways and the page turns. "runOnJS" runs these
  // in the app's normal code, so they can use everything above.
  const swipe = usePanGesture({
    runOnJS: true,
    // With a mouse there's no swiping: pressing and moving drags instead
    enabled: !withMouse,
    activeOffsetX: [-20, 20],
    failOffsetY: [-15, 15],
    onUpdate: (event) => { swipeShift.value = event.translationX * 0.3; },
    onDeactivate: (event) => {
      swipeShift.value = withTiming(0, { duration: 150 });
      if (Math.abs(event.translationX) >= SWIPE_DISTANCE || Math.abs(event.velocityX) >= SWIPE_SPEED) {
        turnRef.current(event.translationX < 0 ? 1 : -1);   // moved left = forward, like a book
      }
    },
  });

  // Rest, then drag (see startDrag, moveDrag and endDrag above). With a
  // finger, it only starts if the finger stays still for REST_MS; moving
  // sooner makes it give up, so the swipe gets the finger instead. With
  // a mouse, it starts as soon as the mouse moves LIFT_DISTANCE with the
  // button held down (from where the button was pressed), and the card
  // lifts straight away.
  const drag = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: withMouse ? 0 : REST_MS,
    minDistance: withMouse ? LIFT_DISTANCE : undefined,
    onActivate: (event) => {
      if (!withMouse) {
        startDrag(event.x, event.y);
        return;
      }
      startDrag(event.x - event.translationX, event.y - event.translationY);
      moveDrag(event.x, event.y, event.absoluteX, event.absoluteY);
    },
    onUpdate: (event) => moveDrag(event.x, event.y, event.absoluteX, event.absoluteY),
    onFinalize: () => endDrag(),
  });
  const gestures = useCompetingGestures(drag, swipe);

  // The floating card's position: centered on the finger, tilted a little
  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ghostX.value - pocketW * 0.6 }, { translateY: ghostY.value - pocketH * 0.6 }, { rotate: '4deg' }],
  }));

  /* =====================================================================
     A CARD FOUND WITH THE SEARCH BAR
     The search bar opens a binder with "highlight=3-5" in the address:
     turn to that pocket's page and make it glow (until the next touch).
     ===================================================================== */

  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  // Tapping a card among the search matches (Binder view): empty the search,
  // turn to that card's page and make its pocket glow
  function jumpTo(key: string) {
    setQuery('');
    setClearToken((token) => token + 1);
    setCurrentPage(pageOf(key));
    setHighlightKey(key);
  }
  useEffect(() => {
    const key = params.highlight;
    if (!key || !/^\d+-\d+$/.test(key)) return;
    const page = pageOf(key);
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setHighlightKey(key);
  }, [params.highlight, totalPages]);
  // On a page taller than the screen, scroll so the found pocket shows
  // (its row a little below the top). It waits a moment for the page to
  // be drawn first.
  useEffect(() => {
    if (!highlightKey || pocketH <= 0) return;
    const slot = Number(highlightKey.split('-')[1]);
    const row = Math.floor((slot - 1) / layout.across);
    const y = Math.max(0, COVER + PAD + row * (pocketH + GAP) - 40);
    const timer = setTimeout(() => {
      scrollY.current = y;
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightKey, pocketH, layout.across]);
  // The glow pulses gently (fading in and out, over and over)
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.value = highlightKey ? withRepeat(withTiming(0.35, { duration: 700 }), -1, true) : 1;
  }, [highlightKey]);

  /* =====================================================================
     DROPPING CARD PICTURES FROM OTHER WEBSITES (computers: see
     hooks/useCardDrop.web.ts and lib/cardDrop.ts)
     ===================================================================== */

  // The empty pocket a picture is being dragged over, and the pocket
  // waiting for Scryfall to say which card was dropped on it
  const [outsideTarget, setOutsideTarget] = useState<string | null>(null);
  const [dropLoading, setDropLoading] = useState<string | null>(null);
  const binderRef = useRef<ComponentRef<typeof View>>(null);
  useCardDrop({
    binderRef,
    emptyPocketAt: (x, y) => {
      const key = pocketAt(x, y);
      return key && !cardsRef.current[key] ? key : null;
    },
    onOver: setOutsideTarget,
    onDrop: (dataTransfer, key) => { handleOutsideDrop(dataTransfer, key); },
  });

  // Dropped on an empty pocket: look the card up and put it there.
  async function handleOutsideDrop(dataTransfer: DataTransfer, key: string) {
    const lookup = lookupFromDrop(dataTransfer);
    if (!lookup) {
      setStatus({ state: 'error', text: 'That isn\'t a card picture from Scryfall or EDHREC' });
      return;
    }
    setDropLoading(key);
    setStatus({ state: 'saving', text: 'Finding the card…' });
    try {
      const card = binderCardFrom(await loadOneCard(lookup.path), lookup.face);
      // Something else may have filled the pocket while we waited.
      if (cardsRef.current[key]) throw new Error('That pocket was filled in the meantime.');
      if (!commit({ ...cardsRef.current, [key]: card })) {
        throw new Error('Saving isn\'t working on this device, so the card could not be added.');
      }
      savedNote.current = `✓ Added ${card.name}`;   // shown once it's saved
      scheduleDriveSave();
      announce(`Added ${card.name} to ${placeName(key)}.`);
    } catch (err) {
      setStatus({ state: 'error', text: (err as Error).message });
    } finally {
      setDropLoading(null);
    }
  }

  /* =====================================================================
     DROPPING A PICTURE ON THE LIST OR GRID (computers: see
     hooks/useCardAreaDrop.web.ts). Let go anywhere over the cards and the
     card is added: one more copy if that exact printing is already here,
     otherwise in the binder's next available pocket. The view shows it
     wherever the sort in use puts it, scrolls to it, and highlights it for
     a moment.
     ===================================================================== */

  const listAreaRef = useRef<ComponentRef<typeof View>>(null);
  const [dropOver, setDropOver] = useState(false);
  // The card just added (highlighted and scrolled to) and the note about it
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [addedNote, setAddedNote] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function flash(key: string, note: string) {
    setFlashKey(key);
    setAddedNote(note);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => { setFlashKey(null); setAddedNote(null); }, 3000);
  }
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  useCardAreaDrop({
    areaRef: listAreaRef,
    enabled: mode !== 'binder',
    onOver: setDropOver,
    onDrop: (dataTransfer) => { handleAreaDrop(dataTransfer); },
  });

  async function handleAreaDrop(dataTransfer: DataTransfer) {
    // (Read what was dropped now: the browser only allows it right away.)
    const lookup = lookupFromDrop(dataTransfer);
    if (!lookup) {
      setStatus({ state: 'error', text: 'That isn\'t a card picture from Scryfall or EDHREC' });
      return;
    }
    setStatus({ state: 'saving', text: 'Finding the card…' });
    try {
      const card = binderCardFrom(await loadOneCard(lookup.path), lookup.face);
      // The same printing (and finish) already here: one more copy of it
      const have = Object.entries(cardsRef.current).find(([, existing]) => samePrinting(existing, card));
      let key: string;
      let next: BinderCards;
      if (have) {
        key = have[0];
        if (cardCount(have[1]) >= MAX_COPIES) throw new Error(`You already have ${MAX_COPIES} copies of ${card.name}.`);
        next = { ...cardsRef.current, [key]: withCount(have[1], cardCount(have[1]) + 1) };
      } else {
        const spot = nextSpot();
        key = pocketKey(spot.page, spot.slot);
        next = { ...cardsRef.current, [key]: card };
      }
      if (!commit(next)) throw new Error('Saving isn\'t working on this device, so the card could not be added.');
      savedNote.current = `✓ Added ${card.name}`;   // shown once it's saved
      scheduleDriveSave();
      flash(key, `✓ Added ${card.name}${have ? ' (one more copy)' : ''}`);
      announce(`Added ${card.name}${have ? ', one more copy' : ''}.`);
    } catch (err) {
      setStatus({ state: 'error', text: (err as Error).message });
    }
  }

  /* =====================================================================
     KEYS ON A COMPUTER (anywhere on the screen, not while typing)
       ← → PgUp PgDn   turn the page
       D               download this binder as a .csv file
       ?               the Keyboard shortcuts window
     ===================================================================== */

  useShortcutKeys((event) => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      if (!turnPage(1)) announce('This is the last page.');
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      if (!turnPage(-1)) announce('This is the first page.');
    } else if (event.key === '?') {
      event.preventDefault();
      setShortcutsOpen(true);
    } else if (event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      downloadBinderCsv(binderId);
      announce(`Downloading ${binderName(binderId)}.`);
    }
  });

  /* =====================================================================
     REMINDERS (the bell in the header: see lib/reminders.ts)
     ===================================================================== */

  // Schedule a reminder about this binder, "seconds" from now. The first
  // time, the phone asks whether the app may send notifications.
  async function remind(seconds: number, when: string) {
    setRemindOpen(false);
    try {
      const ok = await scheduleReminder(
        `Time to sort your cards`,
        `Your binder "${binderName(binderId)}" is waiting for its new cards.`,
        seconds,
      );
      if (ok) { hapticTap(); announce(`Reminder set for ${when}`); }
      else showMessage('Notifications are off', 'To get reminders, allow notifications for WUBRG\'r in your phone\'s Settings.');
    } catch (err) {
      showMessage('Couldn\'t set the reminder', (err as Error).message);
    }
  }

  /* =====================================================================
     THE HEADER: the binder's name with its save check mark (green when
     everything is saved, red while it isn't), then the keyboard shortcuts
     (computers), download, reminder and Help buttons. "useLayoutEffect"
     sets it before the screen first shows.
     ===================================================================== */

  // Tapping the check mark says what it means: saved (and where), or why
  // not. Signed out of Google: offer to connect again.
  async function explainStatus() {
    if (status.state === 'signed-out') {
      const yes = await askYesNo('Not saved to Google Drive yet',
        'Your Google sign-in has run out. Your changes are kept on this device until you connect again.',
        'Connect Drive', 'Not now');
      if (yes) connectDrive();
      return;
    }
    if (status.state === 'saved') showMessage('Saved', status.text);
    else showMessage('Not saved yet', status.text || 'Saving…');
  }

  const saved = status.state === 'saved';
  useLayoutEffect(() => {
    if (!binder) return;
    navigation.setOptions({
      title: binder.name,
      // The name, then the check mark
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{binder.name}</Text>
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
          <ShelfSwitch current="binders" />
          {/* Keyboard shortcuts (computers only) */}
          {showKeyHints && (
            <Pressable accessibilityRole="button" accessibilityLabel="Keyboard shortcuts" hitSlop={6}
                       onPress={() => setShortcutsOpen(true)}
                       style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
              <Ionicons name="keypad-outline" size={22} color={colors.text} />
            </Pressable>
          )}
          <HelpButton topic="binder" />
        </View>
      ),
    });
  }, [navigation, binder?.name, colors, saved, status.text, status.state, showKeyHints]);

  /* =====================================================================
     DRAWING THE SCREEN
     ===================================================================== */

  // Not using the binders: the shelf shows how to start. A binder that
  // isn't in the list (deleted, or from someone else's account): the shelf.
  if (!usingBinders || !binder) return <Redirect href="/binders" />;

  const draggedCard = dragFrom ? cards[dragFrom] : undefined;
  const menuCard = menuKey ? cards[menuKey] : undefined;
  const removing = removingKey ? cards[removingKey] : undefined;
  const moving = movingKey ? cards[movingKey] : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      {/* Search the cards in this binder (or, with its switch, the whole
          shelf) */}
      <View style={styles.top}>
        <BinderSearch currentBinderId={binderId} onQuery={setQuery} clearToken={clearToken} />
        {/* List / Grid / Binder, and the sort (or Clean-up in the Binder view) */}
        <ViewSwitch
          mode={mode} sort={sort} reversed={reversed} onCleanUp={cleanUp} canCleanUp={hasGaps}
          extras={(
            <>
              {/* Save (or share) the binder as a .csv file */}
              <ToolButton icon="download-outline" label={`Download ${binder.name} as a .CSV file`}
                          onPress={() => downloadBinderCsv(binderId).catch((err) => showMessage('Couldn\'t save the file', (err as Error).message))} />
              {/* Set a reminder about this binder */}
              <ToolButton icon="notifications-outline" label="Remind me about this binder"
                          onPress={() => (REMINDERS_AVAILABLE ? setRemindOpen(true)
                            : showMessage('Reminders are in the phone app', 'Open WUBRG\'r on your phone to set reminders: they arrive as phone notifications.'))} />
            </>
          )}
        />
      </View>

      {/* The Binder view's own summary line, above the pockets: how many
          cards, how many different, and what they're worth (the List and
          Grid views show it as part of their list) */}
      {mode === 'binder' && !searching && baseEntries.length > 0 && (
        <View style={styles.summaryRow}>
          <Summary entries={baseEntries} prices={prices} />
        </View>
      )}

      {/* THE LIST OR GRID of cards. Tapping a card opens its menu. The red
          "+" floats over them in the corner. */}
      {(mode !== 'binder' || searching) && (
        <View ref={listAreaRef} style={styles.listArea} collapsable={false}>
          <CardList
            entries={entries}
            flashKey={flashKey}
            note={addedNote}
            // Searching in the Binder view: just the matching cards, as a grid
            mode={mode === 'binder' ? 'grid' : mode}
            width={contentWidth}
            // In the Binder view a tap jumps to the card's pocket; elsewhere it opens the card's menu
            onPick={(key) => (mode === 'binder' ? jumpTo(key) : setMenuKey(key))}
            onCopies={onCopies}
            minTile={GRID_ZOOM_WIDTHS[gridZoom]}
            prices={prices}
            searchOf={searching ? baseEntries.length : undefined}
            hint={searching && mode === 'binder' ? 'tap one to jump to it' : undefined}
            empty={(
              <View style={styles.emptyList}>
                <Text style={[styles.dialogText, { color: colors.muted }]}>
                  {searching ? `No cards in this binder match "${query.trim()}".` : 'No cards in this binder yet. Tap the red + to add some.'}
                </Text>
              </View>
            )}
          />
          {mode !== 'binder' && <AddCardsButton onPress={addCards} />}
          {/* A picture is being dragged over the cards: outline them */}
          {dropOver && <View pointerEvents="none" style={[styles.dropOutline, { borderColor: colors.accent }]} />}
        </View>
      )}

      {/* The space the binder fills (measured, so it can be sized to fit):
          the Binder view's pockets */}
      {mode === 'binder' && !searching && (
      <View ref={areaRef} style={styles.area} onLayout={onAreaLayout} collapsable={false}>
        {area.width > 0 && (<>
          {/* The page scrolls up and down when it's taller than the space
              (a long layout like 3 × 6). It can't scroll while a finger
              rests on a card (that finger is dragging the card instead). */}
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!holding}
            scrollEventThrottle={16}
            onScroll={(event) => { scrollY.current = event.nativeEvent.contentOffset.y; }}
          >
            {/* "pan-y" lets a phone's web browser scroll the page up and down
                itself; sideways swipes still come to the gestures */}
            <GestureDetector gesture={gestures} touchAction="pan-y">
              <View ref={binderRef} style={{ width: binderW, height: binderH }} collapsable={false}
                    onTouchStart={() => setHighlightKey(null)}>
                {/* THE OPEN BINDER: the black cover with the page(s) lying on it */}
                <View style={[styles.binder, { width: binderW, height: binderH, boxShadow: colors.binderShadow, backgroundColor: colors.binderCover }]}
                      accessibilityLabel={`${binder.name}, ${shown.length > 1 ? `pages ${currentPage} and ${lastShown}` : `page ${currentPage}`} of ${totalPages}`}>
                  <Animated.View style={[styles.pages, { transformOrigin: hinge === 'left' ? 'left' : 'right' }, pagesStyle]}>
                    {shown.map((n, i) => (
                      <View key={n} style={[styles.page, { width: pageW, height: pageH, marginLeft: i > 0 ? SPINE : 0, backgroundColor: colors.binderPage }]}
                            accessibilityLabel={`Page ${n}`}>
                        {range(1, perPage).map((slot) => {
                          const key = pocketKey(n, slot);
                          const isHighlighted = highlightKey === key;
                          const pocket = (
                            <Pocket
                              pocketKey={key}
                              page={n}
                              slot={slot}
                              card={cards[key]}
                              width={pocketW}
                              height={pocketH}
                              loaded
                              faded={dragFrom === key}
                              outlined={dragTarget === key || outsideTarget === key}
                              loading={dropLoading === key}
                              highlighted={isHighlighted}
                              accent={colors.accent}
                              onOpen={onOpen}
                              onHold={withMouse ? onHoldPocket : undefined}
                              onCopies={onCopies}
                            />
                          );
                          return (
                            <View key={slot} style={{ marginRight: slot % layout.across ? GAP : 0, marginBottom: GAP }}>
                              {isHighlighted ? <GlowingPocket glow={glow}>{pocket}</GlowingPocket> : pocket}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </Animated.View>
                </View>
              </View>
            </GestureDetector>
          </ScrollView>

          {/* Under the binder (it stays put while the page scrolls):
              Previous / Next with the page number between them */}
          <View style={[styles.bar, { width: binderW, height: BAR_HEIGHT }]}>
            <View style={styles.pageNav}>
              {/* Small arrow buttons (with extra room around them to tap) */}
              <Pressable accessibilityRole="button" accessibilityLabel="Previous page" hitSlop={10}
                         disabled={currentPage <= 1} onPress={() => turnPage(-1)}
                         style={({ pressed }) => [styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border },
                                                  pressed && styles.pressed, currentPage <= 1 && styles.navOff]}>
                <Ionicons name="chevron-back" size={14} color={colors.text} />
              </Pressable>
              {/* "Page 3 of 10" on a phone, "Pages 3–4 of 10" on wider screens.
                  Tapping it opens "Go to page", to type a page number. */}
              <Pressable accessibilityRole="button" accessibilityLabel="Go to page" hitSlop={8}
                         onPress={openGoToPage} style={styles.pageStatusButton}>
                <Text style={[styles.pageStatus, { color: colors.text }]} accessibilityLiveRegion="polite">
                  {currentPage === lastShown ? `Page ${currentPage} of ${totalPages}` : `Pages ${currentPage}–${lastShown} of ${totalPages}`}
                </Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Next page" hitSlop={10}
                         disabled={lastShown >= totalPages} onPress={() => turnPage(1)}
                         style={({ pressed }) => [styles.navButton, { backgroundColor: colors.surface, borderColor: colors.border },
                                                  pressed && styles.pressed, lastShown >= totalPages && styles.navOff]}>
                <Ionicons name="chevron-forward" size={14} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* The floating copy of the card that follows the finger, over
              everything in the binder's space (the page and the strip) */}
          {draggedCard && (
            <Animated.View pointerEvents="none"
                           style={[styles.ghost, { width: pocketW * 1.2, height: pocketH * 1.2, boxShadow: colors.cardShadowLift },
                                   ghostStyle]}>
              <Image source={pictureSource(draggedCard.image)} style={styles.ghostPicture} contentFit="cover" />
            </Animated.View>
          )}
        </>)}
      </View>
      )}

      {/* THE CARD'S MENU (hold a card and let go without dragging): its
          picture, how many copies, and what can be done with it */}
      {menuCard && menuKey && (
        <PopupWindow title={menuCard.name} onClose={() => setMenuKey(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuKey(null), kind: 'secondary' }]}>
          <Image source={pictureSource(menuCard.image)} style={styles.menuPicture} contentFit="contain" />
          <Text style={[styles.menuWhere, { color: colors.muted }]}>
            {mode === 'binder' ? placeName(menuKey) : ''}{mode === 'binder' && menuCard.foil ? ' · ' : ''}{menuCard.foil ? 'foil' : ''}
          </Text>
          {/* How many copies: − and + */}
          <View style={styles.menuCopies}>
            <Button label="−" kind="secondary" accessibilityLabel="One fewer copy"
                    onPress={() => { if (changeCopies(menuKey, -1) === 0) setMenuKey(null); }} />
            <Text style={[styles.menuCount, { color: colors.text }]}>
              {cardCount(menuCard)} {cardCount(menuCard) === 1 ? 'copy' : 'copies'}
            </Text>
            <Button label="+" kind="secondary" accessibilityLabel="One more copy" disabled={cardCount(menuCard) >= MAX_COPIES}
                    onPress={() => changeCopies(menuKey, 1)} />
          </View>
          <Button label="Open in Card Finder" icon="search" kind="secondary"
                  onPress={() => { const key = menuKey; setMenuKey(null); router.push(searchLinkFor(binderId, key, menuCard) as never); }} />
          <Button label="Move to another binder" icon="folder-open-outline" kind="secondary"
                  onPress={() => { setMovingKey(menuKey); setMenuKey(null); }} />
          <Button label="Remove from this binder" icon="trash-outline" kind="danger"
                  onPress={() => { setRemovingKey(menuKey); setMenuKey(null); }} />
        </PopupWindow>
      )}

      {/* "Remove card?": "No" comes first, the safe choice */}
      {removing && removingKey && (
        <PopupWindow
          title="Remove card?"
          onClose={() => setRemovingKey(null)}
          buttons={[
            { label: 'No', onPress: () => setRemovingKey(null), kind: 'secondary' },
            { label: 'Yes, remove', kind: 'danger', onPress: () => { removeCard(removingKey); setRemovingKey(null); } },
          ]}
        >
          <Text style={[styles.dialogText, { color: colors.text }]}>Remove "{removing.name}" from this binder?</Text>
        </PopupWindow>
      )}

      {moving && movingKey && (
        <MoveCardDialog
          binderId={binderId}
          card={moving}
          onMoved={(note, amount) => takeMovedCardOut(movingKey, note, amount)}
          onCancel={() => setMovingKey(null)}
        />
      )}

      {/* "Remind me": when the reminder should arrive */}
      {remindOpen && (
        <PopupWindow title="Remind me about this binder" onClose={() => setRemindOpen(false)}
                     buttons={[{ label: 'Cancel', onPress: () => setRemindOpen(false), kind: 'secondary' }]}>
          <Text style={[styles.dialogText, { color: colors.text }]}>
            Get a notification reminding you to sort new cards into "{binder.name}".
          </Text>
          <Button label="In 10 seconds (try it out)" icon="timer-outline" kind="secondary" onPress={() => remind(10, 'in 10 seconds')} />
          <Button label="In 1 hour" icon="time-outline" kind="secondary" onPress={() => remind(60 * 60, 'in 1 hour')} />
          <Button label="Tomorrow" icon="calendar-outline" kind="secondary" onPress={() => remind(24 * 60 * 60, 'tomorrow')} />
        </PopupWindow>
      )}

      {/* "Go to page": type a page number (the window moves up out of the
          keyboard's way: see PopupWindow). Enter on the keyboard goes too. */}
      {goOpen && (
        <PopupWindow title="Go to page" onClose={() => setGoOpen(false)}
                     buttons={[
                       { label: 'Cancel', onPress: () => setGoOpen(false), kind: 'secondary' },
                       { label: 'Go', onPress: goToPage },
                     ]}>
          <TextField
            label={`Page number (1 to ${totalPages})`}
            value={goText}
            onChangeText={(text) => { setGoText(text); setGoError(''); }}
            onSubmitEditing={goToPage}
            keyboardType="number-pad"
            returnKeyType="go"
            autoFocus
            maxLength={6}
            style={goError ? { borderColor: colors.error } : undefined}
          />
          {/* A red message when it isn't a page this binder has */}
          {goError !== '' && (
            <Text style={[styles.dialogText, { color: colors.error }]} accessibilityLiveRegion="polite">{goError}</Text>
          )}
        </PopupWindow>
      )}

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} shortcuts={binderShortcuts} />
    </View>
  );
}

/* ---------------------------------------------------------------------
   A POCKET FOUND WITH THE SEARCH BAR: it fades in and out ("glow" goes
   between 1 and 0.35 over and over: see the highlight code above)
   --------------------------------------------------------------------- */

function GlowingPocket({ glow, children }: { glow: { value: number }; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// The screen's look. The binder's own sizes are worked out above (they
// depend on the screen); these are the parts that don't.
const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { paddingHorizontal: 12, paddingTop: 10, gap: 4, zIndex: 10 },
  area: { flex: 1, alignItems: 'center', padding: 6 },
  scroll: { alignSelf: 'stretch', flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  // The binder and its pages (their colors come from the theme)
  binder: { borderRadius: 10, padding: COVER },
  pages: { flexDirection: 'row' },
  page: { borderRadius: 4, padding: PAD, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start' },
  bar: { justifyContent: 'center' },
  pageNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageStatus: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  // The tappable area around the page number (it can shrink between the arrows)
  pageStatusButton: { flexShrink: 1 },
  // Previous / Next: small rounded buttons with an arrow (faded when
  // there's no page that way)
  navButton: { width: 40, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  navOff: { opacity: 0.35 },
  ghost: { position: 'absolute', left: 0, top: 0, borderRadius: 6, overflow: 'hidden', zIndex: 20 },
  ghostPicture: { width: '100%', height: '100%' },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  // The binder's name and its check mark, side by side
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  headerName: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  headerButton: { paddingHorizontal: 5 },
  pressed: { opacity: 0.5 },
  listArea: { flex: 1 },
  dropOutline: { position: 'absolute', top: 4, left: 8, right: 8, bottom: 4, borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, zIndex: 25 },
  summaryRow: { paddingHorizontal: 12, paddingTop: 6 },
  emptyList: { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 24 },
  menuPicture: { width: '100%', height: 260 },
  menuWhere: { textAlign: 'center' },
  menuCopies: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  menuCount: { fontSize: 17, fontWeight: '700' },
  dialogText: { fontSize: 16, lineHeight: 22 },
});
