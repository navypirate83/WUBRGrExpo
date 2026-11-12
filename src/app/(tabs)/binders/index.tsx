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
   - press and HOLD a binder still for its options: Edit, Copy and Delete
     (the phone gives a little buzz when they open). A right-click with a
     mouse shows them too.
   - on a computer, hold CTRL and click several binders to pick them (each
     gets a frame and a tick). Letting go of Ctrl asks: Copy them or
     Delete them. Esc drops the picks.
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
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAccount } from '@/hooks/useAccount';
import { useAnnouncer } from '@/hooks/useAnnouncer';
import { useContentWidth } from '@/hooks/useMenuStyle';
import { useColors } from '@/hooks/useTheme';
import { useShortcutKeys, useShowKeyHints } from '@/hooks/useShortcutKeys';
import { usePointerKind } from '@/hooks/usePointerKind';
import { useCtrlSelect } from '@/hooks/useCtrlSelect';
import ShortcutsDialog, { type Shortcut } from '@/components/ShortcutsDialog';
import NewBinderDialog, { type UploadedBinder } from '@/components/binders/NewBinderDialog';
import BinderSearch from '@/components/binders/BinderSearch';
import ClosedBinder from '@/components/binders/ClosedBinder';
import { BinderPropertiesDialog, DeleteBinderDialog, type BinderChanges } from '@/components/binders/BinderWindows';
import PopupWindow from '@/components/PopupWindow';
import Button from '@/components/Button';
import {
  DEFAULT_PAGES,
  binderCardCount, binderPages, cardCountText, fitCardsIntoPages, forgetBinder, freeBinderName,
  hasBinderCopy, loadBinder, loadBinderList, minPagesFor, saveBinder, saveBinderList, setLocalMode,
  type Binder,
} from '@/lib/binderStorage';
import {
  DriveError, createBinderFile, syncBinder,
  trashBinderFile, updateBinderDetails,
} from '@/lib/googleDrive';
import { reconcileWithDrive } from '@/lib/driveSync';
import { hapticTap } from '@/lib/haptics';
import { askYesNo } from '@/lib/dialogs';
import { RADIUS } from '@/theme/colors';

// The three boxes along the bottom of the screen that a binder picked up
// with a finger can be dropped on
type Zone = 'edit' | 'copy' | 'delete';
const ZONES: { zone: Zone; label: string; icon: 'create-outline' | 'copy-outline' | 'trash-outline' }[] = [
  { zone: 'edit', label: 'Edit', icon: 'create-outline' },
  { zone: 'copy', label: 'Copy', icon: 'copy-outline' },
  { zone: 'delete', label: 'Delete', icon: 'trash-outline' },
];

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
// (milliseconds) and it is picked up (moving sooner scrolls the shelf).
// A mouse button held still this long shows the binder's options instead.
// A mouse has to move this far (points) to pick the binder up.
const REST_MS = 150;
const MENU_HOLD_MS = 500;
const LIFT_DISTANCE = 8;

// The keys listed in this screen's Keyboard shortcuts window (computers only)
const shelfShortcuts: Shortcut[] = [
  { keys: 'Arrow keys', does: 'Move between the binders' },
  { keys: 'Space', does: 'Pick or un-pick the binder you are on' },
  { keys: 'Shift + Arrow keys', does: 'Pick the binders you move over' },
  { keys: 'Ctrl + A', does: 'Pick every binder' },
  { keys: 'Enter', does: 'Open the binder (or, with some picked, ask Copy or Delete)' },
  { keys: 'C', does: 'Copy the picked binders (or the one you are on)' },
  { keys: 'Delete', does: 'Delete the picked binders (or the one you are on), after asking' },
  { keys: 'Esc', does: 'Drop the picks' },
  { keys: 'N', does: 'Make a new binder (with cover choices)' },
  { keys: '?', does: 'Show this list' },
];

export default function ShelfScreen() {
  const colors = useColors();
  // Show the keyboard shortcuts button? (Computers only: see useShortcutKeys)
  const showKeyHints = useShowKeyHints();
  const { signedIn, localMode } = useAccount();
  // The width beside the side menu (the whole window on a phone)
  const width = useContentWidth();
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
  // Binders picked with Ctrl held (their ids, in the order picked), and
  // whether the "Copy or Delete" window for them is open
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  // The binder the keyboard is on (its id), drawn with an outline: the arrow
  // keys move it, Space picks it. null until a key has been pressed.
  const [cursor, setCursor] = useState<string | null>(null);
  // A handle on the shelf's list, so the keyboard can scroll to a binder
  const listRef = useRef<FlatList<Binder>>(null);
  // Ctrl let go: if binders were picked, ask what to do with them. Esc
  // drops the picks. (Computers only: see hooks/useCtrlSelect.)
  const { ctrlHeld } = useCtrlSelect(
    () => { if (selectedRef.current.length > 0) setSelectionOpen(true); },
    () => setSelected([]),
  );
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
  // On the website, a finger that moves after resting would make the browser
  // start scrolling (and cancel the drag). So while a binder is held with a
  // finger, tell the browser not to scroll for the rest of that touch.
  const holding = drag?.lifted === true && !withMouse;
  useEffect(() => {
    if (Platform.OS !== 'web' || !holding) return;
    const stopScrolling = (event: Event) => { if (event.cancelable) event.preventDefault(); };
    window.addEventListener('touchmove', stopScrolling, { passive: false });
    return () => window.removeEventListener('touchmove', stopScrolling);
  }, [holding]);
  // One binder's height on the shelf, with its caption (measured as
  // they're drawn), when the last drag ended, the "hold for options"
  // countdown, and where the screen sits on the device's screen
  // (measured when a drag starts, for the floating binder)
  const tileHeight = useRef(0);
  // Where the Edit / Copy / Delete boxes are along the bottom while a binder
  // is picked up with a finger: the bar's top, and each box's place in it
  const barTop = useRef(0);
  const zoneBoxes = useRef<Partial<Record<Zone, { x: number; y: number; w: number; h: number }>>>({});
  const dragEnded = useRef(0);
  const screenRef = useRef<ComponentRef<typeof View>>(null);
  const screenAt = useRef({ x: 0, y: 0 });
  // What the binders depend on besides the list (see the list's "extraData")
  const tileExtras = useMemo(() => ({ drag, withMouse, selected, cursor }), [drag, withMouse, selected, cursor]);

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

  /* ----- Copying binders ----- */

  // Make a copy of each of these binders (in the order they sit on the
  // shelf). A copy has the same cover, color, pages and cards, a name
  // with a number added, like "Black (1)", and goes at the end of the shelf.
  async function copyBinders(ids: string[]) {
    const originals = loadBinderList().filter((b) => ids.includes(b.id));
    if (originals.length === 0) return;
    const what = originals.length === 1 ? originals[0].name : `${originals.length} binders`;
    setAdding(true);
    setMessage({ text: `Copying ${what}…` });
    try {
      for (const original of originals) {
        // Its cards, from this device (or from Drive if this device
        // doesn't have them yet)
        const cards = hasBinderCopy(original.id) ? loadBinder(original.id) : await syncBinder(original.id);
        // The shelf as it is now, so each copy's number is free
        const list = loadBinderList();
        const name = freeBinderName(original.name);
        const file = await createBinderFile(name, cards, original.color, list.length, original.cover, original.pages);
        saveBinder(cards, file.id, { dirty: false });   // Drive already has these cards
        showBinders([...list, { id: file.id, name, color: original.color, cover: original.cover, pages: original.pages }]);
      }
      setMessage({ text: `✓ Copied ${what}.` });
      announce(`Copied ${what}`);
    } catch (err) {
      problem(err, 'Couldn\'t copy the binders.');
    }
    setAdding(false);
  }

  /* ----- Deleting several binders at once ----- */

  // Ask first (nothing is deleted without a yes), then delete each one
  // the same way as deleting a single binder
  async function deleteBinders(ids: string[]) {
    const doomed = loadBinderList().filter((b) => ids.includes(b.id));
    if (doomed.length === 0) return;
    const names = doomed.map((b) => `"${b.name}"`).join(', ');
    const yes = await askYesNo(
      doomed.length === 1 ? 'Delete this binder?' : `Delete these ${doomed.length} binders?`,
      `${names} and ${doomed.length === 1 ? 'its' : 'their'} cards will be deleted. ` +
      (localMode
        ? 'They\'re only saved on this device, so they can\'t be brought back.'
        : 'They go to your Google Drive trash, where they can be restored for 30 days.'),
      'Yes, delete',
      'No',
    );
    if (!yes) return;
    setMessage({ text: 'Deleting…' });
    try {
      for (const binder of doomed) {
        await trashBinderFile(binder.id);
        forgetBinder(binder.id);
        setBinders(loadBinderList());
      }
      const what = doomed.length === 1 ? doomed[0].name : `${doomed.length} binders`;
      setMessage({ text: `✓ Deleted ${what}.` });
      announce(`Deleted ${what}`);
    } catch (err) {
      setBinders(loadBinderList());
      problem(err, 'Couldn\'t delete the binders.');
    }
  }

  /* ----- Picking several binders (hold Ctrl and click, on a computer) ----- */

  // Ctrl-click: pick the binder, or take it off the picked ones again
  function toggleSelected(id: string) {
    setSelected((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  }

  // The window that asks "Copy or Delete?" closed (any way): nothing stays picked
  function closeSelection() {
    setSelectionOpen(false);
    setSelected([]);
  }

  /* ----- Picking several binders with the keyboard ----- */

  // Move the keyboard to another binder, "by" spots along the shelf (1 =
  // next, columns = one row down). The first press lands on the first
  // binder. With "pick" (Shift held), the binder left and the one arrived at
  // are both picked. The shelf scrolls to show it.
  function moveCursor(by: number, pick: boolean) {
    if (binders.length === 0) return;
    const here = cursor ? binders.findIndex((b) => b.id === cursor) : -1;
    let next = here < 0 ? 0 : here + by;
    // Off the end of the shelf: stay where we are
    if (next < 0 || next >= binders.length) next = Math.max(here, 0);
    const target = binders[next];
    setCursor(target.id);
    if (pick) {
      const ids = [here >= 0 ? binders[here].id : target.id, target.id];
      setSelected((now) => [...now, ...ids.filter((id, i) => !now.includes(id) && ids.indexOf(id) === i)]);
    }
    announce(`${target.name}, binder ${next + 1} of ${binders.length}${selected.includes(target.id) ? ', picked' : ''}`);
    try {
      listRef.current?.scrollToIndex({ index: Math.floor(next / columns), viewPosition: 0.5, animated: true });
    } catch { /* the shelf scrolls to it once it has measured the rows (see onScrollToIndexFailed) */ }
  }

  // Pick (or un-pick) the binder the keyboard is on
  function toggleCursor() {
    if (!cursor) return;
    toggleSelected(cursor);
    const name = binders.find((b) => b.id === cursor)?.name ?? 'Binder';
    announce(`${name} ${selected.includes(cursor) ? 'un-picked' : 'picked'}`);
  }

  // Pick every binder
  function pickAll() {
    setSelected(binders.map((b) => b.id));
    announce(`All ${binders.length} binders picked`);
  }

  // The binders a key like Copy or Delete is about: the picked ones, or if
  // none are picked, the one the keyboard is on
  function targetIds(): string[] {
    if (selected.length > 0) return selected;
    return cursor && binders.some((b) => b.id === cursor) ? [cursor] : [];
  }

  /* ----- Keys on a computer: arrows, Space, Shift, Ctrl+A, Enter, C, Delete, N, ? ----- */

  useShortcutKeys((event) => {
    // Ctrl (or Cmd) + A picks everything; every other Ctrl key belongs to the browser
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === 'a' && binders.length > 0) { event.preventDefault(); pickAll(); }
      return;
    }
    // Space and Enter on a focused button already press it (the browser does
    // that), so they're left to it. The arrow keys take the focus off it first.
    const onAButton = Boolean((event.target as HTMLElement).closest?.('button, [role="button"], a'));
    const arrows: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };

    if (event.key in arrows) {
      event.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
      moveCursor(arrows[event.key], event.shiftKey);
    } else if (event.key === ' ' && !onAButton && cursor) {
      event.preventDefault();
      toggleCursor();
    } else if (event.key === 'Enter' && !onAButton) {
      if (selected.length > 0) { event.preventDefault(); setSelectionOpen(true); }
      else if (cursor) { event.preventDefault(); openBinder(cursor); }
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      const ids = targetIds();
      if (ids.length > 0) { event.preventDefault(); setSelected([]); deleteBinders(ids); }
    } else if (event.key.toLowerCase() === 'c') {
      const ids = targetIds();
      if (ids.length > 0) { event.preventDefault(); setSelected([]); copyBinders(ids); }
    } else if (event.key === '?') {
      event.preventDefault();
      setShortcutsOpen(true);
    } else if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      setNewOpen(true);
    }
  }, { allowCtrl: true });

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
    // Nothing shifts while the binder is over Edit, Copy or Delete
    if (!drag?.lifted || zoneAt(drag)) return { x: 0, y: 0 };
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
  // with the button held down): get ready to move it. A finger picks the
  // binder up straight away (with a small buzz), and the Edit, Copy and
  // Delete boxes appear along the bottom. A mouse picks it up once it moves.
  function startDrag(id: string, from: number, absX: number, absY: number) {
    screenRef.current?.measureInWindow((x, y) => { screenAt.current = { x, y }; });
    setDrag({ id, from, dx: 0, dy: 0, absX, absY, lifted: !withMouse });
    if (!withMouse) hapticTap();
  }

  // Which box (Edit, Copy or Delete) the picked-up binder is over, if any.
  // Only a finger has the boxes. The finger's place is measured from the
  // screen's own corner, the same as the boxes' places.
  function zoneAt(d: Drag): Zone | null {
    if (withMouse || !d.lifted) return null;
    const x = d.absX - screenAt.current.x;
    const y = d.absY - screenAt.current.y;
    for (const { zone } of ZONES) {
      const box = zoneBoxes.current[zone];
      if (!box) continue;
      const top = barTop.current + box.y;
      // A little extra room above, so a thumb needn't be exact
      if (x >= box.x && x <= box.x + box.w && y >= top - 24 && y <= top + box.h) return zone;
    }
    return null;
  }

  // The finger (or mouse) moved: once it has moved far enough, the binder
  // is picked up (with a small buzz on a phone) and follows it
  function moveDrag(dx: number, dy: number, absX: number, absY: number) {
    setDrag((d) => {
      if (!d) return d;
      const lifted = d.lifted || withMouse || Math.hypot(dx, dy) >= LIFT_DISTANCE;
      if (lifted && !d.lifted) hapticTap();
      return { ...d, dx, dy, absX, absY, lifted };
    });
  }

  // Let go: move the binder to its new spot (if it changed). (This also
  // runs after a plain tap or click, when nothing was dragged.)
  // Let go over Edit, Copy or Delete: do that to the binder instead.
  function endDrag() {
    const d = dragRef.current;
    if (!d) return;
    setDrag(null);
    dragEnded.current = Date.now();
    if (!d.lifted) return;
    const zone = zoneAt(d);
    if (zone === 'edit') { setEditingId(d.id); return; }
    if (zone === 'copy') { copyBinders([d.id]); return; }
    if (zone === 'delete') { setDeletingId(d.id); return; }
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

  // The part above the binders: search, "Saved on this device only" (when it is), and Add binder
  // (the Binders / Lists / Decks switch is up in the screen's header)
  const header = (
    <View style={styles.header}>
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
        ref={listRef}
        // The keyboard asked to scroll to a row that isn't measured yet: go
        // by the average row height instead
        onScrollToIndexFailed={(info) => listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })}
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
              selected={selected.includes(binder.id)}
              cursor={binder.id === cursor}
              // With Ctrl held, a click picks the binder instead of opening it
              onOpen={() => (ctrlHeld.current ? toggleSelected(binder.id) : openBinder(binder.id))}
              onHold={() => { hapticTap(); setMenuId(binder.id); }}
              onEdit={() => setEditingId(binder.id)}
              onCopy={() => copyBinders([binder.id])}
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

      {/* While a binder is held with a finger: three boxes along the bottom,
          Edit on the left, Copy in the middle and a red Delete on the right.
          Let go over one to do it (Delete still asks "Are you sure?"); the
          box under the binder lights up. */}
      {drag?.lifted && !withMouse && (
        <View style={styles.zoneBar} onLayout={(event) => { barTop.current = event.nativeEvent.layout.y; }}>
          {ZONES.map(({ zone, label, icon }) => {
            const over = zoneAt(drag) === zone;
            const red = zone === 'delete';
            return (
              <View
                key={zone}
                onLayout={(event) => { const l = event.nativeEvent.layout; zoneBoxes.current[zone] = { x: l.x, y: l.y, w: l.width, h: l.height }; }}
                style={[
                  styles.zone,
                  {
                    backgroundColor: red ? colors.danger : colors.surface,
                    borderColor: over ? colors.accent : red ? colors.danger : colors.border,
                  },
                  over && styles.zoneOver,
                ]}
              >
                <Ionicons name={icon} size={22} color={red ? '#ffffff' : colors.text} />
                <Text style={[styles.zoneText, { color: red ? '#ffffff' : colors.text }]}>{label}</Text>
              </View>
            );
          })}
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
          {/* Its options: Edit (name, pages, cover), Copy and Delete */}
          <View style={styles.menu}>
            <Button label="Edit" icon="create-outline" kind="secondary"
                    onPress={() => { setMenuId(null); setEditingId(menuBinder.id); }} />
            <Button label="Copy" icon="copy-outline" kind="secondary" disabled={adding}
                    onPress={() => { setMenuId(null); copyBinders([menuBinder.id]); }} />
            <Button label="Delete" icon="trash-outline" kind="danger"
                    onPress={() => { setMenuId(null); setDeletingId(menuBinder.id); }} />
          </View>
        </PopupWindow>
      )}
      {/* Several binders picked with Ctrl: copy them or delete them */}
      {selectionOpen && (
        <PopupWindow title={`${selected.length} binder${selected.length === 1 ? '' : 's'} selected`} onClose={closeSelection}
                     buttons={[{ label: 'Cancel', onPress: closeSelection, kind: 'secondary' }]}>
          <Text style={[styles.selectionText, { color: colors.text }]}>
            {binders.filter((b) => selected.includes(b.id)).map((b) => b.name).join(', ')}
          </Text>
          <View style={styles.menu}>
            <Button label={selected.length === 1 ? 'Copy it' : 'Copy them'} icon="copy-outline" kind="secondary" disabled={adding}
                    onPress={() => { const ids = selected; closeSelection(); copyBinders(ids); }} />
            <Button label={selected.length === 1 ? 'Delete it' : 'Delete them'} icon="trash-outline" kind="danger"
                    onPress={() => { const ids = selected; closeSelection(); deleteBinders(ids); }} />
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
   and it is picked up; then slide it (moving sooner scrolls the shelf
   instead). While it is held, Edit, Copy and Delete boxes show along the
   bottom of the screen to drop it on. With a mouse, press the button and
   move. Holding the mouse button still for half a second shows its
   options instead, and so does a right-click.
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
  selected: boolean;          // it's picked (Ctrl-click, or Space): drawn with a frame and a tick
  cursor: boolean;            // the keyboard is on it: drawn with an outline
  onMeasure: (height: number) => void;
  onDragStart: (absX: number, absY: number) => void;
  onDragMove: (dx: number, dy: number, absX: number, absY: number) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onHold: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const { binder, count, width, position, withMouse, shiftX, shiftY, lifted, selected, cursor } = props;
  const colors = useColors();

  // The drag. With a finger it only starts once the finger has rested
  // still for REST_MS; with a mouse, once it has moved a few points with
  // the button held down. x and y count from where it started.
  const pan = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: withMouse ? 0 : REST_MS,
    minDistance: withMouse ? 6 : undefined,
    // On the website: let a finger's up-and-down swipe scroll the shelf. The
    // gesture would otherwise tell the browser "don't scroll here" (touch-action
    // none) over every binder. The detector's own touchAction prop below is not
    // enough.
    // @ts-expect-error touchAction works on the website but isn't in the typed list
    touchAction: 'pan-y',
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
            { name: 'copy', label: 'Copy' },
            { name: 'delete', label: 'Delete' },
            { name: 'earlier', label: 'Move earlier' },
            { name: 'later', label: 'Move later' },
          ]}
          onAccessibilityAction={(event) => {
            const action = event.nativeEvent.actionName;
            if (action === 'edit') props.onEdit();
            else if (action === 'copy') props.onCopy();
            else if (action === 'delete') props.onDelete();
            else props.onMove(action === 'earlier' ? -1 : 1);
          }}
          onPress={props.onOpen}
          onLongPress={withMouse ? props.onHold : undefined}
          // On a computer a right-click shows the same options (Edit and
          // Delete) instead of the browser's own menu. (The website's
          // "contextmenu" event is not in the phone types, so it's added
          // through a plain object.)
          {...(withMouse ? { onContextMenu: (event: { preventDefault: () => void }) => { event.preventDefault(); props.onHold(); } } : {})}
          delayLongPress={MENU_HOLD_MS}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          {/* The binder, with a frame and a tick over it while it's picked */}
          <View>
            <ClosedBinder width={width} name={binder.name} colorCode={binder.color} cover={binder.cover} />
            {/* An outline just outside the binder while the keyboard is on it */}
            {cursor && <View pointerEvents="none" style={[styles.cursorFrame, { borderColor: colors.text }]} />}
            {selected && (
              <View pointerEvents="none" style={[styles.pickedFrame, { borderColor: colors.accent }]}>
                <View style={[styles.pickedTick, { backgroundColor: colors.accent }]}>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </View>
              </View>
            )}
          </View>
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
  // The Edit / Copy / Delete boxes along the bottom while a binder is held
  zoneBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 12, zIndex: 60 },
  zone: { flex: 1, minHeight: 64, borderRadius: RADIUS, borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  zoneOver: { transform: [{ scale: 1.06 }] },
  zoneText: { fontSize: 17, fontWeight: '700' },
  menu: { gap: 8 },
  // The names of the picked binders, above the Copy and Delete buttons
  selectionText: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  // A picked binder: a frame over it, and a tick in its top corner
  pickedFrame: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderRadius: RADIUS, alignItems: 'flex-end' },
  // The keyboard's place: an outline around the binder (a little outside it)
  cursorFrame: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderWidth: 2, borderRadius: RADIUS + 3, borderStyle: 'dashed' },
  pickedTick: { margin: 4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: RADIUS * 1.4, marginTop: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 15, textAlign: 'center', marginBottom: 6 },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  welcomeTitle: { fontSize: 24, fontWeight: '700' },
  welcomeText: { fontSize: 16, textAlign: 'center', lineHeight: 22, maxWidth: 420 },
});
