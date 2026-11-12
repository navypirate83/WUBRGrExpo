/* =====================================================================
   THE PRICE STORE CHOICE: TCGplayer, Card Kingdom or Cardmarket
   Three buttons side by side as one rounded bar (the same kind as the
   theme choice), the chosen one filled in orange. Each has the store's
   little icon. The store picked is the one whose prices the binders show
   (see lib/prices.ts). Screen readers hear them as radio buttons.
   ===================================================================== */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PRICE_STORES, type PriceStore } from '@/lib/prices';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

// The stores' icons, bundled into the app ("require" hands back a number
// the app uses to find the picture)
const ICONS: Record<PriceStore, number> = {
  tcgplayer: require('../../../assets/images/stores/tcgplayer.png') as number,
  cardkingdom: require('../../../assets/images/stores/cardkingdom.png') as number,
  cardmarket: require('../../../assets/images/stores/cardmarket.png') as number,
};

export default function PriceStorePicker({ value, onChange }: {
  value: PriceStore;
  onChange: (store: PriceStore) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Price store"
      style={[styles.bar, { borderColor: colors.border, backgroundColor: colors.bg }]}
    >
      {PRICE_STORES.map((store) => {
        const picked = value === store.value;
        return (
          // One store: filled orange when picked
          <Pressable
            key={store.value}
            accessibilityRole="radio"
            accessibilityLabel={`${store.name}, prices in ${store.currency === 'USD' ? 'US dollars' : 'euros'}`}
            accessibilityState={{ checked: picked }}
            onPress={() => onChange(store.value)}
            style={({ pressed }) => [
              styles.segment,
              picked && { backgroundColor: colors.accent },
              pressed && !picked && { backgroundColor: colors.surfaceHover },
            ]}
          >
            <Image source={ICONS[store.value]} style={styles.icon} contentFit="contain" />
            <Text style={[styles.label, { color: picked ? colors.accentText : colors.text }]} numberOfLines={1}>{store.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The bar's look: a rounded outline split into three equal parts, each
// 56 points tall (room for the icon above the name)
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderWidth: 1, borderRadius: RADIUS, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 56, borderRadius: RADIUS - 3, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2 },
  icon: { width: 22, height: 22 },
  label: { fontSize: 13, fontWeight: '600' },
});
