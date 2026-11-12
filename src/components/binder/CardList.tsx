/* =====================================================================
   A BINDER'S CARDS AS A LIST OR A GRID
   The List and Grid views of an opened binder (the Binder view, with its
   pockets, is drawn by the binder screen itself).
   - LIST: one line per card: a small picture (with a rainbow border if
     it's a foil), its name, its set and
     number, how many copies you have, and what they're worth at the
     store chosen in Settings (a dash when it has no price).
   Above both, one quiet line: how many cards, how many different, and the
   total value.
   - GRID: card pictures side by side (a foil has a rainbow border), each
     with the "− 3 +" copies bar along its bottom: − and + change how many
     copies you have (− on the last copy asks about removing the card).
     On the website the pictures can be zoomed in and out (see
     ViewSwitch.tsx); "minTile" is how wide they are at least.
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
import { MAX_COPIES, cardCount, type BinderCard } from '@/lib/binderStorage';
import { formatPrice } from '@/lib/prices';
import FoilFrame from './FoilFrame';
import type { BinderPrices } from '@/hooks/useBinderPrices';
import { RADIUS, SPACE, fixed } from '@/theme/colors';

// A card and the pocket it sits in
export type CardEntry = { key: string; card: BinderCard };

type Props = {
  entries: CardEntry[];
  mode: 'list' | 'grid';
  width: number;                       // the room beside the side menu, in points
  onPick: (key: string) => void;
  onCopies: (key: string, step: number) => void;   // one more (1) or one fewer (-1) copy
  minTile: number;                     // grid pictures are at least this wide (points)
  prices: BinderPrices;                // what the cards are worth
  empty: ReactElement;                 // what to show when there are no cards
};

// A card's picture is 63 by 88 millimeters
const CARD_RATIO = 88 / 63;
// The space between grid pictures
const GRID_GAP = 10;

export default function CardList({ entries, mode, width, onPick, onCopies, minTile, prices, empty }: Props) {
  const colors = useColors();
  // The grid's columns, and how wide each picture is
  const room = width - 2 * SPACE.l;
  const columns = mode === 'grid' ? Math.max(1, Math.floor((room + GRID_GAP) / (minTile + GRID_GAP))) : 1;
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
      ListHeaderComponent={entries.length > 0 ? <Summary entries={entries} prices={prices} /> : undefined}
      renderItem={({ item }) => (
        mode === 'list'
          ? <ListRow entry={item} onPick={onPick} border={colors.border} price={prices.byKey.get(item.key)} currency={prices.currency} />
          : <GridTile entry={item} onPick={onPick} onCopies={onCopies} size={tile} />
      )}
    />
  );
}

/* ---------------------------------------------------------------------
   THE SUMMARY LINE above the cards: "42 cards · 31 different · $118.40"
   --------------------------------------------------------------------- */
function Summary({ entries, prices }: { entries: CardEntry[]; prices: BinderPrices }) {
  const colors = useColors();
  const cards = entries.reduce((sum, { card }) => sum + cardCount(card), 0);
  const worth = prices.total !== null ? formatPrice(prices.total, prices.currency)
    : prices.failed ? 'prices unavailable' : prices.loading ? 'loading prices…' : '';
  const parts = [`${cards} ${cards === 1 ? 'card' : 'cards'}`, `${entries.length} different`, worth].filter(Boolean);
  return <Text style={[styles.summary, { color: colors.muted }]} accessibilityLiveRegion="polite">{parts.join(' · ')}</Text>;
}

/* ---------------------------------------------------------------------
   ONE LINE OF THE LIST. "memo" redraws it only when its card changes.
   --------------------------------------------------------------------- */
const ListRow = memo(function ListRow({ entry, onPick, border, price, currency }: {
  entry: CardEntry; onPick: (key: string) => void; border: string;
  price: number | null | undefined;    // undefined: not loaded yet; null: the store has none
  currency: 'USD' | 'EUR';
}) {
  const colors = useColors();
  const { card, key } = entry;
  const count = cardCount(card);
  // "ONE · #123", plus "· Foil" for a foil copy
  const about = `${card.set.toUpperCase()} · #${card.number}${card.foil ? ' · Foil' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${about}, ${count} ${count === 1 ? 'copy' : 'copies'}${typeof price === 'number' ? `, worth ${formatPrice(price, currency)}` : ''}. Opens its menu.`}
      onPress={() => onPick(key)}
      style={({ pressed }) => [styles.row, { borderBottomColor: border }, pressed && { backgroundColor: colors.surfaceHover }]}
    >
      <FoilFrame foil={card.foil === true} width={34} height={48} radius={4}>
        <Image source={pictureSource(card.image)} style={styles.thumbPicture} contentFit="cover" />
      </FoilFrame>
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{card.name}</Text>
        <Text style={[styles.about, { color: colors.muted }]} numberOfLines={1}>{about}</Text>
      </View>
      {/* How many copies */}
      <View style={[styles.count, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.countText, { color: colors.text }]}>×{count}</Text>
      </View>
      {/* What the copies are worth (a dash if the store has no price) */}
      <Text style={[styles.price, { color: colors.muted }]}>{price === undefined ? '' : formatPrice(price, currency)}</Text>
    </Pressable>
  );
});

/* ---------------------------------------------------------------------
   ONE PICTURE IN THE GRID
   --------------------------------------------------------------------- */
const GridTile = memo(function GridTile({ entry, onPick, onCopies, size }: {
  entry: CardEntry; onPick: (key: string) => void; onCopies: (key: string, step: number) => void; size: number;
}) {
  const { card, key } = entry;
  const count = cardCount(card);
  return (
    <View style={{ width: size }}>
      {/* The picture: tap it for the card's menu */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${card.name}${card.foil ? ', foil' : ''}, ${count} ${count === 1 ? 'copy' : 'copies'}. Opens its menu.`}
        onPress={() => onPick(key)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <FoilFrame foil={card.foil === true} width={size} height={Math.round(size * CARD_RATIO)} radius={6} border={3}>
          <Image source={pictureSource(card.image)} style={styles.thumbPicture} contentFit="cover" />
        </FoilFrame>
      </Pressable>

      {/* The "− 3 +" bar along the bottom of the card: how many copies you
          own (a bar laid over the card, the same as in a binder pocket) */}
      <View style={styles.copiesBar}>
        <Pressable accessibilityRole="button" hitSlop={4}
                   accessibilityLabel={count > 1 ? `One fewer ${card.name}` : `Remove ${card.name}`}
                   onPress={() => onCopies(key, -1)} style={styles.copiesButton}>
          <Text style={styles.copiesText}>−</Text>
        </Pressable>
        <Text style={styles.copiesCount} accessibilityLabel={`${count} owned`}>{count}</Text>
        <Pressable accessibilityRole="button" hitSlop={4} accessibilityLabel={`One more ${card.name}`}
                   disabled={count >= MAX_COPIES} onPress={() => onCopies(key, 1)}
                   style={[styles.copiesButton, count >= MAX_COPIES && styles.disabled]}>
          <Text style={styles.copiesText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
});

// The look: rows with a thin line under each, and grid tiles with a tag
const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE.l, paddingTop: SPACE.s, paddingBottom: 90, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.m, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  thumbPicture: { width: '100%', height: '100%' },
  rowText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600' },
  about: { fontSize: 12, marginTop: 1 },
  count: { borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { fontSize: 13, fontWeight: '700' },
  price: { width: 62, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
  summary: { fontSize: 13, paddingBottom: SPACE.s, paddingTop: 2 },
  pressed: { opacity: 0.6 },
  copiesBar: {
    position: 'absolute', left: 4, right: 4, bottom: 4, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.72)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  copiesButton: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' },
  copiesText: { color: fixed.accentOnDark, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  copiesCount: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.35 },
});
