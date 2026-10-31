/* =====================================================================
   PRICES (on the Card Finder)
   A small table: "Regular" and "Foil" across the top, then one row per
   store (TCGplayer, Card Kingdom, Cardmarket), each with its icon (tap
   it to see this card at the store) and its two prices for the
   printing showing. The column that matches the Foil button is
   highlighted.
   The card area draws it in one of two places, depending on the
   screen's width:
   - "side": a narrow box to the LEFT of the card, with just the stores'
     icons (on screens wide enough for it, like a tablet or computer)
   - "below": under Notes and Rules, with the stores' names too (phones)
   (Where the prices come from: see lib/prices.ts.)
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import type { ScryfallCard } from '@/lib/scryfall';
import {
  cardKingdomPrices, cardmarketPrices, formatPrice, loadCardKingdomPrices, tcgplayerPrices,
  type StorePrices,
} from '@/lib/prices';
import { openLink } from '@/lib/links';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

type Props = {
  // The printing showing
  print: ScryfallCard;
  // Is the Foil button on?
  foil: boolean;
  // Which of the two places this is (see above)
  layout: 'side' | 'below';
};

// The stores' icons, bundled into the app (from assets/images/stores)
// ("require" hands back a number the app uses to find the picture.)
const STORE_ICONS = {
  tcgplayer: require('../../../assets/images/stores/tcgplayer.png') as number,
  cardkingdom: require('../../../assets/images/stores/cardkingdom.png') as number,
  cardmarket: require('../../../assets/images/stores/cardmarket.png') as number,
};

export default function PricePanel({ print, foil, layout }: Props) {
  const colors = useColors();

  // Card Kingdom's price list: downloaded once (the first time a card is
  // shown) and kept for the whole visit ("gcTime: Infinity")
  const cardKingdom = useQuery({
    queryKey: ['card-kingdom-prices'],
    queryFn: loadCardKingdomPrices,
    gcTime: Infinity,
  });

  // Card Kingdom's row while its list is loading, or if it couldn't be
  // loaded: a message instead of prices
  const ckMessage = cardKingdom.isError ? 'Couldn\'t load'
    : cardKingdom.isPending ? 'Loading…' : null;
  const showNames = layout === 'below';
  const side = layout === 'side';

  // The highlighted column (the one matching the Foil button): a light
  // tint of the orange behind it ("1f" on the end of the color code
  // makes it about 12% see-through), and brighter, bold text
  const shownCell = (isFoilColumn: boolean) =>
    isFoilColumn === foil ? { backgroundColor: `${colors.accent}1f` } : null;
  const shownText = (isFoilColumn: boolean) =>
    isFoilColumn === foil ? [styles.shownText, { color: colors.text }] : { color: colors.muted };

  // One store's row: its icon (and name, if shown), which opens the card
  // at the store, then its two prices. Without the name showing, screen
  // readers still hear which store it is. "message" replaces the prices
  // while they load.
  function row(name: string, icon: number, currency: 'USD' | 'EUR', prices: StorePrices | null, message?: string | null, first = false) {
    const label = (
      <>
        <Image source={icon} style={styles.storeIcon} contentFit="contain" />
        {showNames && <Text style={[styles.storeName, { color: colors.accent }]} numberOfLines={1}>{name}</Text>}
      </>
    );
    return (
      <View style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
        {/* The store: a link to the card there (once its prices are known) */}
        {prices ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${name}: see this card`}
            onPress={() => openLink(prices.url)}
            style={({ pressed }) => [styles.store, side && styles.storeSide, pressed && styles.pressed]}
          >
            {label}
          </Pressable>
        ) : (
          <View style={[styles.store, side && styles.storeSide]} accessibilityLabel={name}>{label}</View>
        )}

        {/* The two prices, or the message across both columns */}
        {message || !prices ? (
          <Text style={[styles.note, side && styles.noteSide, { color: colors.muted }]}>{message}</Text>
        ) : (
          <>
            <View style={[styles.cell, side && styles.cellSide, shownCell(false)]}>
              <Text style={[styles.price, side && styles.small, shownText(false)]}>{formatPrice(prices.regular, currency)}</Text>
            </View>
            {/* "Etched" foil (a special foil finish) gets a tiny note */}
            <View style={[styles.cell, side && styles.cellSide, shownCell(true)]}
                  accessibilityLabel={prices.etched ? `Etched foil: ${formatPrice(prices.foil, currency)}` : undefined}>
              <Text style={[styles.price, side && styles.small, shownText(true)]}>{formatPrice(prices.foil, currency)}</Text>
              {prices.etched && <Text style={[styles.etched, { color: colors.muted }]}>etched</Text>}
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <View
      style={[styles.box, side ? styles.boxSide : styles.boxBelow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel="Prices"
    >
      {/* The column headings: an empty corner, then Regular and Foil */}
      <View style={styles.row}>
        <View style={[styles.store, side && styles.storeSide]} />
        <View style={[styles.cell, side && styles.cellSide, shownCell(false)]}>
          <Text style={[styles.heading, { color: colors.muted }]}>Regular</Text>
        </View>
        <View style={[styles.cell, side && styles.cellSide, shownCell(true)]}>
          <Text style={[styles.heading, { color: colors.muted }]}>Foil</Text>
        </View>
      </View>

      {/* One row per store */}
      {row('TCGplayer', STORE_ICONS.tcgplayer, 'USD', tcgplayerPrices(print), null, true)}
      {row('Card Kingdom', STORE_ICONS.cardkingdom, 'USD',
        cardKingdom.data ? cardKingdomPrices(print, cardKingdom.data) : null, ckMessage)}
      {row('Cardmarket', STORE_ICONS.cardmarket, 'EUR', cardmarketPrices(print))}
    </View>
  );
}

// The table's look. Each row is a line of boxes: the store (which takes
// the spare room in the "below" box), then two price columns of a fixed
// width, with the prices on the right so the dots line up
// ("tabular-nums" makes every digit the same width).
const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: RADIUS },
  boxBelow: { marginTop: 16, paddingHorizontal: 12, paddingVertical: 6 },
  boxSide: { padding: 6 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  store: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  storeSide: { flex: 0, width: 36 },
  pressed: { opacity: 0.6 },
  storeIcon: { width: 26, height: 26, padding: 2, borderRadius: 5, backgroundColor: '#ffffff' },
  storeName: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
  cell: { width: 92, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'flex-end' },
  cellSide: { width: 70, paddingHorizontal: 6 },
  heading: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', paddingVertical: 6 },
  price: { fontSize: 15, fontVariant: ['tabular-nums'] },
  small: { fontSize: 13 },
  shownText: { fontWeight: '700' },
  etched: { fontSize: 10 },
  // The message spans both price columns (two of them side by side)
  note: { width: 184, alignSelf: 'center', textAlign: 'center', fontStyle: 'italic', fontSize: 14 },
  noteSide: { width: 140, fontSize: 12 },
});
