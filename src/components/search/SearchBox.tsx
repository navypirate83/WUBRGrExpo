/* =====================================================================
   SEARCH BOX AND SUGGESTIONS
   The box at the top of the Card Finder where you type a card's name.
   After a short pause in typing, a list of matching names drops down
   under it, covering the card area (which is passed in as "children",
   so the list can lie on top of it). Tap a name to look that card up,
   or press the keyboard's Search key to let Scryfall find the closest
   match. On a computer, the up and down arrow keys and Enter work too.
   Keyboard handling: the list is a FlatList with
   keyboardShouldPersistTaps="handled", so tapping a name works on the
   first tap even while the phone's keyboard is up, and the Card Finder
   screen shrinks itself above the keyboard (KeyboardAvoidingView), so
   the keyboard never covers the box or the list.
   ===================================================================== */

import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import {
  FlatList, Keyboard, Platform, Pressable, StyleSheet, Text, View,
  type TextInput, type TextInputKeyPressEvent,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { autocomplete } from '@/lib/scryfall';
import { fuzzySearch, matchParts, type NameEntry } from '@/lib/nameSearch';
import { useShowKeyHints } from '@/hooks/useShortcutKeys';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';
import TextField from '@/components/TextField';

// Start suggesting once this many letters are typed
export const MIN_CHARS = 3;

// Wait this long (in milliseconds) after a key press before searching,
// so it doesn't search on every single letter
const TYPING_PAUSE_MS = 120;

// The widest the search box, its list and the card details get (in
// points, not counting the 16-point gaps at each side), so on a tablet
// or computer they stay a comfortable width in the middle of the screen
export const PAGE_WIDTH = 728;

// Every suggestion row is this tall (in points: comfortable for a
// finger), so the list can scroll to any row without measuring it
const SUGGESTION_HEIGHT = 48;

type Props = {
  value: string;
  onChange: (text: string) => void;
  // Every card name, ready to search (missing until it has downloaded)
  names: NameEntry[] | undefined;
  // A name was picked: "exact" is true when it came from the list
  onChoose: (name: string, exact: boolean) => void;
  // Escape was pressed with no list open: the box was left (web)
  onLeave: () => void;
  hint: string;
  hintIsError: boolean;
  onShowShortcuts: () => void;
  // A handle on the text box, so the screen can put the cursor in it (the / key)
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>;
  // The card area under the box (the suggestions cover it)
  children: ReactNode;
};

export default function SearchBox(props: Props) {
  const { value, onChange, names, onChoose, onLeave, hint, hintIsError, onShowShortcuts, inputRef, children } = props;
  const colors = useColors();
  // Show the shortcuts tip? (Computers only: see useShortcutKeys)
  const showKeyHints = useShowKeyHints();

  // The names in the list (null = the list is closed; an empty list =
  // nothing matched), and which one the arrow keys highlight (-1 = none)
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [active, setActive] = useState(-1);
  const listRef = useRef<FlatList<string>>(null);
  // The timer for the search that runs after a short pause in typing
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Close the list, and cancel any search still waiting to run, so its
  // results don't pop up after a card was already chosen.
  function hideSuggestions() {
    clearTimeout(typingTimer.current);
    typingTimer.current = undefined;
    setSuggestions(null);
    setActive(-1);
  }

  // Put the chosen name in the box, close the list, and load that card.
  // On a phone the keyboard goes away too, so the card can be seen.
  function choose(name: string, exact: boolean) {
    hideSuggestions();
    if (Platform.OS !== 'web') Keyboard.dismiss();
    onChange(name);
    onChoose(name, exact);
  }

  // Every time the text changes: wait for a short pause in typing, then
  // look up suggestions: our own fuzzy search once the list of names has
  // downloaded, or Scryfall's suggestions until then.
  function handleChange(text: string) {
    onChange(text);
    clearTimeout(typingTimer.current);
    if (text.trim().length < MIN_CHARS) { hideSuggestions(); return; }
    const timer = setTimeout(async () => {
      const found = names ? fuzzySearch(names, text) : await autocomplete(text);
      // Only show them if this is still the latest search (nobody kept
      // typing, picked a card, or pressed Search in the meantime).
      if (typingTimer.current !== timer) return;
      setSuggestions(found);
      setActive(-1);
    }, TYPING_PAUSE_MS);
    typingTimer.current = timer;
  }

  // The keyboard's Search key (Enter on a computer): the highlighted
  // name, or, with none highlighted, let Scryfall find the closest card.
  function handleSubmit() {
    if (suggestions && active !== -1) choose(suggestions[active], true);
    else if (value.trim()) choose(value.trim(), false);
  }

  // Computer keyboards only: the arrows move the highlight, and Escape
  // closes the list (or, with no list open, leaves the search box, so
  // the shortcut keys work).
  function handleKeyPress(event: TextInputKeyPressEvent) {
    const key = event.nativeEvent.key;
    const count = suggestions?.length ?? 0;
    if (key === 'ArrowDown' && count) {
      event.preventDefault();
      setActive((active + 1) % count);
    } else if (key === 'ArrowUp' && count) {
      event.preventDefault();
      setActive((active - 1 + count) % count);
    } else if (key === 'Escape') {
      const listWasOpen = suggestions !== null;
      hideSuggestions();
      if (!listWasOpen) {
        inputRef.current?.blur();
        onLeave();
      }
    }
  }

  // When the arrow keys move the highlight, scroll the list so the
  // highlighted name is in view.
  useEffect(() => {
    if (active !== -1) listRef.current?.scrollToIndex({ index: active, viewPosition: 0.5 });
  }, [active]);

  // Stop the waiting search if the screen goes away.
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // The "×" button: empty the search box, close the list, and put the
  // cursor back in the box, ready to type a new name. (The card that's
  // showing stays until another one is looked up.)
  function clearSearch() {
    hideSuggestions();
    onChange('');
    inputRef.current?.focus();
  }

  const open = suggestions !== null;

  return (
    <View style={styles.fill}>
      {/* The box and its "×" button, which sits inside the box's right end */}
      <View style={styles.searchField}>
        <TextField
          ref={inputRef}
          accessibilityLabel="Card name"
          placeholder="Search for a card name…"
          value={value}
          onChangeText={handleChange}
          onKeyPress={handleKeyPress}
          onSubmitEditing={handleSubmit}
          // The keyboard's Enter key says "Search"; no spelling fixes or
          // capital letters added (card names are typed exactly)
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          // Tapping the box (with a card's name in it) selects the name,
          // so typing replaces it
          selectTextOnFocus
          style={[styles.input, { backgroundColor: colors.surface }]}
        />
        {/* "×": only while there's something in the box to clear */}
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear the search"
            onPress={clearSearch}
            style={({ pressed }) => [styles.clearButton, pressed && { backgroundColor: colors.surfaceHover }]}
          >
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Everything under the box: the status line, then the card area,
          with the suggestion list lying on top of both when it's open */}
      <View style={styles.fill}>
        {/* The line under the box: a status message on the left (read out
            by screen readers when it changes), and on computers the
            shortcuts tip on the right (tapping it opens the Keyboard
            shortcuts window) */}
        <View style={styles.hintRow}>
          <Text
            style={[styles.hint, { color: hintIsError ? colors.error : colors.muted }]}
            accessibilityLiveRegion="polite"
          >
            {hint}
          </Text>
          {showKeyHints && (
            <Pressable accessibilityRole="button" accessibilityLabel="Keyboard shortcuts" onPress={onShowShortcuts}>
              <Text style={[styles.shortcutsTip, { color: colors.muted }]}>/ search · ? shortcuts</Text>
            </Pressable>
          )}
        </View>

        {children}

        {open && (
          <>
            {/* A see-through layer over the card area: tapping outside
                the list closes it (and puts the keyboard away) */}
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => { hideSuggestions(); Keyboard.dismiss(); }}
              accessibilityLabel="Close the suggestions"
            />

            {/* The list of matching names (the outer box keeps it in the
                middle of a wide screen, and no taller than the room above
                the keyboard) */}
            <View style={styles.suggestionsArea} pointerEvents="box-none">
              <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
                <FlatList
                  showsVerticalScrollIndicator={false}
                  ref={listRef}
                  data={suggestions}
                  keyExtractor={(name) => name}
                  // Taps on a name work while the keyboard is up
                  keyboardShouldPersistTaps="handled"
                  getItemLayout={(_data, index) => ({ length: SUGGESTION_HEIGHT, offset: SUGGESTION_HEIGHT * index, index })}
                  // Nothing matched: say so, instead of an empty box
                  ListEmptyComponent={
                    <View style={styles.noMatch}>
                      <Ionicons name="search-outline" size={20} color={colors.muted} />
                      <Text style={[styles.noMatchText, { color: colors.muted }]}>
                        No card names match “{value.trim()}”. Press Search to let Scryfall guess the closest card.
                      </Text>
                    </View>
                  }
                  renderItem={({ item: name, index }) => {
                    // The part of the name that matches what was typed is
                    // highlighted (bold and orange)
                    const parts = matchParts(name, value);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={name}
                        accessibilityState={{ selected: index === active }}
                        onPress={() => choose(name, true)}
                        style={({ pressed }) => [
                          styles.suggestion,
                          (pressed || index === active) && { backgroundColor: colors.surfaceHover },
                        ]}
                      >
                        <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>
                          {parts.before}
                          <Text style={[styles.match, { color: colors.accent }]}>{parts.match}</Text>
                          {parts.after}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// The look: a tall search box with room on the right for the "×", the
// status line under it, and the suggestion list floating just below
// the box, never taller than the space above the keyboard
const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchField: { width: '100%', maxWidth: PAGE_WIDTH + 32, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10 },
  input: { minHeight: 50, paddingLeft: 16, paddingRight: 52, fontSize: 17 },
  clearButton: {
    position: 'absolute', right: 20, top: 13, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  hintRow: {
    width: '100%', maxWidth: PAGE_WIDTH + 32, alignSelf: 'center', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 18, paddingTop: 6, paddingBottom: 2,
  },
  hint: { flex: 1, fontSize: 14, minHeight: 18 },
  shortcutsTip: { fontSize: 13 },
  suggestionsArea: {
    position: 'absolute', top: 4, left: 0, right: 0, maxHeight: '97%', paddingHorizontal: 16, alignItems: 'center',
  },
  suggestions: {
    width: '100%', maxWidth: PAGE_WIDTH, flexShrink: 1,
    borderWidth: 1, borderRadius: RADIUS, padding: 6, overflow: 'hidden',
  },
  suggestion: { height: SUGGESTION_HEIGHT, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6 },
  suggestionText: { fontSize: 16 },
  match: { fontWeight: '700' },
  noMatch: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  noMatchText: { flex: 1, fontSize: 15 },
});
