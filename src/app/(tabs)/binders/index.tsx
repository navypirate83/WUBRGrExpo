/* =====================================================================
   THE SHELF: YOUR BINDERS (/binders)
   From top to bottom: the search bar (every card in every binder),
   "Saved on this device only" (when it is), the "Add binder" button
   (it opens the New binder window: name, cover symbol and color, or
   upload a .CSV), then the binders themselves: a closed binder for each,
   side by side, as many across as the screen has room for (more rows as
   more are made), with its card count under it. Then a message line.
   Touching the binders:
   - tap a binder to open it
   - DRAG a binder to move it to another spot on the shelf (the others
     shift along to make room). With a finger: rest it on the binder for
     a moment, then slide. With a mouse: press the button and move.
   - press and HOLD a binder still for its options: Edit and Delete (the
     phone gives a little buzz when they open)
   - pull the shelf DOWN to load the binders again (from Google Drive,
     when signed in)
   With no binders yet, the shelf says so and offers to make the first.
   This file also does the work behind the shelf: loading the binders
   from Google Drive, and making, uploading, editing, moving and deleting
   them. Each change shows on the shelf straight away, then is saved to
   Drive (when signed in).
   Someone who hasn't signed in or chosen "on this device only" yet sees
   a short welcome with both choices instead of the shelf.
   ===================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAccount } from '@/hooks/useAccount';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import { useColors } from '@/hooks/useTheme';
import { useShortcutKeys, useShowKeyHints } from '@/hooks/useShortcutKeys';
import { usePointerKind } from '@/hooks/usePointerKind';
import ShortcutsDialog, { type Shortcut } from '@/components/ShortcutsDialog';
import NewBinderDialog, { type UploadedBinder } from '@/components/binders/NewBinderDialog';
import BinderSearch from '@/components/binders/BinderSearch';
import ShelfSwitch from '@/components/binders/ShelfSwitch';
import ClosedBinder from '@/components/binders/ClosedBinder';
import { BinderPropertiesDialog, DeleteBinderDialog, type BinderChanges } from '@/components/binders/BinderWindows';
import PopupWindow from '@/components/PopupWindow';
import Button from '@/components/Button';
import {
  DEFAULT_PAGES,
  binderCardCount, binderPages, cardCountText, fitCardsIntoPages, forgetBinder,
  loadBinderList, minPagesFor, saveBinder, saveBinderList, setLocalMode,
  type Binder,
} from '@/lib/binderStorage';
import {
  DriveError, createBinderFile, syncBinder,
  trashBinderFile, updateBinderDetails,
} from '@/lib/googleDrive';
import { reconcileWithDrive } from '@/lib/driveSync';
import { hapticTap } from '@/lib/haptics';
import { RADIUS } from '@/theme/colors';

// The shelf's binders: how wide each one is, and the space between them
// across and down (points). Smaller on phones, so three fit across, and
// bigger on wider screens (like the original website).
function shelfSizes(screenWidth: number) {
  if (screenWidth <= 560) return { tile: 100, gapX: 14, gapY: 22 };
  if (screenWidth <= 900) return { tile: 130, gapX: 28, gapY: 28 };
  return { tile: 150, gapX: 40, gapY: 32 };
}
// The shelf is never wider than this (points), even on a big screen
const SHELF_MAX_WIDTH = 1400;
// The space around the edge of the shelf (points)
const SHELF_PADDING = 16;

// Moving a binder with a finger: rest it on the binder this long
// (milliseconds) before moving (moving sooner scrolls the shelf), and
// hold it still this long for the binder's options. A finger has to move
// this far (points) to pick the binder up.
const REST_MS = 150;
const MENU_HOLD_MS = 500;
const LIFT_DISTANCE = 8;

// The keys listed in this screen's Keyboard shortcuts window (computers only)
const shelfShortcuts: Shortcut[] = [
  { keys: 'N', does: 'Make a new binder (with cover choices)' },
  { keys: '?', does: 'Show this list' },
];

export default function ShelfScreen() {
  const colors = useColors();
  // Show the keyboard shortcuts button? (Computers only: see useShortcutKeys)
  const showKeyHints = useShowKeyHints();
  const { signedIn, localMode } = useAccount();
  const { width } = useWindowDimensions();
  // A message another screen sent (like "Your binder was deleted")
  const params = useLocalSearchParams<{ message?: string }>();

  // The binders on the shelf, in order (this device's list to start,
  // then the list from Google Drive once it has loaded)
  const [binders, setBinders] = useState<Binder[]>(loadBinderList);
  // A number that goes up to redraw the card counts after cards change
  const [, setCardsChanged] = useState(0);
  // The line above the shelf (only when the binders are kept on this
  // device; signed in, nothing is shown), and the message under the
  // shelf (red if an error)
  const account = localMode ? 'Saved on this device only' : '';
  const [message, setMessage] = useState<{ text: string; error?: boolean }>({ text: params.message ?? '' });
  // While a new binder is being made: the Add binder button is greyed out
  const [adding, setAdding] = useState(false);
  // While the list is being pulled down to load again
  const [refreshing, setRefreshing] = useState(false);
  // Which window is open: New binder, the held binder's menu, Binder
  // properties or Delete (with the binder's id), or Keyboard shortcuts
  const [newOpen, setNewOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Mouse or finger? (They drag binders differently: see BinderTile.)
  const withMouse = usePointerKind() === 'mouse';
  // The binder being moved: its id, its spot on the shelf when the drag
  // started, how far the finger (or mouse) has moved across and down
  // (points), where it is on the screen, and whether the binder has been
  // picked up yet (a finger resting on it hasn't moved yet). Kept in a
  // "ref" too, for the code that runs when it's let go.
  type Drag = { id: string; from: number; dx: number; dy: number; absX: number; absY: number; lifted: boolean };
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  // One binder's height on the shelf, with its caption (measured as
  // they're drawn), when the last drag ended, the "hold for options"
  // countdown, and where the screen sits on the device's screen
  // (measured when a drag starts, for the floating binder)
  const tileHeight = useRef(0);
  const dragEnded = useRef(0);
  const menuTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const screenRef = useRef<ComponentRef<typeof View>>(null);
  const screenAt = useRef({ x: 0, y: 0 });
  // What the binders depend on besides the list (see the list's "extraData")
  const tileExtras = useMemo(() => ({ drag, withMouse }), [drag, withMouse]);

  const { announce } = useAnnouncer();
  // Set once loading from Drive has started, so it only runs once (React
  // runs start-up code twice while working locally, to check for mistakes)
  const loadStarted = useRef(false);

  // The card count of every binder, from this device's copy
  const counts = Object.fromEntries(binders.map((b) => [b.id, binderCardCount(b.id)]));

  // The shelf's layout: each binder's size, the gaps, and how many fit
  // across (at least one). The whole grid is centered, and its width
  // is exactly that many binders and the gaps between them.
  const { tile, gapX, gapY } = shelfSizes(width);
  const shelfWidth = Math.min(width, SHELF_MAX_WIDTH) - 2 * SHELF_PADDING;
  const columns = Math.max(1, Math.floor((shelfWidth + gapX) / (tile + gapX)));
  const gridWidth = columns * tile + (columns - 1) * gapX;

  // Show the shelf with a new list of binders, and keep the list on this
  // device too.
  function showBinders(list: Binder[]) {
    saveBinderList(list);
    setBinders(list);
  }

  // Coming back to the shelf (from a binder, or another tab): the cards
  // may have changed, so read the list and counts again
  useFocusEffect(useCallback(() => {
    setBinders(loadBinderList());
    setCardsChanged((n) => n + 1);
  }, []));

  // Something went wrong talking to Google Drive. If the sign-in ran out,
  // go to the Home screen to sign in again; otherwise say what happened
  // under the shelf.
  function problem(err: unknown, what: string) {
    if (err instanceof DriveError && err.signedOut) {
      router.navigate({ pathname: '/', params: { message: err.message } });
      return;
    }
    setMessage({ text: `${what} ${(err as Error).message}`, error: true });
  }

  /* ----- Loading the binders from Google Drive ----- */

  // Compare this device with Google Drive (see lib/driveSync.ts): if they
  // match, any waiting changes are sent to Drive; if they differ (a
  // binder added on the website, say), a window asks which way to sync.
  // Nothing on this device is removed unless the person chooses "Drive to
  // phone". Then show the shelf as it now stands. "fromUser" is true when
  // pulling the shelf down, which asks again after a "Not now".
  async function loadFromDrive(fromUser = false) {
    await reconcileWithDrive({ fromUser });
    setBinders(loadBinderList());
    setCardsChanged((n) => n + 1);
  }

  // Signed in: the binders this device knows about show straight away,
  // then the shelf is refreshed from Google Drive (once).
  useEffect(() => {
    if (!signedIn || loadStarted.current) return;
    loadStarted.current = true;
    if (!params.message) setMessage({ text: 'Loading your binders…' });
    loadFromDrive()
      .then(() => { if (!params.message) setMessage({ text: '' }); })
      .catch((err) => problem(err, 'Couldn\'t load your binders from Google Drive.'));
  }, [signedIn]);

  // Pulling the list down: load again (from Drive when signed in;
  // otherwise just this device's list), then hide the spinner
  async function refresh() {
    setRefreshing(true);
    try {
      if (signedIn) await loadFromDrive(true);
      else { setBinders(loadBinderList()); setCardsChanged((n) => n + 1); }
      setMessage({ text: '' });
    } catch (err) {
      problem(err, 'Couldn\'t load your binders from Google Drive.');
    }
    setRefreshing(false);
  }

  /* ----- Making a binder (the add box, the New binder window, or Upload file) ----- */

  // Make a new binder at the end of the shelf, in Google Drive (or on
  // this device, when used locally), with these cards (often none).
  async function addBinder(details: Omit<Binder, 'id'>, cards = {}, doneMessage = '') {
    setAdding(true);
    setMessage({ text: cards && Object.keys(cards).length ? `Adding ${details.name}…` : 'Making a new binder…' });
    try {
      const list = loadBinderList();
      const file = await createBinderFile(details.name, cards, details.color, list.length, details.cover, details.pages);
      saveBinder(cards, file.id, { dirty: false });   // Drive already has these cards
      showBinders([...list, { id: file.id, ...details }]);
      setMessage({ text: doneMessage || `✓ Made ${details.name}.` });
      announce(`Made ${details.name}`);
    } catch (err) {
      problem(err, 'Couldn\'t make a new binder.');
    }
    setAdding(false);
  }

  // A binder file was uploaded: add it, and say how many cards it has
  // (and how many unreadable entries were skipped, if any).
  function addUploadedBinder({ name, color, cover, pages, cards, skipped }: UploadedBinder) {
    const count = Object.keys(cards).length;
    addBinder({ name, color, cover, pages }, cards,
      `✓ Added ${name} with ${cardCountText(count)}` +
      (skipped > 0 ? ` (${skipped} unreadable entr${skipped === 1 ? 'y' : 'ies'} skipped).` : '.'));
  }

  /* ----- Moving a binder up or down the shelf ----- */

  // Move up / Move down: swap it with its neighbor
  async function moveBinder(id: string, by: -1 | 1) {
    const from = loadBinderList().findIndex((b) => b.id === id);
    await moveBinderTo(id, from + by);
  }

  // Move a binder to any spot (0 is the top): for Move up / Move down
  // above, and for dragging a binder with a mouse. Then every binder's
  // position (0, 1, 2, ...) is saved as a label on its Drive file, so the
  // order is the same on every device.
  async function moveBinderTo(id: string, to: number) {
    const list = loadBinderList();
    const from = list.findIndex((b) => b.id === id);
    if (from < 0 || to < 0 || to >= list.length || to === from) return;
    const [moving] = list.splice(from, 1);   // take it out...
    list.splice(to, 0, moving);              // ...and put it in its new spot
    showBinders(list);
    announce(`${moving.name} moved to spot ${to + 1} of ${list.length}`);
    if (localMode) return;
    setMessage({ text: 'Saving the new order…' });
    try {
      await Promise.all(list.map((b, index) => updateBinderDetails(b.id, { order: index })));
      setMessage({ text: '' });
    } catch (err) {
      problem(err, 'Couldn\'t save the new order to Google Drive.');
    }
  }

  /* ----- Binder properties: saving the changes ----- */

  async function saveChanges(id: string, { name, color, cover, pages }: BinderChanges) {
    const oldPages = binderPages(id);
    // Show the change straight away...
    const list = loadBinderList();
    const binder = list.find((b) => b.id === id);
    if (!binder) return;
    Object.assign(binder, { name, color, cover, pages });
    showBinders(list);

    // ...then save it (to Drive, renaming the file and setting its labels).
    setMessage({ text: localMode ? '' : 'Saving…' });
    try {
      // Fewer pages than before? Make sure no card is left on a page
      // that's going away: get the binder's latest cards, and move any on
      // those pages into empty pockets on the pages that stay.
      if (pages < oldPages) {
        const cards = await syncBinder(id);
        // (If cards were added on another device meanwhile, it may need
        // more pages than the window allowed: never go below that.)
        const needed = minPagesFor(Object.keys(cards).length);
        if (pages < needed) {
          pages = needed;
          binder.pages = pages;
          showBinders([...list]);
        }
        const fitted = fitCardsIntoPages(cards, pages);
        if (JSON.stringify(fitted) !== JSON.stringify(cards)) {
          saveBinder(fitted, id);    // keep the moved cards (marked "needs saving")...
          await syncBinder(id);      // ...and save them to Drive
        }
      }
      await updateBinderDetails(id, { name, color, cover, pages });
      setMessage({ text: '' });
    } catch (err) {
      problem(err, 'Couldn\'t save the changes to Google Drive.');
    }
  }

  /* ----- Deleting a binder ----- */

  // Move its file to the Drive trash (nothing to do there when used
  // locally), then take it off the shelf and off this device.
  async function deleteBinder(id: string) {
    const name = binders.find((b) => b.id === id)?.name ?? 'The binder';
    setMessage({ text: 'Deleting…' });
    try {
      await trashBinderFile(id);
      forgetBinder(id);
      setBinders(loadBinderList());
      setMessage({ text: `✓ Deleted ${name}.` });
      announce(`Deleted ${name}`);
    } catch (err) {
      problem(err, 'Couldn\'t delete the binder.');
    }
  }

  /* ----- Keys on a computer: ? for the shortcuts list, N for a new binder ----- */

  useShortcutKeys((event) => {
    if (event.key === '?') { event.preventDefault(); setShortcutsOpen(true); }
    else if (event.key.toLowerCase() === 'n') { event.preventDefault(); setNewOpen(true); }
  });

  // Not signed in and not using the app on this device: a short welcome
  // with the two ways to start, instead of the shelf
  if (!signedIn && !localMode) {
    return (
      <View style={[styles.welcome, { backgroundColor: colors.bg }]}>
        <Ionicons name="library-outline" size={64} color={colors.muted} />
        <Text style={[styles.welcomeTitle, { color: colors.text }]} accessibilityRole="header">Your shelf of binders</Text>
        <Text style={[styles.welcomeText, { color: colors.muted }]}>
          {params.message ? `${params.message}\n\n` : ''}
          Keep your binders on this device, or sign in with Google on the Home tab to keep them in your Google Drive.
        </Text>
        <Button label="Use on this device only" icon="phone-portrait-outline" onPress={() => setLocalMode(true)} />
        <Button label="Sign in on Home" kind="secondary" onPress={() => router.navigate('/')} />
      </View>
    );
  }

  /* ----- Moving a binder by dragging it ----- */

  // Where a spot on the shelf is (its top left corner), counting from
  // the first binder's: spots fill each row left to right, then the next row
  function spotAt(index: number) {
    return {
      x: (index % columns) * (tile + gapX),
      y: Math.floor(index / columns) * (tileHeight.current + gapY),
    };
  }

  // The spot a dragged binder would land in: the spot nearest to where
  // it has been dragged, kept within the shelf
  function dropSpot(d: Drag): number {
    const start = spotAt(d.from);
    const stepY = tileHeight.current + gapY;
    const column = Math.min(columns - 1, Math.max(0, Math.round((start.x + d.dx) / (tile + gapX))));
    const row = Math.max(0, Math.round((start.y + d.dy) / (stepY || 1)));
    return Math.min(binders.length - 1, row * columns + column);
  }

  // How far each binder is drawn from its own spot while one is being
  // dragged: the binders between its old and new spots move along one
  // spot to make room, and the dragged one's faded copy shows where it
  // will land
  function shiftFor(index: number): { x: number; y: number } {
    if (!drag?.lifted) return { x: 0, y: 0 };
    const to = dropSpot(drag);
    let newIndex = index;
    if (index === drag.from) newIndex = to;
    else if (drag.from < to && index > drag.from && index <= to) newIndex = index - 1;
    else if (to < drag.from && index >= to && index < drag.from) newIndex = index + 1;
    const from = spotAt(index);
    const goTo = spotAt(newIndex);
    return { x: goTo.x - from.x, y: goTo.y - from.y };
  }

  // A finger has rested on a binder (or the mouse has started moving
  // with the button held down): get ready to move it. A finger also
  // starts the "hold for options" countdown.
  function startDrag(id: string, from: number, absX: number, absY: number) {
    screenRef.current?.measureInWindow((x, y) => { screenAt.current = { x, y }; });
    setDrag({ id, from, dx: 0, dy: 0, absX, absY, lifted: false });
    if (!withMouse) {
      clearTimeout(menuTimer.current);
      menuTimer.current = setTimeout(() => {
        // Still resting there without moving: show its options instead
        if (dragRef.current?.id !== id || dragRef.current.lifted) return;
        hapticTap();
        setDrag(null);
        dragEnded.current = Date.now();
        setMenuId(id);
      }, MENU_HOLD_MS - REST_MS);
    }
  }

  // The finger (or mouse) moved: once it has moved far enough, the binder
  // is picked up (with a small buzz on a phone) and follows it
  function moveDrag(dx: number, dy: number, absX: number, absY: number) {
    setDrag((d) => {
      if (!d) return d;
      const lifted = d.lifted || withMouse || Math.hypot(dx, dy) >= LIFT_DISTANCE;
      if (lifted && !d.lifted) {
        clearTimeout(menuTimer.current);
        hapticTap();
      }
      return { ...d, dx, dy, absX, absY, lifted };
    });
  }

  // Let go: move the binder to its new spot (if it changed). (This also
  // runs after a plain tap or click, when nothing was dragged.)
  function endDrag() {
    clearTimeout(menuTimer.current);
    const d = dragRef.current;
    if (!d) return;
    setDrag(null);
    dragEnded.current = Date.now();
    if (!d.lifted) return;
    const to = dropSpot(d);
    if (to !== d.from) moveBinderTo(d.id, to);
  }

  // Opening a binder: not straight after dragging one (letting go also
  // counts as a tap on it)
  function openBinder(id: string) {
    if (dragRef.current || Date.now() - dragEnded.current < 400) return;
    router.push(`/binders/${encodeURIComponent(id)}`);
  }

  // The binder being dragged, for the floating copy that follows the finger
  const dragged = drag?.lifted ? binders.find((b) => b.id === drag.id) : undefined;

  const menuBinder = menuId ? binders.find((b) => b.id === menuId) : undefined;
  const editing = editingId ? binders.find((b) => b.id === editingId) : undefined;
  const deleting = deletingId ? binders.find((b) => b.id === deletingId) : undefined;

  // The part above the binders: the switch, search, "Saved on this device only" (when it is), and Add binder
  const header = (
    <View style={styles.header}>
      {/* Binders or Lists (this is Binders, so its button is faded) */}
      <ShelfSwitch current="binders" />
      <BinderSearch />
      {account ? <Text style={[styles.account, { color: colors.muted }]}>{account}</Text> : null}

      {/* Add binder: opens the New binder window (name, cover symbol and
          color, or Upload .CSV) */}
      <Button label="Add binder" icon="add" onPress={() => setNewOpen(true)} disabled={adding} />
      {showKeyHints && (
        <Button label="Keyboard shortcuts" kind="plain" icon="keypad-outline" onPress={() => setShortcutsOpen(true)}
                style={styles.moreButton} />
      )}
    </View>
  );

  return (
    // The keyboard pushes everything up instead of covering the search bar
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      {/* The screen's own box, measured for the floating binder */}
      <View ref={screenRef} style={styles.fill} collapsable={false}>
      {/* The shelf: a FlatList with "numColumns" lays the binders out in
          rows of that many. ("key" makes it start fresh when the number
          across changes, like a phone turned sideways: a FlatList can't
          change it while drawn.) It can't scroll while a finger rests on
          a binder (that finger is moving the binder instead). */}
      <FlatList
        key={`columns-${columns}`}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? [styles.shelfRow, { width: gridWidth, gap: gapX }] : undefined}
        scrollEnabled={!drag}
        showsVerticalScrollIndicator={false}
        data={binders}
        keyExtractor={(binder) => binder.id}
        ListHeaderComponent={header}
        // The header (with the search's drop-down list) is drawn on top of
        // the rows below it
        ListHeaderComponentStyle={styles.headerOnTop}
        contentContainerStyle={[styles.list, { gap: gapY }]}
        // Taps on buttons work even while the keyboard is up
        keyboardShouldPersistTaps="handled"
        // Pull down to load the binders again
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} colors={[colors.accent]} />}
        // No binders yet: an intentional empty shelf, not a blank screen
        ListEmptyComponent={<EmptyShelf onNew={() => setNewOpen(true)} />}
        // The message line under the shelf
        ListFooterComponent={
          message.text
            ? <Text style={[styles.message, { color: message.error ? colors.error : colors.muted }]} accessibilityLiveRegion="polite">{message.text}</Text>
            : undefined
        }
        // Redraw the binders as one is dragged, and when the mouse or
        // finger changes (the list only redraws them when this changes)
        extraData={tileExtras}
        renderItem={({ item: binder, index }) => {
          const shift = shiftFor(index);
          return (
            <BinderTile
              binder={binder}
              count={counts[binder.id] ?? 0}
              width={tile}
              position={`${index + 1} of ${binders.length}`}
              withMouse={withMouse}
              shiftX={shift.x}
              shiftY={shift.y}
              lifted={drag?.lifted === true && drag.id === binder.id}
              onMeasure={(height) => { tileHeight.current = height; }}
              onDragStart={(absX, absY) => startDrag(binder.id, index, absX, absY)}
              onDragMove={moveDrag}
              onDragEnd={endDrag}
              onOpen={() => openBinder(binder.id)}
              onHold={() => { hapticTap(); setMenuId(binder.id); }}
              onEdit={() => setEditingId(binder.id)}
              onDelete={() => setDeletingId(binder.id)}
              onMove={(by) => moveBinder(binder.id, by)}
            />
          );
        }}
      />

      {/* The binder being dragged, floating under the finger (over
          everything else on the screen) */}
      {dragged && drag && (
        <View pointerEvents="none"
              style={[styles.floating, {
                width: tile,
                left: drag.absX - screenAt.current.x - tile / 2,
                top: drag.absY - screenAt.current.y - tile * 0.6,
              }]}>
          <ClosedBinder width={tile} name={dragged.name} colorCode={dragged.color} cover={dragged.cover} lifted />
        </View>
      )}
      </View>

      {/* The windows (each drawn only while it's open) */}
      {newOpen && (
        <NewBinderDialog
          onCreate={(name, color, cover) => { setNewOpen(false); addBinder({ name, color, cover, pages: DEFAULT_PAGES }); }}
          onUpload={(binder) => { setNewOpen(false); addUploadedBinder(binder); }}
          onCancel={() => setNewOpen(false)}
        />
      )}
      {menuBinder && (
        <PopupWindow title={menuBinder.name} onClose={() => setMenuId(null)}
                     buttons={[{ label: 'Close', onPress: () => setMenuId(null), kind: 'secondary' }]}>
          {/* Its options: Edit (name, pages, cover) and Delete */}
          <View style={styles.menu}>
            <Button label="Edit" icon="create-outline" kind="secondary"
                    onPress={() => { setMenuId(null); setEditingId(menuBinder.id); }} />
            <Button label="Delete" icon="trash-outline" kind="danger"
                    onPress={() => { setMenuId(null); setDeletingId(menuBinder.id); }} />
          </View>
        </PopupWindow>
      )}
      {editing && (
        <BinderPropertiesDialog
          binder={editing}
          cardCount={counts[editing.id] ?? 0}
          onSave={(changes) => { setEditingId(null); saveChanges(editing.id, changes); }}
          onCancel={() => setEditingId(null)}
        />
      )}
      {deleting && (
        <DeleteBinderDialog
          binder={deleting}
          cardCount={counts[deleting.id] ?? 0}
          localMode={localMode}
          onDelete={() => { setDeletingId(null); deleteBinder(deleting.id); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} shortcuts={shelfShortcuts} />
    </KeyboardAvoidingView>
  );
}

/* ---------------------------------------------------------------------
   ONE BINDER ON THE SHELF
   The closed binder (its cover, with its name on the label and its
   symbol), and its card count under it. Tap it to open it.
   Moving it: with a finger, rest it on the binder for a moment (REST_MS)
   then slide; moving sooner scrolls the shelf instead. With a mouse,
   press the button and move. Holding it still (a finger, or the mouse
   button) for half a second shows its options instead.
   While a binder is being dragged, each one is drawn "shiftX / shiftY"
   points from its spot (to make room), and the dragged one is faded,
   showing where it will land.
   --------------------------------------------------------------------- */

function BinderTile(props: {
  binder: Binder;
  count: number;
  width: number;
  position: string;           // "2 of 5", for screen readers
  withMouse: boolean;
  shiftX: number;
  shiftY: number;
  lifted: boolean;            // it's the one being dragged
  onMeasure: (height: number) => void;
  onDragStart: (absX: number, absY: number) => void;
  onDragMove: (dx: number, dy: number, absX: number, absY: number) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onHold: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const { binder, count, width, position, withMouse, shiftX, shiftY, lifted } = props;
  const colors = useColors();

  // The drag. With a finger it only starts once the finger has rested
  // still for REST_MS; with a mouse, once it has moved a few points with
  // the button held down. x and y count from where it started.
  const pan = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: withMouse ? 0 : REST_MS,
    minDistance: withMouse ? 6 : undefined,
    onActivate: (event) => {
      props.onDragStart(event.absoluteX - event.translationX, event.absoluteY - event.translationY);
      if (withMouse) props.onDragMove(event.translationX, event.translationY, event.absoluteX, event.absoluteY);
    },
    onUpdate: (event) => props.onDragMove(event.translationX, event.translationY, event.absoluteX, event.absoluteY),
    onFinalize: () => props.onDragEnd(),
  });

  return (
    // "pan-y" lets a phone's web browser scroll the shelf up and down
    // itself; resting first still moves the binder
    <GestureDetector gesture={pan} touchAction="pan-y">
      <View
        onLayout={(event) => props.onMeasure(event.nativeEvent.layout.height)}
        style={[
          { width, transform: [{ translateX: shiftX }, { translateY: shiftY }] },
          lifted && styles.landing,
          withMouse && styles.grab,
        ]}
      >
        {/* The binder itself: tap to open. A mouse button held still
            shows its options (a finger's hold is timed by the drag code). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${binder.name}, ${cardCountText(count)}, ${binder.pages} pages. Binder ${position}.`}
          accessibilityHint="Opens the binder. Hold for its options."
          accessibilityActions={[
            { name: 'edit', label: 'Edit' },
            { name: 'delete', label: 'Delete' },
            { name: 'earlier', label: 'Move earlier' },
            { name: 'later', label: 'Move later' },
          ]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === 'edit') props.onEdit();
            else if (action === 'delete') props.onDelete();
            else props.onMove(action === 'earlier' ? -1 : 1);
          }}
          onPress={props.onOpen}
          onLongPress={withMouse ? props.onHold : undefined}
          delayLongPress={MENU_HOLD_MS}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <ClosedBinder width={width} name={binder.name} colorCode={binder.color} cover={binder.cover} />
          <Text style={[styles.caption, { color: colors.muted }]} numberOfLines={1}>{cardCountText(count)}</Text>
        </Pressable>
      </View>
    </GestureDetector>
  );
}

/* ---------------------------------------------------------------------
   THE EMPTY SHELF
   What shows when there are no binders: a picture, a line saying the
   shelf is empty, and a button to make the first binder.
   --------------------------------------------------------------------- */

function EmptyShelf({ onNew }: { onNew: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Ionicons name="albums-outline" size={56} color={colors.muted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Your shelf is empty</Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>
        Tap Add binder above to make one, with a cover of your choice.
      </Text>
      <Button label="Make your first binder" icon="add" onPress={onNew} />
    </View>
  );
}

// The shelf's look. Everything sits in a column no wider than
// MAX_CONTENT_WIDTH, centered on big screens.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: SHELF_PADDING, width: '100%', maxWidth: SHELF_MAX_WIDTH, alignSelf: 'center', flexGrow: 1 },
  header: { gap: 10, marginBottom: 4 },
  headerOnTop: { zIndex: 10 },
  account: { fontSize: 14 },
  moreButton: { alignSelf: 'flex-start', minHeight: 36 },
  message: { fontSize: 15, textAlign: 'center', marginTop: 8 },
  // One row of binders: as wide as the binders in it, centered
  shelfRow: { alignSelf: 'center' },
  // A binder and its card count, stacked
  tile: { alignItems: 'center', gap: 8 },
  caption: { fontSize: 13 },
  pressed: { opacity: 0.7 },
  // The dragged binder's spot: faded, showing where it will land
  landing: { opacity: 0.3 },
  // With a mouse, the pointer shows a hand over a binder (it can be dragged)
  grab: { cursor: 'grab' },
  // The floating copy of a dragged binder
  floating: { position: 'absolute', zIndex: 50 },
  menu: { gap: 8 },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS * 1.4, marginTop: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', marginBottom: 6 },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  welcomeTitle: { fontSize: 24, fontWeight: '700' },
  welcomeText: { fontSize: 16, textAlign: 'center', lineHeight: 22, maxWidth: 420 },
});
