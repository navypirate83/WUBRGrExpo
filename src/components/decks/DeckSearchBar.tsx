/* =====================================================================
   THE SEARCH BAR INSIDE AN OPENED DECK
   One search box with a switch to its right. A small label above the
   switch says what the box is doing now, and changes when you flip it:
   - SEARCH (the label says "Search"): the box narrows the deck's OWN cards
     as you type, by name or type (the deck screen does the narrowing; this
     bar just hands it the text).
   - ADD (the label says "Add"): type a card name and the matching cards
     DROP DOWN over the page under the bar (so nothing on the screen moves;
     with the same forgiving search as the Card Finder: part of a name, odd
     spacing and small typos all still match). Each line has a "+": tapping
     it adds that card to the deck, one copy each time, using the first
     printing that comes up (change it later by opening the card in the
     deck). The drop-down stays open so more can be added, and closes when
     you tap anywhere else (the deck screen draws an invisible cover for that:
     it says when with "open" and "onOpenChange").
     A second switch sits beside the first, with its own label above it:
     "Binders" when on and "All" when off. On, the search covers only the
     cards you own in your binders (a card on a list doesn't count: lists are
     wishes, not cards you own), and the copy added is the printing you own.
     Off, it covers every card. While the first switch is on Search this
     one is grayed out (it stays put, it just can't be used). A line under
     the bar says which card was added last, in a spot kept free for it so
     nothing jumps.
   The deck screen does the adding (and the warning for too many copies);
   this bar just says which card name was chosen.
   ===================================================================== */

import { useMemo, useState } from 'react';
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

export type DeckSearchMode = 'search' | 'add';

type Props = {
  mode: DeckSearchMode;
  onMode: (mode: DeckSearchMode) => void;
  // What's typed to narrow the deck's own cards (Search)
  filter: string;
  onFilter: (text: string) => void;
  // Is the Add drop-down showing? (The deck screen closes it when you tap elsewhere.)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // A "+" was tapped: the card's name, and whether the binders-only switch is on
  // (so the printing you own should be used)
  onAdd: (name: string, ownedOnly: boolean) => void;
  // The line about the card added last (like "Added Sol Ring."), if any
  note?: string;
};

export default function DeckSearchBar({ mode, onMode, filter, onFilter, open, onOpenChange, onAdd, note }: Props) {
  const colors = useColors();
  const adding = mode === 'add';
  // What's typed to look for a card to add, and the binders-only switch
  const [text, setText] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(false);

  // Every card name (downloaded once, shared with the Card Finder)
  const allNames = useQuery({ queryKey: ['card-names'], queryFn: loadCardNames, select: prepareNames, enabled: adding });
  // The names of the cards in your binders (read when the switch goes on)
  const ownedNames = useMemo(() => {
    if (!adding || !ownedOnly) return [];
    const names = new Set<string>();
    for (const binder of loadBinderList()) {
      for (const card of Object.values(loadBinder(binder.id))) names.add(card.name);
    }
    return prepareNames([...names]);
  }, [adding, ownedOnly]);

  // The matches for what's typed
  const results = useMemo(() => {
    if (!adding || text.trim().length < MIN_CHARS) return [];
    const source = ownedOnly ? ownedNames : allNames.data ?? [];
    return fuzzySearch(source, text).slice(0, MAX_RESULTS);
  }, [adding, text, ownedOnly, ownedNames, allNames.data]);

  const showing = adding && open && text.trim().length >= MIN_CHARS;

  return (
    <View style={styles.wrap} accessibilityRole="search">
      {/* The box, with the Search / Add switch to its right */}
      <View style={styles.topRow}>
        <View style={styles.field}>
          <TextField
            accessibilityLabel={adding ? 'Search for a card to add to this deck' : 'Search the cards in this deck'}
            placeholder={adding ? 'Search for a card to add…' : 'Search this deck…'}
            value={adding ? text : filter}
            onChangeText={(value) => {
              if (adding) { setText(value); onOpenChange(true); } else onFilter(value);
            }}
            onFocus={() => { if (adding) onOpenChange(true); }}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.input}
          />
          <View style={styles.searchIcon} pointerEvents="none">
            <Ionicons name="search" size={20} color={colors.muted} />
          </View>
        </View>
        {/* The label above the switch says what the box is doing now */}
        <View style={styles.modeBox}>
          <Text style={[styles.modeLabel, { color: colors.text }]}>{adding ? 'Add' : 'Search'}</Text>
          <Switch
            value={adding}
            onValueChange={(on) => { onMode(on ? 'add' : 'search'); onOpenChange(on && text.trim().length >= MIN_CHARS); }}
            accessibilityLabel={adding ? 'Adding cards. Switch to search this deck.' : 'Searching this deck. Switch to add cards.'}
            trackColor={{ true: colors.accent }}
          />
        </View>
        {/* Beside it: which cards the Add search covers, "Binders" (just the
            cards you own in your binders) or "All". Grayed out, not removed,
            while the box is on Search. */}
        <View style={[styles.modeBox, !adding && styles.grayedOut]}>
          <Text style={[styles.modeLabel, { color: colors.text }]}>{ownedOnly ? 'Binders' : 'All'}</Text>
          <Switch
            value={ownedOnly}
            onValueChange={setOwnedOnly}
            disabled={!adding}
            accessibilityLabel={ownedOnly ? 'Searching only cards in your binders. Switch to search all cards.' : 'Searching all cards. Switch to search only cards in your binders.'}
            trackColor={{ true: colors.accent }}
          />
        </View>
      </View>

      {/* Add only: the line about the last card added (its spot is always
          kept, so it never moves anything) */}
      {adding && (
        <Text style={[styles.note, { color: colors.muted }]} accessibilityLiveRegion="polite">{note ?? ' '}</Text>
      )}

      {/* The matches, dropping down over whatever is below, each with a "+" */}
      {showing && (
        <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
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
              // The name with the part you typed highlighted (bold and
              // orange), exactly as the Card Finder's suggestions do
              const parts = matchParts(item, text);
              return (
                <View style={[styles.result, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                    {parts.before}
                    <Text style={[styles.match, { color: colors.accent }]}>{parts.match}</Text>
                    {parts.after}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Add ${item} to the deck`} hitSlop={6}
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

// The look: the box and switch side by side, the list under it as a
// bordered card floating over the page ("top: 100%" puts it just under the bar)
const styles = StyleSheet.create({
  wrap: { gap: 6, zIndex: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: { flex: 1, justifyContent: 'center' },
  input: { paddingRight: 44 },
  searchIcon: { position: 'absolute', right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modeBox: { alignItems: 'center', minWidth: 56 },
  // A switch that can't be used right now: faded, but still there
  grayedOut: { opacity: 0.4 },
  modeLabel: { fontSize: 13, fontWeight: '700' },
  note: { fontSize: 14, paddingHorizontal: 4, minHeight: 18 },
  results: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, maxHeight: 340, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
  noResults: { padding: 14, fontSize: 15 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  resultName: { flex: 1, fontSize: 16 },
  match: { fontWeight: '700' },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
