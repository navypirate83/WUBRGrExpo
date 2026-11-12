/* =====================================================================
   SEARCH YOUR BINDERS
   The search bar at the top of The Shelf and above every binder's
   pages. It only looks at the cards in your binders (this device's
   copies of them), with the same forgiving search as the Card Finder:
   part of a name, any spacing or punctuation, and small typos all
   still find the card.
   As you type, a list drops down: each card found, with the binder and
   page it's in. Tapping one (or the keyboard's Search key, which picks
   the top one) opens that binder at that page, with the card's pocket
   highlighted.
   In a binder, a switch sits beside the bar, with a word under it:
   "Current" (on, the start) searches only that binder; tapping it
   switches to "Shelf", which searches every binder on the shelf.
   In a binder searching "Current", what's typed also narrows the binder's
   own cards as you type (the binder screen does that: it's told the text
   through "onQuery"), so the list drops down only when what's typed isn't
   already an exact card name: then it suggests the closest names, to
   tap. Searching the whole "Shelf" always shows the list, since the
   cards are in other binders.
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { cardCount, loadBinder, loadBinderList } from '@/lib/binderStorage';
import { fuzzySearch, matchParts, prepareNames } from '@/lib/nameSearch';
import { isExactName } from '@/lib/nameFilter';
import { useColors } from '@/hooks/useTheme';
import TextField from '@/components/TextField';
import { RADIUS } from '@/theme/colors';

// Start searching once this many letters are typed, and wait this long
// (milliseconds) after a key press, so it doesn't search on every letter
const MIN_CHARS = 2;
const TYPING_PAUSE_MS = 120;

// Show at most this many results in the list
const MAX_RESULTS = 50;

// One card found: its name, the binder it's in, the pocket ("3-5"), the
// page number, and how many copies are in that pocket
type Found = { name: string; binderId: string; binderName: string; key: string; page: number; count: number };

// Every card in the binders being searched (all of them, or just one)
function cardsInBinders(onlyBinderId: string | null): Found[] {
  const found: Found[] = [];
  for (const binder of loadBinderList()) {
    if (onlyBinderId && binder.id !== onlyBinderId) continue;
    const cards = loadBinder(binder.id);
    for (const [key, card] of Object.entries(cards)) {
      found.push({ name: card.name, binderId: binder.id, binderName: binder.name, key,
        page: Number(key.split('-')[0]), count: cardCount(card) });
    }
  }
  return found;
}

// Search the binders for what's typed: the fuzzy search ranks the card
// NAMES (best matches first), then each name's pockets are listed in
// binder order, page by page.
function searchBinders(text: string, onlyBinderId: string | null): Found[] {
  const cards = cardsInBinders(onlyBinderId);
  const names = [...new Set(cards.map((c) => c.name))];
  const ranked = fuzzySearch(prepareNames(names), text);
  const results: Found[] = [];
  for (const name of ranked) {
    for (const card of cards) if (card.name === name) results.push(card);
    if (results.length >= MAX_RESULTS) break;
  }
  return results.slice(0, MAX_RESULTS);
}

type Props = {
  // In a binder: that binder's id (for the "Current binder" switch)
  currentBinderId?: string;
  // Told what's typed, on every key press, while searching only this binder
  // (empty when the whole shelf is being searched, or after a card is picked)
  onQuery?: (text: string) => void;
  // A number the binder screen raises to empty the box (after you jump to a card)
  clearToken?: number;
};

export default function BinderSearch({ currentBinderId, onQuery, clearToken }: Props) {
  const colors = useColors();
  // What's typed, whether to search only this binder, the results (null
  // while the list is closed), and which result the arrow keys highlight
  // on a computer (-1 = none)
  const [text, setText] = useState('');
  const [onlyThis, setOnlyThis] = useState(true);
  const [results, setResults] = useState<Found[] | null>(null);
  const [active, setActive] = useState(-1);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchedFor = useRef('');

  // The binder to limit the search to (if the switch is on)
  const limitTo = currentBinderId && onlyThis ? currentBinderId : null;

  // The binder screen asks for the box to be emptied (the card was jumped to)
  const firstToken = useRef(clearToken);
  useEffect(() => {
    if (clearToken === firstToken.current) return;
    setText('');
    closeList();
  }, [clearToken]);

  // Close the list (and stop a search still waiting to run).
  function closeList() {
    clearTimeout(typingTimer.current);
    setResults(null);
    setActive(-1);
  }

  // Search now, for this text (nothing for fewer than MIN_CHARS letters).
  function runSearch(value: string, only: string | null) {
    clearTimeout(typingTimer.current);
    if (value.trim().length < MIN_CHARS) { closeList(); return; }
    searchedFor.current = value;
    const found = searchBinders(value, only);
    // Searching this binder, and what's typed is exactly a card's name: the
    // binder is already narrowed to it, so no list of suggestions
    if (only && isExactName(found.map((card) => card.name), value)) { closeList(); return; }
    setResults(found);
    setActive(-1);
  }

  // Every time the text changes: search after a short pause in typing.
  function handleChange(value: string) {
    setText(value);
    onQuery?.(limitTo ? value : '');
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => runSearch(value, limitTo), TYPING_PAUSE_MS);
  }

  // Go to a card found: its binder, at its page, with its pocket
  // highlighted ("highlight=3-5" in the address tells the binder screen).
  function goTo(found: Found) {
    closeList();
    setText('');
    onQuery?.('');
    router.push(`/binders/${encodeURIComponent(found.binderId)}?page=${found.page}&highlight=${found.key}`);
  }

  // The keyboard's Search key (or Enter on a computer): go to the
  // highlighted result, or else the top one (searching first, if the
  // list isn't showing yet).
  function goToBest() {
    const list = results && searchedFor.current === text ? results : (text.trim().length >= MIN_CHARS ? searchBinders(text, limitTo) : []);
    const pick = list[active] ?? list[0];
    if (pick) goTo(pick);
    else if (text.trim().length >= MIN_CHARS) setResults([]);
  }

  // On a computer: the arrow keys move through the list, and Escape
  // closes it (or, with no list open, empties the box). Phones don't
  // send these keys.
  function handleKey(key: string) {
    const count = results?.length ?? 0;
    if (key === 'ArrowDown' && count) setActive((active + 1) % count);
    else if (key === 'ArrowUp' && count) setActive((active - 1 + count) % count);
    else if (key === 'Escape') { if (results) closeList(); else setText(''); }
  }

  // Stop a waiting search if the bar goes away.
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  return (
    <View style={styles.wrap} accessibilityRole="search">
      {/* The box (and, in a binder, the switch beside it) */}
      <View style={styles.searchRow}>
        {/* The box, with a magnifying glass button at its right end */}
        <View style={[styles.field, styles.grow]}>
          <TextField
            accessibilityLabel="Search your binders"
            placeholder={currentBinderId && onlyThis ? 'Search this binder…' : 'Search your binders…'}
            value={text}
            onChangeText={handleChange}
            onSubmitEditing={goToBest}
            onKeyPress={(event) => handleKey(event.nativeEvent.key)}
            // Leaving the box closes the list (a moment later, so a tap on
            // a result still counts)
            onBlur={() => setTimeout(closeList, 200)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.input}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={goToBest} hitSlop={6}
                     style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
            <Ionicons name="search" size={20} color={colors.muted} />
          </Pressable>
        </View>

        {/* In a binder: which binders to search, a switch with its word
            under it. "Current" (on): just this binder. "Shelf" (off): every
            binder. Changing it searches again straight away. */}
        {currentBinderId && (
          <View style={styles.scope}>
            <Switch
              value={onlyThis}
              onValueChange={(on) => {
                setOnlyThis(on);
                onQuery?.(on ? text : '');
                if (results !== null || text.trim().length >= MIN_CHARS) runSearch(text, on ? currentBinderId : null);
              }}
              trackColor={{ true: colors.accent, false: colors.switchTrack }}
              accessibilityLabel={onlyThis ? 'Searching the current binder. Switch to search the whole shelf' : 'Searching the whole shelf. Switch to search the current binder'}
            />
            <Text style={[styles.scopeWord, { color: colors.muted }]}>{onlyThis ? 'Current' : 'Shelf'}</Text>
          </View>
        )}
      </View>

      {/* The results, dropping down over whatever is below */}
      {results !== null && (
        <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
          <FlatList
            showsVerticalScrollIndicator={false}
            data={results}
            keyExtractor={(found) => `${found.binderId}-${found.key}`}
            // Taps on results work even while the keyboard is up
            keyboardShouldPersistTaps="handled"
            // Nothing found: say so (an intentional empty list)
            ListEmptyComponent={
              <Text style={[styles.noResults, { color: colors.muted }]}>
                No cards in {limitTo ? 'this binder' : 'your binders'} match.
              </Text>
            }
            renderItem={({ item: found, index }) => {
              // The part of the name that matches what was typed is highlighted
              const parts = matchParts(found.name, searchedFor.current);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${found.name}${found.count > 1 ? `, ${found.count} copies` : ''}, ${found.binderName}, page ${found.page}`}
                  onPress={() => goTo(found)}
                  style={({ pressed }) => [styles.result, { borderBottomColor: colors.border },
                    (pressed || index === active) && { backgroundColor: colors.surfaceHover }]}
                >
                  <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                    {parts.before}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{parts.match}</Text>
                    {parts.after}
                    {found.count > 1 && <Text style={{ color: colors.muted }}> ×{found.count}</Text>}
                  </Text>
                  <Text style={[styles.resultWhere, { color: colors.muted }]}>{found.binderName} · page {found.page}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      )}

    </View>
  );
}

// The bar's look. "zIndex" keeps the dropped-down results on top of
// what's under the bar (the shelf, or the binder's pages).
const styles = StyleSheet.create({
  wrap: { zIndex: 10, gap: 6 },
  field: { justifyContent: 'center' },
  input: { paddingRight: 44 },
  searchButton: { position: 'absolute', right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  results: { position: 'absolute', top: 48, left: 0, right: 0, maxHeight: 320, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
  noResults: { padding: 14, fontSize: 15 },
  result: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  resultName: { fontSize: 16 },
  resultWhere: { fontSize: 13, marginTop: 2 },
  // The box and the switch side by side; the box takes the spare room
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1 },
  // The switch with its word ("Current" or "Shelf") under it
  scope: { alignItems: 'center', width: 56 },
  scopeWord: { fontSize: 12, marginTop: 2 },
});
