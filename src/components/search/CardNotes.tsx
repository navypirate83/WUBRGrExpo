/* =====================================================================
   NOTES AND RULES, AND FORMAT LEGALITY
   The two boxes under the pickers:
   - Notes and Rules: the official rulings about how the card works,
     downloaded from Scryfall (the same for every printing of a card).
   - Format Legality: whether the card is allowed in each way of playing.
   ===================================================================== */

import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { loadRulings, type ScryfallCard } from '@/lib/scryfall';
import { formatDate, legalityRows, rulingSource } from '@/lib/cards';
import { useSettings } from '@/hooks/useSettings';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

// The colors of the status labels: green for Legal, red for Banned,
// amber for Restricted (Not Legal is grey, from the theme: see below)
const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
  legal: { text: '#ffffff', bg: '#2f855a' },
  banned: { text: '#ffffff', bg: '#c0392b' },
  restricted: { text: '#1e1c19', bg: '#e0a330' },
};

// The Notes and Rules box. "card" is the card that was looked up; its
// rulings are downloaded once and remembered (TanStack Query).
export function Rulings({ card }: { card: ScryfallCard }) {
  const colors = useColors();
  const rulings = useQuery({
    queryKey: ['rulings', card.rulings_uri],
    queryFn: () => loadRulings(card.rulings_uri),
  });

  // One line of text in the box: still loading, no rulings, or a problem
  let message: string | null = null;
  if (rulings.isPending) message = 'Loading rulings…';
  else if (rulings.isError) message = 'Rulings could not be loaded right now.';
  else if (rulings.data.length === 0) message = 'There are no rulings for this card.';

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* The title bar across the top */}
      <Text style={[styles.title, { color: colors.text, backgroundColor: colors.surfaceHover, borderBottomColor: colors.border }]}
            accessibilityRole="header">
        Notes and Rules
      </Text>
      {message !== null ? (
        <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
      ) : (
        // Each ruling: the date and who published it, then the ruling,
        // with a thin line between each. (The index is part of the key
        // because two rulings can share a date.)
        rulings.data!.map((ruling, i) => (
          <View key={`${ruling.published_at}-${i}`}
                style={[styles.ruling, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Text style={[styles.rulingDate, { color: colors.muted }]}>
              {formatDate(ruling.published_at)} · {rulingSource(ruling.source)}
            </Text>
            <Text style={[styles.rulingText, { color: colors.text }]}>{ruling.comment}</Text>
          </View>
        ))
      )}
    </View>
  );
}

// The Format Legality box for a printing: one line per format, with the
// format's name and a colored status label. Formats switched off on the
// Settings screen are left out (useSettings redraws the box if that
// changes). Nothing at all if there are no formats left to show.
export function Legality({ print }: { print: ScryfallCard }) {
  const colors = useColors();
  const { hiddenFormats } = useSettings();
  // Two columns side by side, except on narrow phones (one column, so
  // long format names have room)
  const { width } = useWindowDimensions();
  const twoColumns = width > 480;
  const rows = legalityRows(print, hiddenFormats);
  if (rows.length === 0) return null;

  return (
    <View style={[styles.box, styles.legality, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text, backgroundColor: colors.surfaceHover, borderBottomColor: colors.border }]}
            accessibilityRole="header">
        Format Legality
      </Text>
      <View style={styles.legalityList}>
        {rows.map((row) => {
          // The status picks the label's color ("Not Legal" is grey)
          const look = STATUS_COLORS[row.status] ?? { text: colors.muted, bg: colors.surfaceHover };
          return (
            // One format: its name on the left and its status label on the right
            <View key={row.code} style={[styles.format, twoColumns && styles.half]}>
              <Text style={[styles.formatName, { color: colors.text }]} numberOfLines={1}>{row.name}</Text>
              <Text style={[styles.status, { color: look.text, backgroundColor: look.bg }]}>{row.word}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Each box: a rounded panel with a title bar ("overflow: hidden" keeps
// the title bar inside the rounded corners). The status labels are
// small rounded tags, all the same width so they line up.
const styles = StyleSheet.create({
  box: { marginTop: 28, borderWidth: 1, borderRadius: RADIUS, overflow: 'hidden' },
  title: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  message: { fontSize: 15, paddingHorizontal: 16, paddingVertical: 14 },
  ruling: { paddingHorizontal: 16, paddingVertical: 14 },
  rulingDate: { fontSize: 13, marginBottom: 4 },
  rulingText: { fontSize: 15, lineHeight: 23 },
  legality: { marginTop: 16 },
  legalityList: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingVertical: 10 },
  format: {
    width: '100%', paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  half: { width: '50%' },
  formatName: { flexShrink: 1, fontSize: 15 },
  status: {
    minWidth: 92, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
    fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textAlign: 'center', textTransform: 'uppercase',
  },
});
