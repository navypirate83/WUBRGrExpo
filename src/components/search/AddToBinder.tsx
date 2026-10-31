/* =====================================================================
   ADD TO BINDER (the round orange "+" beside the card on the Card Finder)
   - Opened from a binder's pocket (the address has "?binder=<id>", and
     maybe "&binderPage=3&binderSlot=5")? "+" puts the card straight into
     that binder (that pocket, or its first empty one).
   - Opened on its own? "+" opens the "Add to which binder?" sheet (a
     panel from the bottom of the screen): one row per binder (a dot in
     its cover color, its name and card count; full binders can't be
     picked), then "New binder", which makes a new binder with the card
     in it.
   Only shown to someone using the binders (signed in, or locally).
   Afterwards it opens the binder, at the page with the new card.
   ===================================================================== */

import { useImperativeHandle, useState, type Ref } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import NewBinderDialog from '@/components/binders/NewBinderDialog';
import CoverSwatch from '@/components/binders/CoverSwatch';
import {
  DEFAULT_PAGES, pocketsPerPage,
  binderName, binderPages, firstEmptyPocket, hasBinderCopy, isLocalMode, loadBinder, loadBinderList,
  pocketKey, saveBinder, saveBinderList, type Binder, type BinderCard,
} from '@/lib/binderStorage';
import { DriveError, createBinderFile, syncBinder } from '@/lib/googleDrive';
import { coverLook } from '@/lib/covers';
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
  // The card being shown, as a binder saves it (made when it's added)
  cardEntry: () => BinderCard;
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

export default function AddToBinder({ cardEntry, fromBinder, pocket, onMessage, style, ref }: Props) {
  const colors = useColors();
  // Is the menu open, is the New binder window open, and is something
  // being saved (so nothing can be tapped twice)?
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Tapping "+": add straight to the binder it came from, or open the menu.
  function activate() {
    if (busy) return;
    hapticTap();
    if (fromBinder) addCardToBinder(fromBinder, pocket);
    else setMenuOpen(true);
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
    setMenuOpen(false);
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

  // "New binder" in the menu: close the menu, then open the New binder
  // window. (iPhones can't open one pop-up while another is still
  // fading away, so there it waits a moment.)
  function openNewBinder() {
    setMenuOpen(false);
    setTimeout(() => setNewOpen(true), Platform.OS === 'ios' ? 350 : 0);
  }

  // The binders for the menu, read fresh each time it opens, with each
  // one's card count and whether it's full
  const binders = menuOpen ? loadBinderList() : [];
  const countOf = (binder: Binder) => Object.keys(loadBinder(binder.id)).length;
  const isFull = (binder: Binder) => countOf(binder) >= binderPages(binder.id) * pocketsPerPage();

  return (
    <>
      {/* The round "+" button (a spinning wheel while it's saving) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to binder"
        accessibilityHint={fromBinder ? `Puts this card into ${binderName(fromBinder)}` : 'Opens a list of your binders'}
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

      {/* "Add to which binder?" */}
      {menuOpen && (
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
          onClose={() => setMenuOpen(false)}
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
  count: { fontSize: 13 },
  newRow: {
    height: ROW_HEIGHT, paddingHorizontal: 10, marginTop: 4, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
});
