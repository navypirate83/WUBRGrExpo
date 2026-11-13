/* =====================================================================
   A CLOSED BINDER (the picture of one on the shelf)
   A cover a little taller than wide, with square corners on the spine
   side (left) and rounded corners on the opening side (right), like a
   real binder. A spine runs down the left side, a label window near the
   top holds the binder's name, and its symbol (if it has one) sits in
   the middle. A mana symbol is a colored circle already; a set symbol is
   a plain black shape, so it's drawn on a light round badge to show up on
   any cover color.
   Everything is measured from the cover's width, so the same picture
   works small (in a list row) or big (on a tablet).
   ===================================================================== */

import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { manaColor, setSymbolCode } from '@/lib/binderStorage';
import { loadSetIcons } from '@/lib/scryfall';
import { coverLook } from '@/lib/covers';
import { useColors } from '@/hooks/useTheme';
import SymbolText from '@/components/SymbolText';

type Props = {
  width: number;               // how wide the cover is, in points
  name?: string;
  colorCode?: string | null;   // the cover symbol's code ("U", or "set:mh3"), or null for none
  cover?: string;              // the cover color ("gold", or "#3a7bd5"); black if left out
  lifted?: boolean;            // drawn with a bigger shadow (while held)
};

export default function ClosedBinder({ width, name, colorCode, cover, lifted }: Props) {
  const colors = useColors();
  const look = coverLook(cover);
  const symbol = manaColor(colorCode);
  const height = width * 1.2;

  // A set symbol: its picture's address comes from Scryfall's list of sets
  // (downloaded once and shared with the Card Finder). Nothing is asked
  // for unless this binder has a set symbol. Until the address is known,
  // nothing is drawn (rather than an empty badge).
  const setCode = setSymbolCode(colorCode);
  const setIcons = useQuery({ queryKey: ['set-icons'], queryFn: loadSetIcons, enabled: !!setCode });
  const setIcon = setCode ? setIcons.data?.get(setCode) : undefined;
  const badge = width * 0.36;                                  // the symbol's size
  const symbolTop = height / 2 - width * 0.18 + height * 0.05;  // in the middle of the front...
  const symbolLeft = width * 0.15 + (width * 0.85 - badge) / 2; // ...skipping the spine

  // Light text on dark covers; dark text on pale ones
  const labelText = look.light ? '#24211c' : '#e9e5dc';
  const labelLine = look.light ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.16)';
  const labelFill = look.light ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.05)';

  return (
    // The cover itself: a sheen from the top-left (lighter) to the
    // bottom-right (darker), with the binder's shadow under it
    <LinearGradient
      colors={[look.shades.light, look.shades.base, look.shades.dark]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.cover,
        { width, height, borderColor: look.shades.edge, boxShadow: lifted ? colors.binderShadowLift : colors.binderShadow },
      ]}
    >
      {/* The spine along the left edge: see-through blacks laid over the
          cover, so it's a darker band of whatever color the cover is */}
      <LinearGradient
        colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)', 'rgba(255,255,255,0.08)']}
        locations={[0, 0.45, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.spine, { width: width * 0.15 }]}
      />

      {/* The label window near the top, with the name on ONE line (the
          text shrinks to fit a long name, down to a point) */}
      {name ? (
        <View style={[styles.label, { top: height * 0.09, left: width * 0.22, right: width * 0.07,
                                       borderColor: labelLine, backgroundColor: labelFill, paddingVertical: width * 0.05 }]}>
          <SymbolText
            style={[styles.labelText, { color: labelText, fontSize: Math.max(9, width * 0.1) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {name}
          </SymbolText>
        </View>
      ) : null}

      {/* The cover symbol, in the middle of the front (skipping the spine) */}
      {symbol && (
        <Image
          source={symbol.symbol}
          contentFit="contain"
          style={{ position: 'absolute', width: badge, height: badge, top: symbolTop, left: symbolLeft }}
        />
      )}

      {/* A set symbol: the black shape on a light round badge */}
      {setIcon && (
        <View style={[styles.setBadge, { width: badge, height: badge, borderRadius: badge / 2, top: symbolTop, left: symbolLeft }]}>
          <Image source={{ uri: setIcon }} contentFit="contain" style={{ width: badge * 0.66, height: badge * 0.66 }} />
        </View>
      )}
    </LinearGradient>
  );
}

// The shapes that don't depend on the size
const styles = StyleSheet.create({
  cover: { borderWidth: 1, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden' },
  spine: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  label: { position: 'absolute', borderWidth: 1, borderRadius: 3, paddingHorizontal: 4, alignItems: 'center' },
  labelText: { fontWeight: '600', textAlign: 'center' },
  // The light round badge a set symbol sits on
  setBadge: { position: 'absolute', backgroundColor: '#f1ece0', alignItems: 'center', justifyContent: 'center' },
});
