/* =====================================================================
   CHOOSE A CARD FOR A COMMAND ZONE SPOT
   A window with a search box and the cards allowed in the spot (a
   commander, a partner, a Background, an Oathbreaker, a signature spell:
   see lib/deckZones.ts for what each takes). The cards come from a
   Scryfall search that already holds the spot's rules, so only cards that
   can go there are listed. Type to narrow them by name (the part you typed
   is bold and orange, as in the Card Finder); tap the "+" on one to choose it.
   "onChoose" gets that card's full details.
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import PopupWindow from '@/components/PopupWindow';
import TextField from '@/components/TextField';
import { useColors } from '@/hooks/useTheme';
import { matchParts } from '@/lib/nameSearch';
import { searchCards, type ScryfallCard } from '@/lib/scryfall';

// Wait this long (milliseconds) after a key press before searching
const TYPING_PAUSE_MS = 350;
// Show at most this many cards
const MAX_SHOWN = 40;

type Props = {
  title: string;                            // like "Choose your commander"
  query: string;                            // Scryfall's search for the cards allowed here
  hint?: string;                            // a line of help under the box
  onChoose: (print: ScryfallCard) => void;
  onCancel: () => void;
};

export default function SlotSearchDialog({ title, query, hint, onChoose, onCancel }: Props) {
  const colors = useColors();
  const [text, setText] = useState('');
  // The cards found (null while searching), and what went wrong, if anything
  const [found, setFound] = useState<ScryfallCard[] | null>(null);
  const [problem, setProblem] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The newest search, so an answer to an older one is ignored
  const latest = useRef(0);

  // Search after a pause in typing (at once the first time)
  useEffect(() => {
    clearTimeout(timer.current);
    const mine = ++latest.current;
    setFound(null);
    setProblem('');
    timer.current = setTimeout(async () => {
      try {
        const typed = text.trim().replace(/"/g, '');
        const list = await searchCards(typed ? `(${query}) name:"${typed}"` : query);
        if (mine === latest.current) setFound(list.slice(0, MAX_SHOWN));
      } catch (err) {
        if (mine === latest.current) { setProblem((err as Error).message); setFound([]); }
      }
    }, text ? TYPING_PAUSE_MS : 0);
    return () => clearTimeout(timer.current);
  }, [text, query]);

  return (
    <PopupWindow title={title} onClose={onCancel} buttons={[{ label: 'Cancel', onPress: onCancel, kind: 'secondary' }]}>
      <View style={styles.body}>
        <TextField
          accessibilityLabel="Search the cards allowed here"
          placeholder="Type a name…"
          value={text}
          onChangeText={setText}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {hint ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
        {found === null && <ActivityIndicator color={colors.accent} style={styles.wait} />}
        {found !== null && (
          <View style={[styles.results, { borderColor: colors.border }]}>
            <FlatList
              data={found}
              keyExtractor={(card) => card.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[styles.empty, { color: problem ? colors.error : colors.muted }]}>
                  {problem || 'No card matches. Only cards allowed in this spot are listed.'}
                </Text>
              }
              renderItem={({ item }) => {
                const parts = matchParts(item.name, text);
                return (
                  <View style={[styles.row, { borderBottomColor: colors.border }]}>
                    <View style={styles.rowText}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                        {parts.before}
                        <Text style={{ color: colors.accent, fontWeight: '700' }}>{parts.match}</Text>
                        {parts.after}
                      </Text>
                      <Text style={[styles.type, { color: colors.muted }]} numberOfLines={1}>
                        {item.type_line ?? item.card_faces?.[0]?.type_line ?? ''}
                      </Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${item.name}`} hitSlop={6}
                               onPress={() => onChoose(item)}
                               style={({ pressed }) => [styles.plus, { backgroundColor: colors.accent }, pressed && { opacity: 0.6 }]}>
                      <Ionicons name="add" size={22} color={colors.accentText} />
                    </Pressable>
                  </View>
                );
              }}
            />
          </View>
        )}
      </View>
    </PopupWindow>
  );
}

// The look: the box, a line of help, then the cards as a bordered list
const styles = StyleSheet.create({
  body: { gap: 8 },
  hint: { fontSize: 13 },
  wait: { marginVertical: 18 },
  results: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', maxHeight: 340 },
  empty: { padding: 14, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 16 },
  type: { fontSize: 12 },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
