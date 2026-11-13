/* =====================================================================
   FIND CARDS TO ADD TO A DECK
   The search bar inside an opened deck. Type a card name and the matching
   cards DROP DOWN over the page under the bar (so nothing on the screen
   moves; with the same forgiving search as the Card Finder: part of a name,
   odd spacing and small typos all still match). Each line has a "+":
   tapping it adds that card to the deck, one copy each time, and the
   drop-down stays open so more can be added. Leaving the box closes it. The printing added is the first one that comes up
   (change it later by opening the card in the deck).
   The switch under the bar, "Only cards in my binders", narrows the
   search to the cards you own in your binders (a card on a list doesn't
   count: lists are wishes, not cards you own). With it on, the copy
   added is the printing you own.
   The deck screen does the adding (and the warning for too many copies);
   this bar just says which card name was chosen.
   ===================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { loadCardNames } from '@/lib/scryfall';
import { fuzzySearch, matchParts, prepareNames } from '@/lib/nameSearch';
import { loadBinder, loadBinderList } from '@/lib/binderStorage';
import { useColors } from '@/hooks/useTheme';
import TextField from '@/components/TextField';
import { RADIUS } from '@/theme/colors';

// Start searching at this many letters, and show at most this many lines
const MIN_CHARS = 2;
const MAX_RESULTS = 12;

type Props = {
  // A "+" was tapped: the card's name, and whether the switch is on (so
  // the printing you own should be used)
  onAdd: (name: string, ownedOnly: boolean) => void;
  // A message to show under the bar (like "Added Sol Ring"), if any
  note?: string;
};

export default function DeckAddSearch({ onAdd, note }: Props) {
  const colors = useColors();
  const [text, setText] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);
  // Is the drop-down showing? It opens when the box is used and closes when
  // you leave it (a moment later, so a tap on a "+" still counts and keeps it open)
  const [open, setOpen] = useState(false);
  const keepOpen = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Every card name (downloaded once, shared with the Card Finder)
  const allNames = useQuery({ queryKey: ['card-names'], queryFn: loadCardNames, select: prepareNames });
  // The names of the cards in your binders (read when the switch goes on)
  const ownedNames = useMemo(() => {
    if (!ownedOnly) return [];
    const names = new Set<string>();
    for (const binder of loadBinderList()) {
      for (const card of Object.values(loadBinder(binder.id))) names.add(card.name);
    }
    return prepareNames([...names]);
  }, [ownedOnly]);

  // The matches for what's typed
  const results = useMemo(() => {
    if (text.trim().length < MIN_CHARS) return [];
    const source = ownedOnly ? ownedNames : allNames.data ?? [];
    return fuzzySearch(source, text).slice(0, MAX_RESULTS);
  }, [text, ownedOnly, ownedNames, allNames.data]);

  const searching = open && text.trim().length >= MIN_CHARS;

  return (
    <View style={styles.wrap} accessibilityRole="search">
      {/* The box, with a magnifying glass at its right end */}
      <View style={styles.field}>
        <TextField
          accessibilityLabel="Search for a card to add to this deck"
          placeholder="Search for a card to add…"
          value={text}
          onChangeText={(value) => { setText(value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            clearTimeout(closeTimer.current);
            closeTimer.current = setTimeout(() => { if (!keepOpen.current) setOpen(false); keepOpen.current = false; }, 200);
          }}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={styles.input}
        />
        <View style={styles.searchIcon} pointerEvents="none">
          <Ionicons name="search" size={20} color={colors.muted} />
        </View>
      </View>

      {/* Only cards from my binders */}
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>Only cards in my binders</Text>
        <Switch value={ownedOnly} onValueChange={setOwnedOnly} accessibilityLabel="Only cards in my binders"
                trackColor={{ true: colors.accent }} />
      </View>

      {/* The matches, dropping down over whatever is below. The note about the
          last card added is the first line, so it never moves anything. */}
      {searching && (
        <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
          {note ? <Text style={[styles.note, { color: colors.muted, borderBottomColor: colors.border }]} accessibilityLiveRegion="polite">{note}</Text> : null}
          <FlatList
            data={results}
            keyExtractor={(name) => name}
            keyboardShouldPersistTaps="handled"
            // Nothing matched, or the names are still downloading
            ListEmptyComponent={
              <Text style={[styles.noResults, { color: colors.muted }]}>
                {!ownedOnly && allNames.isLoading ? 'Loading card names…' : ownedOnly ? 'No card in your binders matches.' : 'No cards found.'}
              </Text>
            }
            renderItem={({ item }) => {
              // The name with the part you typed in bold
              const parts = matchParts(item, text);
              return (
                <View style={[styles.result, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                    {parts.before}<Text style={styles.bold}>{parts.match}</Text>{parts.after}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Add ${item} to the deck`} hitSlop={6}
                             onPressIn={() => { keepOpen.current = true; }}
                             onPress={() => onAdd(item, ownedOnly)}
                             style={({ pressed }) => [styles.plus, { backgroundColor: colors.accent }, pressed && { opacity: 0.6 }]}>
                    <Ionicons name="add" size={22} color={colors.bg} />
                  </Pressable>
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

// The look: the same box as the other search bars, the list under it as
// a bordered card
const styles = StyleSheet.create({
  wrap: { gap: 8, zIndex: 10 },
  field: { justifyContent: 'center' },
  input: { paddingRight: 44 },
  searchIcon: { position: 'absolute', right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  switchLabel: { fontSize: 15 },
  note: { fontSize: 14, paddingHorizontal: 14, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  // "top: 100%" puts the drop-down just under the bar and the switch, floating over the page
  results: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 340, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
  noResults: { padding: 14, fontSize: 15 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  resultName: { flex: 1, fontSize: 16 },
  bold: { fontWeight: '800' },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
