/* =====================================================================
   SEARCH YOUR DECKS
   The search bar on the Decks page: the same look as the Lists page's
   search bar. It looks through two things at once, with the same
   forgiving search as the Card Finder (part of a name, odd spacing and
   small typos all still match):
   - your decks' NAMES
   - the CARDS inside your decks (the result says which deck has it)
   As you type, the matches drop down under the bar (decks first, then
   cards); tapping one opens that deck (for a card, the first deck that
   has it). The keyboard's Search key opens the best match.
   There is no "+" here: cards are added to a deck from inside the deck.
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { loadDecks, type Deck } from '@/lib/deckStorage';
import { deckFormat } from '@/lib/deckFormats';
import { fuzzySearch, matchParts, prepareNames } from '@/lib/nameSearch';
import { useColors } from '@/hooks/useTheme';
import TextField from '@/components/TextField';
import { RADIUS } from '@/theme/colors';

// Start searching once this many letters are typed, and wait this long
// (milliseconds) after a key press, so it doesn't search on every letter
const MIN_CHARS = 2;
const TYPING_PAUSE_MS = 120;

// One line in the drop-down: a deck found by its name, or a card found
// inside one or more decks
type Result =
  | { kind: 'deck'; key: string; deck: Deck }
  | { kind: 'card'; key: string; name: string; decks: Deck[] };

// The decks and cards that match what's typed, decks first, best matches first
function searchDecks(text: string): Result[] {
  const decks = loadDecks();
  // Decks by name
  const byName = fuzzySearch(prepareNames(decks.map((d) => d.name)), text)
    .flatMap((name) => decks.filter((d) => d.name === name))
    .map((deck): Result => ({ kind: 'deck', key: `deck-${deck.id}`, deck }));
  // Cards: every different card name in any deck, and which decks hold it
  const holders = new Map<string, Deck[]>();
  for (const deck of decks) {
    for (const card of deck.cards) {
      const have = holders.get(card.name) ?? [];
      if (!have.includes(deck)) holders.set(card.name, [...have, deck]);
    }
  }
  const byCard = fuzzySearch(prepareNames([...holders.keys()]), text)
    .map((name): Result => ({ kind: 'card', key: `card-${name}`, name, decks: holders.get(name) ?? [] }));
  return [...byName, ...byCard];
}

// The deck a result opens
const deckOf = (result: Result): Deck => (result.kind === 'deck' ? result.deck : result.decks[0]);

// "onPick" opens a deck (by its id)
export default function DeckSearch({ onPick }: { onPick: (id: string) => void }) {
  const colors = useColors();
  // What's typed, and the matches (null while the drop-down is closed)
  const [text, setText] = useState('');
  const [results, setResults] = useState<Result[] | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Every time the text changes: search after a short pause in typing
  // (nothing for fewer than MIN_CHARS letters)
  function handleChange(value: string) {
    setText(value);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setResults(value.trim().length >= MIN_CHARS ? searchDecks(value) : null);
    }, TYPING_PAUSE_MS);
  }

  // Open a deck: close the drop-down and empty the box first
  function pick(id: string) {
    clearTimeout(typingTimer.current);
    setResults(null);
    setText('');
    onPick(id);
  }

  // The keyboard's Search key: open the best match, if there is one
  function pickBest() {
    if (text.trim().length < MIN_CHARS) return;
    const best = searchDecks(text)[0];
    if (best) pick(deckOf(best).id);
    else setResults([]);
  }

  // Stop a waiting search if the bar goes away
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  return (
    <View style={styles.wrap} accessibilityRole="search">
      {/* The box, with a magnifying glass at its right end */}
      <View style={styles.field}>
        <TextField
          accessibilityLabel="Search your decks and the cards in them"
          placeholder="Search decks and their cards…"
          value={text}
          onChangeText={handleChange}
          onSubmitEditing={pickBest}
          // Leaving the box closes the drop-down (a moment later, so a
          // tap on a result still counts)
          onBlur={() => setTimeout(() => setResults(null), 200)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.searchIcon} pointerEvents="none">
          <Ionicons name="search" size={20} color={colors.muted} />
        </View>
      </View>

      {/* The matches, dropping down over whatever is below */}
      {results !== null && (
        <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
          <FlatList
            showsVerticalScrollIndicator={false}
            data={results}
            keyExtractor={(result) => result.key}
            keyboardShouldPersistTaps="handled"
            // Nothing matched (or there are no decks yet)
            ListEmptyComponent={<Text style={[styles.noResults, { color: colors.muted }]}>No decks or cards found.</Text>}
            renderItem={({ item }) => {
              const deck = deckOf(item);
              // A deck: its name and format. A card: its name, and the deck(s) it is in.
              const title = item.kind === 'deck' ? item.deck.name : item.name;
              const parts = matchParts(title, text);
              const about = item.kind === 'deck'
                ? deckFormat(item.deck.format).name
                : `in ${item.decks.map((d) => d.name).join(', ')}`;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${about}. Opens ${deck.name}.`}
                           onPress={() => pick(deck.id)}
                           style={({ pressed }) => [styles.result, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfaceHover }]}>
                  <Ionicons name={item.kind === 'deck' ? 'albums-outline' : 'document-outline'} size={18} color={colors.muted} />
                  <View style={styles.resultText}>
                    {/* The part of the name that matches what was typed is
                        highlighted (bold and orange), as in the Card Finder */}
                    <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                      {parts.before}
                      <Text style={{ color: colors.accent, fontWeight: '700' }}>{parts.match}</Text>
                      {parts.after}
                    </Text>
                    <Text style={[styles.resultAbout, { color: colors.muted }]} numberOfLines={1}>{about}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

// The bar's look, the same as the Lists page's search bar. "zIndex" keeps
// the drop-down on top of what's under the bar.
const styles = StyleSheet.create({
  wrap: { zIndex: 10 },
  field: { justifyContent: 'center' },
  input: { paddingRight: 44 },
  searchIcon: { position: 'absolute', right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  results: { position: 'absolute', top: 48, left: 0, right: 0, maxHeight: 320, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
  noResults: { padding: 14, fontSize: 15 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  resultText: { flex: 1 },
  resultName: { fontSize: 16 },
  resultAbout: { fontSize: 13 },
});
