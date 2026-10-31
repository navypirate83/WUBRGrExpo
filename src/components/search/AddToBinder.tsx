/* =====================================================================
   ADD TO A BINDER OR A LIST (the round orange "+" beside the card on
   the Card Finder)
   - Opened from a binder's pocket (the address has "?binder=<id>", and
     maybe "&binderPage=3&binderSlot=5")? "+" puts the card straight into
     that binder (that pocket, or its first empty one).
   - Opened from a list ("?list=<id>")? "+" puts the card at the end of
     that list.
   - Opened on its own? "+" asks where it should go, with two panels that
     rise from the bottom of the screen ("sheets"), one after the other:
       1. "Add to a binder or a list?": Binder, or List
       2. then "Add to which binder?" (one row per binder: a dot in its
          cover color, its name and card count; full binders can't be
          picked; then "New binder"), or "Add to which list?" (one row
          per list, with its card count; a list that already has this
          card can't be picked; then "New list")
     "New binder" opens the New binder window, and "New list" a small
     window to name the list; either is made with the card in it.
   Only shown to someone using the binders (signed in, or locally).
   Afterwards it opens the binder (at the page with the new card) or the
   list the card went into.
   ===================================================================== */

import { useImperativeHandle, useState, type Ref } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import NewBinderDialog from '@/components/binders/NewBinderDialog';
import PopupWindow from '@/components/PopupWindow';
import TextField from '@/components/TextField';
import CoverSwatch from '@/components/binders/CoverSwatch';
import {
  DEFAULT_PAGES, pocketsPerPage,
  binderName, binderPages, cardCountText, firstEmptyPocket, hasBinderCopy, isLocalMode, loadBinder, loadBinderList,
  pocketKey, samePrinting, saveBinder, saveBinderList, type Binder, type BinderCard,
} from '@/lib/binderStorage';
import { DriveError, createBinderFile, createListFile, syncBinder } from '@/lib/googleDrive';
import { coverLook } from '@/lib/covers';
import {
  addCardToList, addListToDevice, findList, loadLists, nextListName, type CardList, type ListCard,
} from '@/lib/listStorage';
import { hapticTap } from '@/lib/haptics';
import { useColors } from '@/hooks/useTheme';
import { PickerSheet, ROW_HEIGHT } from './PickerSheet';

// What the card area can ask this button to do (the A key on a computer)
export type AddToBinderHandle = { activate: () => void };

// The screen's address details ("?binder=...&binderPage=3"), as Expo
// Router hands them over: each one is text, a list of texts (if it's in
// the address twice), or missing
export type AddressParams = Record<string, string | string[] | undefined>;

type Props = {
  // The card being shown, as a binder saves it, and as a list saves it
  // (made when it's added)
  cardEntry: () => BinderCard;
  listEntry: () => ListCard;
  // The list this screen was opened from, if any: the "+" adds to it
  toList: string | null;
  // The binder this screen was opened from, and the pocket to fill (from
  // the address), if any
  fromBinder: string | null;
  pocket: { page: number; slot: number } | null;
  // Show a message under the search box (red if it's a problem), or
  // clear it (null)
  onMessage: (text: string | null, isError?: boolean) => void;
  // Where the button sits (the card area decides)
  style?: StyleProp<ViewStyle>;
  ref?: Ref<AddToBinderHandle>;
};

// One address detail as plain text (the first one, if it's there twice)
export function addressValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

// Read the pocket to fill from the address ("binderPage=3&binderSlot=5").
// It must be a real pocket; otherwise there's none.
export function pocketFromAddress(params: AddressParams): { page: number; slot: number } | null {
  const page = parseInt(addressValue(params.binderPage) ?? '', 10);
  const slot = parseInt(addressValue(params.binderSlot) ?? '', 10);
  const valid = page >= 1 && slot >= 1 && slot <= pocketsPerPage();
  return valid ? { page, slot } : null;
}

export default function AddToBinder({ cardEntry, listEntry, toList, fromBinder, pocket, onMessage, style, ref }: Props) {
  const colors = useColors();
  // Is the menu open, is the New binder window open, and is something
  // being saved (so nothing can be tapped twice)?
  // Which sheet is open ("kind": Binder or List?, then "binder" or
  // "list": which one?), whether the New binder window is open, the name
  // being typed in the New list window (null: closed), and whether
  // something is being saved (so nothing can be tapped twice)
  const [menu, setMenu] = useState<'kind' | 'binder' | 'list' | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newListName, setNewListName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Close the open sheet, then do the next thing (open another sheet or
  // window). iPhones can't open one pop-up while another is still fading
  // away, so there it waits a moment.
  function afterClosing(next: () => void) {
    setMenu(null);
    setTimeout(next, Platform.OS === 'ios' ? 350 : 0);
  }

  // Tapping "+": add straight to the list or binder it came from, or ask
  // where it should go.
  function activate() {
    if (busy) return;
    hapticTap();
    if (toList) addToList(toList);
    else if (fromBinder) addCardToBinder(fromBinder, pocket);
    else setMenu('kind');
  }

  // Put the card being shown at the end of a list (unless it's already
  // there), then go to the list
  function addToList(id: string) {
    setMenu(null);
    addCardToList(id, listEntry());
    onMessage(null);
    router.navigate(`/binders/list/${encodeURIComponent(id)}` as never);
  }

  // "Create" in the New list window: make the list (in Google Drive when
  // signed in) with the card in it, at the end of the lists, then go to it
  async function addCardToNewList() {
    const name = (newListName ?? '').trim() || nextListName();
    setNewListName(null);
    setBusy(true);
    onMessage('Making the new list…');
    try {
      const cards = [listEntry()];
      const file = await createListFile(name, cards);
      addListToDevice(file.id, name, cards);   // Drive already has these cards
      onMessage(null);
      setBusy(false);
      router.navigate(`/binders/list/${encodeURIComponent(file.id)}` as never);
    } catch (err) {
      driveProblem(err, 'Couldn\'t make the new list in Google Drive.');
      setBusy(false);
    }
  }
  // Let the card area press it too (the A key)
  useImperativeHandle(ref, () => ({ activate }));

  // A Drive problem: signed out says to sign in again; anything else says what went wrong.
  function driveProblem(err: unknown, what: string) {
    onMessage(err instanceof DriveError && err.signedOut
      ? 'Sign in again on the Home screen, then try again.'
      : `${what} ${(err as Error).message}`, true);
  }

  // Go to the binder the card went into, opened to the page with the new
  // card. (The binder screen then saves the change to Google Drive.)
  // This screen stays open behind the tabs, so first it's tidied up: the
  // message cleared, the "+" ready again, and the pocket it was asked to
  // fill forgotten (it's full now, so adding again from here goes to the
  // binder's first empty pocket instead of replacing this card).
  function goToBinder(id: string, page: number) {
    onMessage(null);
    setBusy(false);
    if (pocket) router.setParams({ binderPage: undefined, binderSlot: undefined });
    router.push(`/binders/${encodeURIComponent(id)}?page=${page}`);
  }

  // Save the card being shown into a binder: into "target" (a pocket),
  // or the binder's first empty pocket.
  async function addCardToBinder(id: string, target: { page: number; slot: number } | null) {
    setMenu(null);
    setBusy(true);
    // A binder picked from the menu may have been changed on another
    // device (or never opened on this one), so get its latest cards
    // from Google Drive first: otherwise the card could land in a pocket
    // that's already taken. (Used locally, this device has the only copy.)
    if (!fromBinder && !isLocalMode()) {
      onMessage('Getting your binder from Google Drive…');
      try {
        await syncBinder(id);
      } catch (err) {
        // Only go ahead if this device already has a copy to add to.
        if (!hasBinderCopy(id)) {
          driveProblem(err, 'Couldn\'t get your binder from Google Drive.');
          setBusy(false);
          return;
        }
      }
    }

    const cards = loadBinder(id);
    const spot = target ?? firstEmptyPocket(cards, binderPages(id));
    if (!spot) {
      onMessage('That binder is full. Tap a card in the binder to replace it.', true);
      setBusy(false);
      return;
    }
    const entry = cardEntry();
    cards[pocketKey(spot.page, spot.slot)] = entry;
    // Saved here, marked "needs saving to Drive" (The Shelf saves it there).
    if (!saveBinder(cards, id)) {
      onMessage('This device blocked saving, so the card could not be added.', true);
      setBusy(false);
      return;
    }
    goToBinder(id, spot.page);
  }

  // "Create binder" in the New binder window: make the new binder with the
  // card in its first pocket, at the end of the shelf, then go to it.
  async function addCardToNewBinder(name: string, color: string | null, cover: string) {
    setNewOpen(false);
    setBusy(true);
    onMessage('Making the new binder…');
    try {
      const entry = cardEntry();
      const cards = { [pocketKey(1, 1)]: entry };
      const list = loadBinderList();
      const file = await createBinderFile(name, cards, color, list.length, cover);
      saveBinderList([...list, { id: file.id, name, color, cover, pages: DEFAULT_PAGES }]);
      saveBinder(cards, file.id, { dirty: false });   // Drive already has these cards
      goToBinder(file.id, 1);
    } catch (err) {
      driveProblem(err, 'Couldn\'t make the new binder in Google Drive.');
      setBusy(false);
    }
  }

  // "New binder" in the menu: close the menu, then open the New binder window
  function openNewBinder() {
    afterClosing(() => setNewOpen(true));
  }

  // The binders and lists for the sheets, read fresh each time one opens,
  // with each binder's card count and whether it's full, and whether a
  // list already has this card
  const binders = menu ? loadBinderList() : [];
  const lists = menu ? loadLists() : [];
  const countOf = (binder: Binder) => Object.keys(loadBinder(binder.id)).length;
  const isFull = (binder: Binder) => countOf(binder) >= binderPages(binder.id) * pocketsPerPage();
  const hasCard = (list: CardList) => {
    const entry = cardEntry();
    return list.cards.some((c) => samePrinting(c, entry));
  };

  return (
    <>
      {/* The round "+" button (a spinning wheel while it's saving) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toList ? 'Add to list' : fromBinder ? 'Add to binder' : 'Add to a binder or a list'}
        accessibilityHint={toList ? `Puts this card into ${findList(toList)?.name ?? 'the list'}`
          : fromBinder ? `Puts this card into ${binderName(fromBinder)}` : 'Asks whether it goes in a binder or a list'}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={activate}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent, boxShadow: colors.shadow },
          pressed && styles.pressed,
          busy && styles.busy,
          style,
        ]}
      >
        {busy
          ? <ActivityIndicator color={colors.accentText} />
          : <Ionicons name="add" size={28} color={colors.accentText} />}
      </Pressable>

      {/* 1. "Add to a binder or a list?": Binder or List, each with its
          line drawing and how many there are */}
      {menu === 'kind' && (
        <PickerSheet
          title="Add to a binder or a list?"
          items={['binder', 'list'] as const}
          keyOf={(kind) => kind}
          labelOf={(kind) => (kind === 'binder' ? 'Binder' : 'List')}
          renderRow={(kind) => (
            <>
              <Image
                source={kind === 'binder'
                  ? require('../../../assets/images/binder-outline.svg')
                  : require('../../../assets/images/notebook-outline.svg')}
                style={styles.kindPicture} contentFit="contain" tintColor={colors.text} />
              <Text style={[styles.name, { color: colors.text }]}>{kind === 'binder' ? 'Binder' : 'List'}</Text>
              <Text style={[styles.count, { color: colors.muted }]}>
                {kind === 'binder'
                  ? `${binders.length} ${binders.length === 1 ? 'binder' : 'binders'}`
                  : `${lists.length} ${lists.length === 1 ? 'list' : 'lists'}`}
              </Text>
            </>
          )}
          onPick={(kind) => afterClosing(() => setMenu(kind))}
          onClose={() => setMenu(null)}
        />
      )}

      {/* 2. "Add to which list?": one row per list, then "New list" */}
      {menu === 'list' && (
        <PickerSheet
          title="Add to which list?"
          items={lists}
          keyOf={(list) => list.id}
          labelOf={(list) => `${list.name}, ${hasCard(list) ? 'already has this card' : cardCountText(list.cards.length)}`}
          isDisabled={(list) => busy || hasCard(list)}
          renderRow={(list) => (
            <>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{list.name}</Text>
              <Text style={[styles.count, { color: colors.muted }]}>
                {hasCard(list) ? 'Already in it' : cardCountText(list.cards.length)}
              </Text>
            </>
          )}
          onPick={(list) => addToList(list.id)}
          onClose={() => setMenu(null)}
          // The "New list" row at the end: a "+" in an orange dot, with a
          // thin line above it (unless it's the only row)
          footer={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New list"
              disabled={busy}
              onPress={() => afterClosing(() => setNewListName(nextListName()))}
              style={({ pressed }) => [
                styles.newRow,
                lists.length > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.surfaceHover },
              ]}
            >
              <View style={[styles.dot, styles.plusDot, { backgroundColor: colors.accent }]}>
                <Ionicons name="add" size={18} color="#ffffff" />
              </View>
              <Text style={[styles.name, { color: colors.text }]}>New list</Text>
            </Pressable>
          }
        />
      )}

      {/* 2. "Add to which binder?" */}
      {menu === 'binder' && (
        <PickerSheet
          title="Add to which binder?"
          items={binders}
          keyOf={(binder) => binder.id}
          labelOf={(binder) => {
            const count = countOf(binder);
            return `${binder.name}, ${isFull(binder) ? 'full' : `${count} ${count === 1 ? 'card' : 'cards'}`}`;
          }}
          isDisabled={(binder) => busy || isFull(binder)}
          renderRow={(binder) => {
            const count = countOf(binder);
            return (
              <>
                {/* A little dot in the binder's cover color */}
                <CoverSwatch shades={coverLook(binder.cover).shades} style={styles.dot} />
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{binder.name}</Text>
                <Text style={[styles.count, { color: colors.muted }]}>
                  {isFull(binder) ? 'Full' : `${count} ${count === 1 ? 'card' : 'cards'}`}
                </Text>
              </>
            );
          }}
          onPick={(binder) => addCardToBinder(binder.id, null)}
          onClose={() => setMenu(null)}
          // The "New binder" row at the end: a "+" in an orange dot, with
          // a thin line above it (unless it's the only row)
          footer={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New binder"
              disabled={busy}
              onPress={openNewBinder}
              style={({ pressed }) => [
                styles.newRow,
                binders.length > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.surfaceHover },
              ]}
            >
              <View style={[styles.dot, styles.plusDot, { backgroundColor: colors.accent }]}>
                <Ionicons name="add" size={18} color="#ffffff" />
              </View>
              <Text style={[styles.name, { color: colors.text }]}>New binder</Text>
            </Pressable>
          }
        />
      )}

      {/* The New binder window */}
      {newOpen && (
        <NewBinderDialog onCreate={addCardToNewBinder} onCancel={() => setNewOpen(false)} />
      )}

      {/* The New list window: its name (a name like "List 2" is filled in) */}
      {newListName !== null && (
        <PopupWindow title="New list" onClose={() => setNewListName(null)}
                     buttons={[
                       { label: 'Cancel', onPress: () => setNewListName(null), kind: 'secondary' },
                       { label: 'Create list', onPress: addCardToNewList },
                     ]}>
          <TextField
            label="Name"
            value={newListName}
            onChangeText={setNewListName}
            onSubmitEditing={addCardToNewList}
            returnKeyType="done"
            autoFocus
            selectTextOnFocus
            maxLength={40}
            autoCapitalize="words"
          />
        </PopupWindow>
      )}
    </>
  );
}

// The look: a round 48-point button (big enough for a thumb), and the
// menu's rows (the dot, the name taking the spare room, then the count)
const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.94 }] },
  busy: { opacity: 0.7 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  plusDot: { alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  name: { flex: 1, minWidth: 0, fontSize: 16 },
  // The Binder / List rows' line drawings
  kindPicture: { width: 32, height: 26 },
  count: { fontSize: 13 },
  newRow: {
    height: ROW_HEIGHT, paddingHorizontal: 10, marginTop: 4, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
});
