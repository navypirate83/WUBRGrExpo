/* =====================================================================
   THE "− 3 +" COPIES BAR
   A dark rounded bar with the number of copies you own in the middle, a
   "−" button on the left and a "+" button on the right (in the orange the
   binder pockets use). "−" on the last copy is the card's remove (the
   binder screen asks first). The Grid view lays it over the bottom of each
   card; the List view puts it in each line. "style" says where it goes.
   ===================================================================== */

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MAX_COPIES } from '@/lib/binderStorage';
import { fixed } from '@/theme/colors';

type Props = {
  name: string;                    // the card's name (read out by screen readers)
  count: number;                   // how many copies are owned
  onFewer: () => void;
  onMore: () => void;
  style?: StyleProp<ViewStyle>;    // where the bar sits, and how wide it is
};

export default function CopiesBar({ name, count, onFewer, onMore, style }: Props) {
  return (
    <View style={[styles.bar, style]}>
      <Pressable accessibilityRole="button" hitSlop={4}
                 accessibilityLabel={count > 1 ? `One fewer ${name}` : `Remove ${name}`}
                 onPress={onFewer} style={styles.button}>
        <Text style={styles.glyph}>−</Text>
      </Pressable>
      <Text style={styles.count} accessibilityLabel={`${count} owned`}>{count}</Text>
      <Pressable accessibilityRole="button" hitSlop={4} accessibilityLabel={`One more ${name}`}
                 disabled={count >= MAX_COPIES} onPress={onMore}
                 style={[styles.button, count >= MAX_COPIES && styles.disabled]}>
        <Text style={styles.glyph}>+</Text>
      </Pressable>
    </View>
  );
}

// The bar's look: the same as in a binder pocket
const styles = StyleSheet.create({
  bar: {
    height: 22, borderRadius: 11, backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  button: { width: 24, height: 22, alignItems: 'center', justifyContent: 'center' },
  glyph: { color: fixed.accentOnDark, fontSize: 16, fontWeight: '800', lineHeight: 18 },
  count: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.35 },
});
