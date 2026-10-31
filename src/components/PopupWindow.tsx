/* =====================================================================
   POP-UP WINDOW
   A window that sits on top of the screen and dims everything behind
   it (like "New binder" or "Delete this binder?"). The screen draws
   this only while the window should be open.
   - Tapping the dimmed area outside, or the phone's Back button
     (Android), closes it, the same as "Cancel".
   - KeyboardAvoidingView: when a text box inside is being typed in, the
     window moves up out of the keyboard's way, so the keyboard never
     covers what you're typing (on a small phone the window scrolls too).
   The buttons along the bottom are given as a list (see PopupButton);
   each one says what it's called and what it does.
   ===================================================================== */

import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';
import Button, { type ButtonKind } from './Button';

// One button along the bottom of the window
export type PopupButton = {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;        // its look (see Button.tsx): "primary" by default
  disabled?: boolean;
};

type Props = {
  title: string;            // the window's heading
  onClose: () => void;      // called for Cancel, a tap outside, or Back
  buttons?: PopupButton[];  // the buttons along the bottom
  children?: ReactNode;     // what goes inside
};

export default function PopupWindow({ title, onClose, buttons = [], children }: Props) {
  const colors = useColors();
  return (
    // "transparent" lets the dimmed screen show around the window;
    // onRequestClose is Android's Back button
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      {/* "padding" pushes the window up by the keyboard's height on
          iPhone; Android does that by itself ("height" helps there) */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fill}>
        {/* The dimmed area: tapping it closes the window */}
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />

        {/* The window itself (pointerEvents "box-none" lets taps beside
            the window reach the dimmed area under it) */}
        <View style={styles.center} pointerEvents="box-none">
          <View
            style={[styles.window, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}
            // Tells screen readers (and the web's shortcut keys) that
            // only this window can be used while it's open
            accessibilityViewIsModal
            aria-modal
          >
            {/* The heading, read out first by screen readers */}
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>

            {/* What goes inside, scrolling if it's taller than the screen
                ("handled" lets taps on buttons inside work while the
                keyboard is up) */}
            <ScrollView showsVerticalScrollIndicator={false} style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>

            {/* The buttons, side by side at the bottom right */}
            {buttons.length > 0 && (
              <View style={styles.buttons}>
                {buttons.map((button) => (
                  <Button key={button.label} label={button.label} onPress={button.onPress}
                          kind={button.kind ?? 'primary'} disabled={button.disabled} />
                ))}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// The window's look: centered, with a dimmed background, rounded
// corners, and never wider than 440 points (on a tablet or computer)
const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  window: {
    width: '100%', maxWidth: 440, maxHeight: '90%',
    borderRadius: RADIUS * 1.4, borderWidth: 1, padding: 20, gap: 14,
  },
  title: { fontSize: 20, fontWeight: '700' },
  body: { flexGrow: 0 },
  bodyContent: { gap: 12 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10 },
});
