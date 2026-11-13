/* =====================================================================
   SEARCH YOUR LISTS
   The search bar on the Lists page: the same look as the binders' search
   bar, but it looks through your lists' names instead (with the same
   forgiving search as the Card Finder: part of a name, odd spacing and
   small typos all still match). As you type, the matching lists drop
   down under the bar; tapping one opens it (the keyboard's Search key
   opens the best match).
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { loadLists, type CardList } from '@/lib/listStorage';
import { fuzzySearch, matchParts, prepareNames } from '@/lib/nameSearch';
import { useColors } from '@/hooks/useTheme';
import TextField from '@/components/TextField';
import { RADIUS } from '@/theme/colors';

// Start searching once this many letters are typed, and wait this long
// (milliseconds) after a key press, so it doesn't search on every letter
const MIN_CHARS = 2;
const TYPING_PAUSE_MS = 120;

// The lists whose names match what's typed, best matches first
function searchLists(text: string): CardList[] {
  const lists = loadLists();
  const ranked = fuzzySearch(prepareNames(lists.map((l) => l.name)), text);
  return ranked.flatMap((name) => lists.filter((l) => l.name === name));
}

// "onPick" opens a list (by its id)
export default function ListSearch({ onPick }: { onPick: (id: string) => void }) {
  const colors = useColors();
  // What's typed, and the matches (null while the drop-down is closed)
  const [text, setText] = useState('');
  const [results, setResults] = useState<CardList[] | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Every time the text changes: search after a short pause in typing
  // (nothing for fewer than MIN_CHARS letters)
  function handleChange(value: string) {
    setText(value);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setResults(value.trim().length >= MIN_CHARS ? searchLists(value) : null);
    }, TYPING_PAUSE_MS);
  }

  // Open a list: close the drop-down and empty the box first
  function pick(id: string) {
    clearTimeout(typingTimer.current);
    setResults(null);
    setText('');
    onPick(id);
  }

  // The keyboard's Search key: open the best match, if there is one
  function pickBest() {
    if (text.trim().length < MIN_CHARS) return;
    const best = searchLists(text)[0];
    if (best) pick(best.id);
    else setResults([]);
  }

  // Stop a waiting search if the bar goes away
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  return (
    <View style={styles.wrap} accessibilityRole="search">
      {/* The box, with a magnifying glass at its right end */}
      <View style={styles.field}>
        <TextField
          accessibilityLabel="Search your lists"
          placeholder="Search your lists…"
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
            keyExtractor={(list) => list.id}
            keyboardShouldPersistTaps="handled"
            // Nothing matched (or there are no lists yet)
            ListEmptyComponent={<Text style={[styles.noResults, { color: colors.muted }]}>No lists found.</Text>}
            renderItem={({ item }) => {
              // The part of the name that matches what was typed is
              // highlighted (bold and orange), as in the Card Finder
              const parts = matchParts(item.name, text);
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}
                           onPress={() => pick(item.id)}
                           style={({ pressed }) => [styles.result, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfaceHover }]}>
                  <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                    {parts.before}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{parts.match}</Text>
                    {parts.after}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

// The bar's look, the same as the binders' search bar. "zIndex" keeps the
// drop-down on top of what's under the bar.
const styles = StyleSheet.create({
  wrap: { zIndex: 10 },
  field: { justifyContent: 'center' },
  input: { paddingRight: 44 },
  searchIcon: { position: 'absolute', right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  results: { position: 'absolute', top: 48, left: 0, right: 0, maxHeight: 320, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
  noResults: { padding: 14, fontSize: 15 },
  result: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44, justifyContent: 'center' },
  resultName: { fontSize: 16 },
});
