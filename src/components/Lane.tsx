import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { duration, radius, spring, surface, tokenColors } from '@/design/tokens';

interface LaneProps {
  x: number;
  y: number;
  width: number;
  height: number;
  complete: boolean;
  completeColor: number | null;
  selected: boolean;
  /** Changes to trigger a refusal shake. */
  rejectNonce: number | null;
  calm: boolean;
  label: string;
  hint: string;
  onPress: () => void;
}

/**
 * The printed depression a stack of tokens sits in.
 *
 * Draws no tokens itself - they live in a layer above the whole board so they can travel
 * between lanes. This is purely the well, its baseline, and the tap target.
 */
function LaneView({ x, y, width, height, complete, completeColor, selected, rejectNonce, calm, label, hint, onPress }: LaneProps) {
  const shake = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    if (rejectNonce === null) return;
    if (calm) return;
    shake.value = withSequence(
      withTiming(-1, { duration: duration.shake }),
      withTiming(1, { duration: duration.shake }),
      withTiming(-0.6, { duration: duration.shake }),
      withSpring(0, spring.snappy),
    );
  }, [rejectNonce, shake, calm]);

  useEffect(() => {
    press.value = withSpring(selected ? 1 : 0, spring.snappy);
  }, [selected, press]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 7 }, { scale: 1 + press.value * 0.03 }],
  }));

  const tint = complete && completeColor !== null ? tokenColors[completeColor % tokenColors.length]! : null;

  return (
    <Animated.View style={[styles.wrap, { left: x, top: y, width, height }, animatedStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ selected }}
        // The drawn lane is narrow, so the tap target is deliberately wider than it looks.
        // A near-miss on a puzzle board reads as the game being broken.
        hitSlop={{ top: 12, bottom: 16, left: 8, right: 8 }}
        style={[
          styles.lane,
          {
            borderRadius: radius.md,
            backgroundColor: tint ? `${tint.fill}14` : surface.recess,
            borderColor: selected ? surface.accent : tint ? `${tint.fill}55` : surface.hairline,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.baseline,
            { backgroundColor: tint ? `${tint.fill}88` : surface.baseline },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  lane: { flex: 1, justifyContent: 'flex-end', overflow: 'hidden' },
  // A heavier rule along the bottom, like a line printed on a board.
  baseline: { height: 2, marginHorizontal: 6, borderRadius: 2, marginBottom: 3 },
});

export const Lane = React.memo(LaneView);
