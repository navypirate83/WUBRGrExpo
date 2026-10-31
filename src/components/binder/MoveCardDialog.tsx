/* =====================================================================
   THE "MOVE CARD TO…" LIST
   Opens when a card is dropped on the blue move circle (or "Move to
   another binder" in the card's menu, or the M key on a computer).
   It's a list that pops up from the bottom over everything (the same
   kind as the Card Finder's "Add to which binder?"): one row for each of
   your other binders, with its cover color and card count. Tap one and
   the card goes into that binder's first empty pocket (and leaves this
   one). "New binder" at the end opens the New binder window, and makes
   a new binder with just this card.
   If the pocket has several copies, the top of the list also asks how
   many to move (− and + buttons); the rest stay here. Copies moved into
   a binder that already has the same printing are added to that
   pocket's count.
   The other binder is fetched fresh from Google Drive first, so cards
   added to it on another device aren't overwritten.
   ===================================================================== */

import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  DEFAULT_PAGES, pocketsPerPage,
  binderName, binderPages, cardCount, firstEmptyPocket, isLocalMode, loadBinder, loadBinderList,
  pocketKey, samePrinting, saveBinder, saveBinderList, withCount,
  type Binder, type BinderCard,
} from '@/lib/binderStorage';
import { createBinderFile, isSignedIn, signInWithGoogle, syncBinder } from '@/lib/googleDrive';
import { coverLook } from '@/lib/covers';
import { useColors } from '@/hooks/useTheme';
import { PickerSheet, ROW_HEIGHT } from '@/components/search/PickerSheet';
import CoverSwatch from '@/components/binders/CoverSwatch';
import NewBinderDialog from '@/components/binders/NewBinderDialog';

type Props = {
  binderId: string;
  card: BinderCard;
  // The copies are safely in the other binder: "note" says where they
  // went, "amount" how many
  onMoved: (note: string, amount: number) => void;
  onCancel: () => void;
};

export default function MoveCardDialog({ binderId, card, onMoved, onCancel }: Props) {
  const colors = useColors();
  const owned = cardCount(card);
  // How many to move (starting at all of them), whether a move is being
  // saved, the message line, what's showing ("list", or "new" for the
  // New binder window, with "closing" between the two), and a number
  // that goes up to redraw the list once fresher card counts arrive
  // from Drive
  const [amount, setAmount] = useState(owned);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>({ text: '' });
  const [stage, setStage] = useState<'list' | 'closing' | 'new'>('list');
  const [, setCountsChanged] = useState(0);

  // The other binders, and each one's card count (and whether it's full)
  const others = loadBinderList().filter((b) => b.id !== binderId);
  const countOf = (binder: Binder) => Object.keys(loadBinder(binder.id)).length;
  const isFull = (binder: Binder) => countOf(binder) >= binderPages(binder.id) * pocketsPerPage();

  // The counts come from this device's copies, which can be out of date
  // (a binder may have been filled on another device). So once the
  // list is open, fetch each other binder from Drive in the background
  // and redraw the list with the real counts. (Not signed in: the list
  // stays as is; the move itself always fetches the target fresh anyway.)
  useEffect(() => {
    if (!isSignedIn()) return;
    let open = true;
    const ids = loadBinderList().filter((b) => b.id !== binderId).map((b) => b.id);
    Promise.all(ids.map((id) => syncBinder(id).catch(() => { /* keep the old count */ })))
      .then(() => { if (open) setCountsChanged((n) => n + 1); });
    return () => { open = false; };
  }, [binderId]);

  // Make sure we're signed in to Google before saving to another binder
  // (opens Google's sign-in window if the sign-in has run out).
  async function ensureSignedIn() {
    if (!isLocalMode() && !isSignedIn()) await signInWithGoogle();
  }

  // Move the card (or some of its copies) into another binder. If that
  // binder already has the same printing, the copies are added to it;
  // otherwise they go into its first empty pocket.
  async function moveTo(targetId: string) {
    setBusy(true);
    setMessage({ text: 'Moving…' });
    try {
      await ensureSignedIn();
      // Get the other binder's latest cards from Drive (or send it any
      // changes this device has for it first).
      const cards = await syncBinder(targetId);
      const sameKey = Object.keys(cards).find((k) => samePrinting(cards[k], card));
      let page: number;
      if (sameKey) {
        // Already there: add to that pocket's count.
        cards[sameKey] = withCount(cards[sameKey], cardCount(cards[sameKey]) + amount);
        page = Number(sameKey.split('-')[0]);
      } else {
        // Not there yet: use its first gap.
        const spot = firstEmptyPocket(cards, binderPages(targetId));
        if (!spot) {
          setBusy(false);
          setMessage({ text: `"${binderName(targetId)}" is full.`, error: true });
          return;
        }
        cards[pocketKey(spot.page, spot.slot)] = withCount(card, amount);
        page = spot.page;
      }
      saveBinder(cards, targetId);   // keep it on this device (marked "needs saving")...
      await syncBinder(targetId);    // ...and save it to Drive
      onMoved(`✓ Moved ${amount > 1 ? `${amount} ` : ''}to ${binderName(targetId)}, page ${page}`, amount);
    } catch (err) {
      setBusy(false);
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  // "Create binder" in the New binder window: make that binder (at the
  // end of the shelf) holding just this card, in its first pocket
  async function moveToNew(name: string, color: string | null, cover: string) {
    setBusy(true);
    setMessage({ text: 'Making the new binder…' });
    try {
      await ensureSignedIn();
      const cards = { [pocketKey(1, 1)]: withCount(card, amount) };
      const list = loadBinderList();
      const file = await createBinderFile(name, cards, color, list.length, cover);
      saveBinderList([...list, { id: file.id, name, color, cover, pages: DEFAULT_PAGES }]);
      saveBinder(cards, file.id, { dirty: false });   // Drive already has these cards
      onMoved(`✓ Moved ${amount > 1 ? `${amount} ` : ''}to new binder ${name}`, amount);
    } catch (err) {
      // Back to the list, which shows what went wrong
      setBusy(false);
      setMessage({ text: (err as Error).message, error: true });
      switchTo('list');
    }
  }

  // Swap between the list and the New binder window: close one, then
  // open the other. (iPhones can't open one pop-up while another is
  // still fading away, so there it waits a moment.)
  function switchTo(next: 'list' | 'new') {
    setStage('closing');
    setTimeout(() => setStage(next), Platform.OS === 'ios' ? 350 : 0);
  }
  // "New binder" in the list
  const openNewBinder = () => switchTo('new');

  // The New binder window, once "New binder" was tapped (nothing while
  // the list fades away). Its Cancel closes everything: the card stays
  // where it is.
  if (stage === 'new') return <NewBinderDialog onCreate={moveToNew} onCancel={onCancel} />;
  if (stage === 'closing') return null;

  return (
    <PickerSheet
      title={`Move "${card.name}" to…`}
      items={others}
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
      onPick={(binder) => moveTo(binder.id)}
      onClose={onCancel}
      // Above the binders: how many copies to move (only when the pocket
      // holds several), then "Moving…" or a problem (in red)
      header={
        <>
          {owned > 1 && (
            <View style={styles.amountRow}>
              <Text style={[styles.amountLabel, { color: colors.text }]}>How many to move</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="One fewer" hitSlop={4}
                         disabled={busy || amount <= 1} onPress={() => setAmount(amount - 1)}
                         style={({ pressed }) => [styles.step, { borderColor: colors.border }, pressed && styles.pressed, (busy || amount <= 1) && styles.faded]}>
                <Ionicons name="remove" size={20} color={colors.text} />
              </Pressable>
              <Text style={[styles.amount, { color: colors.text }]} accessibilityLabel={`${amount} of ${owned}`}>
                {amount} <Text style={{ color: colors.muted }}>of {owned}</Text>
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="One more" hitSlop={4}
                         disabled={busy || amount >= owned} onPress={() => setAmount(amount + 1)}
                         style={({ pressed }) => [styles.step, { borderColor: colors.border }, pressed && styles.pressed, (busy || amount >= owned) && styles.faded]}>
                <Ionicons name="add" size={20} color={colors.text} />
              </Pressable>
            </View>
          )}
          {message.text ? (
            <Text style={[styles.message, { color: message.error ? colors.error : colors.muted }]} accessibilityLiveRegion="polite">
              {message.text}
            </Text>
          ) : null}
        </>
      }
      // The "New binder" row at the end: a "+" in an orange dot, with a
      // thin line above it (unless it's the only row)
      footer={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New binder"
          disabled={busy}
          onPress={openNewBinder}
          style={({ pressed }) => [
            styles.newRow,
            others.length > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            pressed && { backgroundColor: colors.surfaceHover },
            busy && styles.faded,
          ]}
        >
          <View style={[styles.dot, styles.plusDot, { backgroundColor: colors.accent }]}>
            <Ionicons name="add" size={18} color="#ffffff" />
          </View>
          <Text style={[styles.name, { color: colors.text }]}>New binder</Text>
        </Pressable>
      }
    />
  );
}

// The list's look: the "how many" row (− 2 of 3 +), and each binder's
// row (the cover dot, the name taking the spare room, then the count)
const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  amountLabel: { flex: 1, fontSize: 16 },
  step: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  amount: { minWidth: 56, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  message: { paddingHorizontal: 10, paddingBottom: 8, fontSize: 14 },
  pressed: { opacity: 0.6 },
  faded: { opacity: 0.4 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1 },
  plusDot: { alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  name: { flex: 1, minWidth: 0, fontSize: 16 },
  count: { fontSize: 13 },
  newRow: {
    height: ROW_HEIGHT, paddingHorizontal: 10, marginTop: 4, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
});
