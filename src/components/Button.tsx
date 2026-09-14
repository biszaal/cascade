import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { font, radius, space, spring, surface, type } from '@/design/tokens';
import * as haptics from '@/game/haptics';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'quiet';
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  /** The action plays its own sound, so the press should not add a tap on top of it. */
  silent?: boolean;
}

/** Flat, no glow. Presses translate down a point - a tactile push, not an opacity fade. */
export function Button({ label, onPress, variant = 'primary', disabled, icon, style, silent }: ButtonProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value }, { scale: 1 - pressed.value * 0.008 }],
  }));

  const down = useCallback(() => {
    pressed.value = withSpring(1, spring.snappy);
  }, [pressed]);
  const up = useCallback(() => {
    pressed.value = withSpring(0, spring.snappy);
  }, [pressed]);
  const press = useCallback(() => {
    if (!silent) haptics.tapButton();
    onPress();
  }, [onPress, silent]);

  const palette = {
    primary: { bg: surface.accent, fg: surface.chalk, border: 'transparent' },
    outline: { bg: 'transparent', fg: surface.ink, border: surface.hairline },
    quiet: { bg: surface.chalk, fg: surface.graphite, border: 'transparent' },
  }[variant];

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={press}
        onPressIn={down}
        onPressOut={up}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        style={[
          styles.button,
          { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.4 : 1 },
        ]}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { ...type.body, fontFamily: font.display, letterSpacing: 0.2 },
});
