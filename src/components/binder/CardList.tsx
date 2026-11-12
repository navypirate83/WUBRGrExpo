/* =====================================================================
   A BINDER'S CARDS AS A LIST OR A GRID
   The List and Grid views of an opened binder (the Binder view, with its
   pockets, is drawn by the binder screen itself).
   - LIST: one line per card: a small picture, its name, its set and
     number, and how many copies you have.
   - GRID: card pictures side by side, with a small orange "×3" tag on a
     card you have more than one copy of.
   Tapping a card calls "onPick" (the binder screen opens that card's
   menu: copies, open in the Card Finder, move, remove).
   The cards come in already sorted. Rows are drawn only as they scroll
   into view, so a binder with thousands of cards stays quick.
   ===================================================================== */

import { memo, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useTheme';
import { pictureSource } from '@/lib/http';
import { cardCount, type BinderCard } from '@/lib/binderStorage';
import { RADIUS, SPACE } from '@/theme/colors';

// A card and the pocket it sits in
export type CardEntry = { key: string; card: BinderCard };

type Props = {
  entries: CardEntry[];
  mode: 'list' | 'grid';
  width: number;                       // the room beside the side menu, in points
  onPick: (key: string) => void;
  empty: ReactElement;                 // what to show when there are no cards
};

// A card's picture is 63 by 88 millimeters
const CARD_RATIO = 88 / 63;
// A grid picture is at least this wide (points); as many fit across as can
const GRID_MIN_WIDTH = 100;
const GRID_GAP = 10;

export default function CardList({ entries, mode, width, onPick, empty }: Props) {
  const colors = useColors();
  // The grid's columns, and how wide each picture is
  const room = width - 2 * SPACE.l;
  const columns = mode === 'grid' ? Math.max(2, Math.floor((room + GRID_GAP) / (GRID_MIN_WIDTH + GRID_GAP))) : 1;
  const tile = Math.floor((room - (columns - 1) * GRID_GAP) / columns);

  return (
    <FlatList
      // A new key when the columns change, because a list can't change its
      // number of columns on the fly
      key={`${mode}-${columns}`}
      data={entries}
      keyExtractor={(entry) => entry.key}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? { gap: GRID_GAP } : undefined}
      contentContainerStyle={[styles.content, mode === 'grid' && { gap: GRID_GAP }]}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        mode === 'list'
          ? <ListRow entry={item} onPick={onPick} border={colors.border} />
          : <GridTile entry={item} onPick={onPick} size={tile} />
      )}
    />
  );
}

/* ---------------------------------------------------------------------
   ONE LINE OF THE LIST. "memo" redraws it only when its card changes.
   --------------------------------------------------------------------- */
const ListRow = memo(function ListRow({ entry, onPick, border }: { entry: CardEntry; onPick: (key: string) => void; border: string }) {
  const colors = useColors();
  const { card, key } = entry;
  const count = cardCount(card);
  // "ONE · #123", plus "· Foil" for a foil copy
  const about = `${card.set.toUpperCase()} · #${card.number}${card.foil ? ' · Foil' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${about}, ${count} ${count === 1 ? 'copy' : 'copies'}. Opens its menu.`}
      onPress={() => onPick(key)}
      style={({ pressed }) => [styles.row, { borderBottomColor: border }, pressed && { backgroundColor: colors.surfaceHover }]}
    >
      <Image source={pictureSource(card.image)} style={styles.thumb} contentFit="cover" />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{card.name}</Text>
        <Text style={[styles.about, { color: colors.muted }]} numberOfLines={1}>{about}</Text>
      </View>
      {/* How many copies */}
      <View style={[styles.count, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.text }]}>×{count}</Text>
      </View>
    </Pressable>
  );
});

/* ---------------------------------------------------------------------
   ONE PICTURE IN THE GRID
   --------------------------------------------------------------------- */
const GridTile = memo(function GridTile({ entry, onPick, size }: { entry: CardEntry; onPick: (key: string) => void; size: number }) {
  const colors = useColors();
  const { card, key } = entry;
  const count = cardCount(card);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${count} ${count === 1 ? 'copy' : 'copies'}. Opens its menu.`}
      onPress={() => onPick(key)}
      style={({ pressed }) => [{ width: size }, pressed && styles.pressed]}
    >
      <Image source={pictureSource(card.image)} style={{ width: size, height: Math.round(size * CARD_RATIO), borderRadius: 6 }} contentFit="cover" />
      {count > 1 && (
        <View style={[styles.tag, { backgroundColor: colors.accent }]}>
          <Text style={[styles.tagText, { color: colors.accentText }]}>×{count}</Text>
        </View>
      )}
    </Pressable>
  );
});

// The look: rows with a thin line under each, and grid tiles with a tag
const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.s, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 34, height: 48, borderRadius: 4 },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  about: { fontSize: 12, marginTop: 1 },
  count: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  tag: { position: 'absolute', right: 4, bottom: 4, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 11, fontWeight: '800' },
});
