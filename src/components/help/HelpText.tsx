/* =====================================================================
   THE PIECES THE HELP TEXT IS WRITTEN WITH
   The Help screen's instructions (helpTopics.tsx) are written with these
   small pieces, the way a web page uses <p>, <li>, <strong> and so on.
   React Native has no web tags: every bit of text has to sit inside a
   <Text>, so each piece here is a Text (or a row holding one), already
   in the app's colors:
   - P: a paragraph
   - Bullet: one point in a list, with a dot in front
   - Step: one numbered step ("1.", "2." ...)
   - Strong: bold words (the names of buttons and things to tap)
   - Em: slanted (italic) words
   - Key: a key on a keyboard, like Enter, drawn in a little box
   - HelpLink: words that jump to another part of the Help screen
   - OnComputer: words about keyboard keys, left out of the phone app
   ===================================================================== */

import { createContext, useContext, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import { useShowKeyHints } from '@/hooks/useShortcutKeys';

/* ----- Jumping to a section (used by HelpLink) ----- */

// The Help screen hands its "jump to this section" function down to
// every HelpLink inside it. A "context" is React's way of passing
// something to pieces deep inside without handing it through every
// piece in between. (Outside the Help screen, a HelpLink does nothing.)
export const HelpJumpContext = createContext<(id: string) => void>(() => { /* not on the Help screen */ });

/* ----- A paragraph ----- */

// A block of text with a little space under it
export function P({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.text, styles.paragraph, { color: colors.text }]}>{children}</Text>;
}

/* ----- One point in a list ----- */

// A dot on the left, and the text beside it (lined up, even when the
// text runs onto a second line)
export function Bullet({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.listRow}>
      {/* The dot is only decoration, so screen readers skip it */}
      <Text style={[styles.text, styles.marker, { color: colors.accent }]} importantForAccessibility="no" accessible={false}>
        •
      </Text>
      <Text style={[styles.text, styles.listText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

/* ----- One numbered step ----- */

// The same as a Bullet, with its number ("1.") instead of a dot. The
// number is read out too, since the order matters.
export function Step({ n, children }: { n: number; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.listRow}>
      <Text style={[styles.text, styles.marker, styles.number, { color: colors.accent }]}>{n}.</Text>
      <Text style={[styles.text, styles.listText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

/* ----- Bold and slanted words ----- */

// Bold, for the names of buttons, screens and settings. (A Text inside
// another Text carries on the same line, like <strong> on a web page.)
export function Strong({ children }: { children: ReactNode }) {
  return <Text style={styles.strong}>{children}</Text>;
}

// Slanted (italic), for a word that needs a little stress
export function Em({ children }: { children: ReactNode }) {
  return <Text style={styles.em}>{children}</Text>;
}

/* ----- A keyboard key ----- */

// A key's name in a typewriter-style font on a shaded background, like
// the label on a key. (Phones can't draw a border around words in the
// middle of a sentence, so it's a shaded background instead.)
export function Key({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <Text style={[styles.key, { backgroundColor: colors.surfaceHover, color: colors.text }]}>
      {/* Thin spaces either side, so the shading doesn't touch the letters */}
      {' '}{children}{' '}
    </Text>
  );
}

/* ----- Words only for computers ----- */

// Text about keyboard keys: shown on the website on a computer, left
// out of the phone app and phone-sized screens (where nobody uses
// shortcut keys). It can wrap a few words inside a sentence, or a whole
// paragraph or bullet.
export function OnComputer({ children }: { children: ReactNode }) {
  return useShowKeyHints() ? <>{children}</> : null;
}

/* ----- A link to another part of Help ----- */

// Orange, underlined words. Tapping them jumps to the section with this
// id (like "my-binders-backup"), opening its topic first if needed.
export function HelpLink({ to, children }: { to: string; children: ReactNode }) {
  const colors = useColors();
  const jump = useContext(HelpJumpContext);
  return (
    <Text
      accessibilityRole="link"
      onPress={() => jump(to)}
      style={[styles.link, { color: colors.accent }]}
    >
      {children}
    </Text>
  );
}

// The look of the help text: comfortable reading size and line spacing,
// list markers in a narrow column of their own
const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 24 },
  paragraph: { marginBottom: 12 },
  listRow: { flexDirection: 'row', marginBottom: 8, paddingRight: 4 },
  marker: { width: 22 },
  number: { fontWeight: '700' },
  listText: { flex: 1 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  // A typewriter-style font: each phone names its own
  key: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 14,
    fontWeight: '600',
  },
  link: { textDecorationLine: 'underline', fontWeight: '600' },
});
