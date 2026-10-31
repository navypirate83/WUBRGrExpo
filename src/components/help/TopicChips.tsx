/* =====================================================================
   THE HELP TOPIC BUTTONS
   A row of rounded buttons ("chips"), one per help topic: The Shelf,
   Binder pages, MTG Card Finder and Settings. The topic showing is
   filled in orange. On a narrow phone the row slides sideways with a
   finger if they don't all fit.
   Screen readers hear them as tabs, and which one is picked.
   ===================================================================== */

import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import { SPACE } from '@/theme/colors';
import type { HelpTopic } from './helpTopics';

type Props = {
  topics: HelpTopic[];
  current: string;                   // the id of the topic showing
  onPick: (topicId: string) => void; // called with the topic tapped
};

export default function TopicChips({ topics, current, onPick }: Props) {
  const colors = useColors();
  return (
    // A sideways-scrolling row (its scroll bar hidden: the chips cut off
    // at the edge show there's more)
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {topics.map((topic) => {
        const picked = topic.id === current;
        return (
          // One chip: filled orange when picked, an outline otherwise.
          // hitSlop makes the area a finger can hit a little bigger than
          // the chip itself.
          <Pressable
            key={topic.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: picked }}
            hitSlop={4}
            onPress={() => onPick(topic.id)}
            style={({ pressed }) => [
              styles.chip,
              picked
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, { color: picked ? colors.accentText : colors.text }]}>{topic.title}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// The chips' look: pill-shaped, side by side with a gap between
const styles = StyleSheet.create({
  row: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.s, gap: SPACE.s },
  chip: {
    minHeight: 40, paddingHorizontal: SPACE.l, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
