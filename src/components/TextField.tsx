/* =====================================================================
   A TEXT BOX
   The app's standard box for typing in (a binder's name, a search),
   with an optional label above it. It's React Native's TextInput with
   the app's colors, and a border that turns orange while it's being
   typed in ("focused"), so it's clear where the typing goes.
   Everything TextInput understands (placeholder, onSubmitEditing,
   maxLength, returnKeyType...) can be passed straight through.
   ===================================================================== */

import { forwardRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useColors } from '@/hooks/useTheme';
import { RADIUS } from '@/theme/colors';

type Props = TextInputProps & { label?: string };

// "forwardRef" lets a screen hold on to the box (to put the cursor in it)
const TextField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TextField({ label, style, onFocus, onBlur, ...rest }, ref) {
  const colors = useColors();
  // Is the box being typed in right now?
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {/* The label above the box, if there is one */}
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        // Remember when it's being typed in (and still tell the screen)
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.bg, borderColor: focused ? colors.accent : colors.border },
          style,
        ]}
        {...rest}
      />
    </View>
  );
});

export default TextField;

// A comfortable box to type in: 44 points tall at least, rounded
const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 15, fontWeight: '600' },
  input: { minHeight: 44, borderWidth: 1.5, borderRadius: RADIUS, paddingHorizontal: 12, fontSize: 16 },
});
