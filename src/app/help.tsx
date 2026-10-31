/* =====================================================================
   HELP (/help)
   The instructions for every part of the app. It slides in on top of
   the tabs, with a back arrow in its header.
   - Along the top: a row of topic buttons (The Shelf, Binder pages,
     MTG Card Finder, Settings) that stays put while you scroll. Tapping
     one shows that topic's instructions.
   - Under the topic's title and summary: "In this topic", a list of its
     sections. Tapping one scrolls down to it.
   - Then the sections themselves.
   Other screens open Help at the right spot with a "topic": for example
   /help?topic=finder (a whole topic) or /help?topic=binder-moving (one
   section, opening its topic first). The "?" button in each header does
   this. Links inside the text (HelpLink) jump the same way.
   The text itself is in src/components/help/helpTopics.tsx.
   ===================================================================== */

import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/hooks/useTheme';
import { useShortcutKeys, useShowKeyHints } from '@/hooks/useShortcutKeys';
import { MAX_CONTENT_WIDTH, RADIUS, SPACE } from '@/theme/colors';
import Button from '@/components/Button';
import ShortcutsDialog, { type Shortcut } from '@/components/ShortcutsDialog';
import { helpTopics, topicFor } from '@/components/help/helpTopics';
import { HelpJumpContext, Key } from '@/components/help/HelpText';
import TopicChips from '@/components/help/TopicChips';

// The keys listed in this screen's Keyboard shortcuts window (press ?
// on a computer)
const helpShortcuts: Shortcut[] = [
  { keys: <Key>Tab</Key>, does: 'Move to the next link (the topics at the top, then the instructions)' },
  { keys: <><Key>Shift</Key> + <Key>Tab</Key></>, does: 'Move back to the link before' },
  { keys: <Key>Enter</Key>, does: 'Open the topic or link' },
  { keys: <Key>?</Key>, does: 'Show this list' },
];

export default function HelpScreen() {
  const colors = useColors();
  // The phone's "safe area": how much room the home bar (or rounded
  // corners) take at the bottom, so the last line isn't hidden behind it
  const insets = useSafeAreaInsets();

  // The topic or section asked for when Help was opened (like "finder")
  const { topic: askedFor } = useLocalSearchParams<{ topic?: string }>();

  // Which topic is showing: the one asked for (or the one holding the
  // section asked for), or the first one
  const [topicId, setTopicId] = useState(() => topicFor(askedFor ?? '')?.id ?? helpTopics[0].id);
  const topic = helpTopics.find((t) => t.id === topicId) ?? helpTopics[0];
  // Its sections, without the keyboard ones in the phone app (or on a
  // phone-sized screen), where nobody uses shortcut keys
  const showKeyHints = useShowKeyHints();
  const sections = topic.sections.filter((section) => showKeyHints || !section.computerOnly);

  /* ----- Scrolling to a section ----- */

  // The scrolling area, so we can tell it where to scroll
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // How far down the scrolling area each section starts (measured as it's
  // drawn), and how tall the topic buttons are (they stay at the top, so
  // a section scrolled to has to stop just below them)
  const positions = useRef<Record<string, number>>({});
  const chipsHeight = useRef(0);
  // A section to scroll to as soon as it's drawn (after switching topics,
  // the new topic's sections need drawing before we know where they are)
  const pending = useRef<string | null>(null);

  // Scroll so a section's heading sits just under the topic buttons.
  // Returns false if that section hasn't been drawn yet.
  const scrollToSection = useCallback((id: string): boolean => {
    const y = positions.current[id];
    if (y === undefined) return false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - chipsHeight.current - SPACE.s), animated: true });
    return true;
  }, []);

  // Go to a topic or a section, by its id (a topic button, a section in
  // "In this topic", a HelpLink, or the topic Help was opened with):
  //  - a whole topic: show it, from the top
  //  - a section in the topic showing: scroll down to it
  //  - a section in another topic: show that topic, then scroll to the
  //    section once it's drawn (see onSectionLayout)
  const goTo = useCallback((id: string) => {
    const target = topicFor(id);
    if (!target) return;
    if (target.id === id) {
      pending.current = null;
      setTopicId(id);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (target.id === topicId && scrollToSection(id)) return;
    pending.current = id;
    setTopicId(target.id);
  }, [topicId, scrollToSection]);

  // Each section reports where it was drawn; if it's the one waiting to
  // be scrolled to, scroll to it now
  function onSectionLayout(id: string, y: number) {
    positions.current[id] = y;
    if (pending.current === id) {
      pending.current = null;
      scrollToSection(id);
    }
  }

  // When Help is opened again with a different topic (from another
  // screen's "?" button while Help is still open), go to it.
  // (goTo is left out of the list on purpose: this should only run when
  // the topic asked for changes, not every time a topic button is tapped.)
  useEffect(() => {
    if (askedFor) goTo(askedFor);
  }, [askedFor]);

  /* ----- The Keyboard shortcuts window (computers) ----- */

  // Is it open? The ? key opens it.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useShortcutKeys((event) => {
    if (event.key !== '?') return;
    event.preventDefault();
    setShortcutsOpen(true);
  });

  return (
    // Every HelpLink in the text uses goTo to jump (see HelpText.tsx)
    <HelpJumpContext.Provider value={goTo}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xxl }]}
        // The first thing inside (the topic buttons) stays stuck to the
        // top while the rest scrolls under it
        stickyHeaderIndices={[0]}
      >
        {/* THE TOPIC BUTTONS (stuck to the top). The measured height lets
            a section scroll to just below them. */}
        <View
          style={[styles.chipsBar, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}
          onLayout={(event) => { chipsHeight.current = event.nativeEvent.layout.height; }}
        >
          <TopicChips topics={helpTopics} current={topic.id} onPick={goTo} />
        </View>

        {/* THE TOPIC'S TITLE AND SUMMARY */}
        <View style={styles.column}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{topic.title}</Text>
          <Text style={[styles.lead, { color: colors.muted }]}>{topic.lead}</Text>

          {/* "IN THIS TOPIC": one row per section; tapping one scrolls
              down to it */}
          <View style={[styles.contents, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.contentsTitle, { color: colors.muted }]}>In this topic</Text>
            {sections.map((section, index) => (
              <Pressable
                key={section.id}
                accessibilityRole="link"
                onPress={() => goTo(section.id)}
                style={({ pressed }) => [
                  styles.contentsRow,
                  index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                  pressed && { backgroundColor: colors.surfaceHover },
                ]}
              >
                <Text style={[styles.contentsText, { color: colors.text }]}>{section.title}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>

          {/* The Keyboard shortcuts button (only on a computer: phones
              have no shortcut keys) */}
          {showKeyHints && (
            <Button label="Keyboard shortcuts" kind="plain" icon="keypad-outline"
                    onPress={() => setShortcutsOpen(true)} style={styles.shortcutsButton} />
          )}
        </View>

        {/* THE SECTIONS: a heading and its instructions each. Each one
            reports where it was drawn, so it can be scrolled to. The
            "key" includes the topic, so switching topics draws them
            fresh (and measures them again). */}
        {sections.map((section) => (
          <View
            key={`${topic.id}/${section.id}`}
            style={[styles.column, styles.section, { borderTopColor: colors.border }]}
            onLayout={(event) => onSectionLayout(section.id, event.nativeEvent.layout.y)}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]} accessibilityRole="header">
              {section.title}
            </Text>
            {section.body}
          </View>
        ))}
      </ScrollView>

      {/* The Keyboard shortcuts window (opens with the ? key) */}
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={helpShortcuts}
        note={
          <>
            Each screen has its own keys: press <Key>?</Key> on The Shelf, inside a binder or on
            the MTG Card Finder to see them.
          </>
        }
      />
    </HelpJumpContext.Provider>
  );
}

// The screen's look: the text in one column (never too wide to read
// comfortably on a big screen), with room around it
const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  chipsBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  column: {
    width: '100%', maxWidth: MAX_CONTENT_WIDTH * 0.75, alignSelf: 'center',
    paddingHorizontal: SPACE.l,
  },
  title: { fontSize: 26, fontWeight: '700', marginTop: SPACE.l, marginBottom: SPACE.s },
  lead: { fontSize: 17, lineHeight: 25, marginBottom: SPACE.l },
  contents: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS, overflow: 'hidden', marginBottom: SPACE.s },
  contentsTitle: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: SPACE.l, paddingTop: SPACE.m, paddingBottom: SPACE.xs,
  },
  // Each row at least 44 points tall: the size phones recommend for a finger
  contentsRow: {
    minHeight: 44, paddingHorizontal: SPACE.l, paddingVertical: SPACE.s,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.s,
  },
  contentsText: { flex: 1, fontSize: 16 },
  shortcutsButton: { alignSelf: 'flex-start', marginTop: SPACE.xs },
  section: { paddingTop: SPACE.l, marginTop: SPACE.l, borderTopWidth: StyleSheet.hairlineWidth },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: SPACE.m },
});
