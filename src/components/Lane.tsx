import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { duration, plane, radius, spring, surface, tokenColors } from '@/design/tokens';
import type { Destination } from '@/game/destinations';
import { ChevronIcon } from './Icons';

interface LaneProps {
  x: number;
  y: number;
  width: number;
  height: number;
  complete: boolean;
  completeColor: number | null;
  selected: boolean;
  /**
   * Where a hint says to pour. Deliberately not the same flag as `selected`: a hint lifts
   * a token at its source, so that lane is genuinely selected and already reads as such.
   * Marking both ends the same way - which this board used to do - states that two lanes
   * matter without saying which way the token travels, leaving the player to decode a
   * cue whose whole job was to save them the trouble.
   */
  hintTarget: boolean;
  /**
   * What this lane is to the token currently held: null when nothing is held at all. The
   * board opens the lanes a pour may legally reach and eases back the ones it may not,
   * so the rules are visible instead of being discovered by refusal.
   */
  destination: Destination | null;
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
function LaneView({ x, y, width, height, complete, completeColor, selected, hintTarget, destination, rejectNonce, calm, label, hint, onPress }: LaneProps) {
  const shake = useSharedValue(0);
  const press = useSharedValue(0);
  const pulse = useSharedValue(0);
  const dim = useSharedValue(0);

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

  useEffect(() => {
    if (!hintTarget) {
      pulse.value = 0;
      return;
    }
    // Under reduced motion the chevron simply sits there: it still says where to pour,
    // it just stops breathing to say it.
    if (calm) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration.hintPulse }),
        withTiming(0.4, { duration: duration.hintPulse }),
      ),
      -1,
      false,
    );
  }, [hintTarget, calm, pulse]);

  useEffect(() => {
    const target = destination === 'illegal' ? 1 : 0;
    // Under reduced motion the board still answers, it just stops easing into the answer.
    dim.value = calm ? target : withTiming(target, { duration: duration.offer });
  }, [destination, calm, dim]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - dim.value * 0.35,
    transform: [{ translateX: shake.value * 7 }, { scale: 1 + press.value * 0.03 }],
  }));

  const chevronStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const tint = complete && completeColor !== null ? tokenColors[completeColor % tokenColors.length]! : null;

  // A lane is a well cut into the felt, so it rests on the sunk plane - lit along its far
  // wall, shaded at its lip. A state that rings the whole lane has to override the lit and
  // shaded edges as well as the sides, because leaving them would put two off-white edges
  // on an otherwise accent-coloured ring.
  const ring = (color: string, width: number): ViewStyle => ({
    borderWidth: width,
    borderColor: color,
    borderTopColor: color,
    borderBottomColor: color,
  });

  const well: ViewStyle = {
    ...plane('sunk'),
    borderRadius: radius.md,
    ...(hintTarget || selected
      ? { ...ring(surface.accent, 2), ...(hintTarget ? { backgroundColor: surface.accentSoft } : null) }
      : tint
        ? { ...ring(`${tint.fill}55`, 1), backgroundColor: `${tint.fill}14` }
        : destination === 'legal'
          ? ring(surface.open, 1)
          : null),
  };

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
        style={[styles.lane, well]}
      >
        {/* Pointing down into the mouth of the lane: the cue is a direction, not just a
            highlight, so it reads as "in here" rather than "this one too". */}
        {hintTarget ? (
          <Animated.View style={[styles.chevron, chevronStyle]} pointerEvents="none">
            <View style={styles.chevronTurn}>
              <ChevronIcon size={14} color={surface.accent} />
            </View>
          </Animated.View>
        ) : null}

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
  chevron: { position: 'absolute', top: 4, left: 0, right: 0, alignItems: 'center' },
  // The chevron set is drawn pointing right, so the one icon serves both directions.
  chevronTurn: { transform: [{ rotate: '90deg' }] },
});

export const Lane = React.memo(LaneView);
