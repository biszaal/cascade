import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { duration, font, hiddenToken, spring, surface, tokenColors } from '@/design/tokens';
import { PadlockSolidIcon } from './Icons';

interface TokenProps {
  colorId: number;
  faceDown: boolean;
  /**
   * True only for the base (index 0) token of an anchored lane - it can never move, so
   * that lane can only ever finish in this token's colour.
   */
  anchored: boolean;
  size: number;
  x: number;
  y: number;
  /** Raised clear of its lane because the player is holding it. */
  lifted: boolean;
  /** Bounce in celebration; the value is the token's position in the stagger. */
  celebrate: number | null;
  /** The player has asked the system to reduce motion. */
  calm: boolean;
}

const LIFT = 16;
const ARC = 46;

/**
 * A single disc.
 *
 * Every token on the board is rendered by one of these, absolutely positioned over the
 * whole board rather than nested inside a lane. That is what lets a pour actually travel
 * between lanes instead of disappearing from one and popping up in the other.
 */
function TokenView({ colorId, faceDown, anchored, size, x, y, lifted, celebrate, calm }: TokenProps) {
  const progress = useSharedValue(1);
  const fromX = useSharedValue(x);
  const fromY = useSharedValue(y);
  const toX = useSharedValue(x);
  const toY = useSharedValue(y);
  const arc = useSharedValue(0);
  const hop = useSharedValue(0);
  const lift = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      fromX.value = x;
      fromY.value = y;
      toX.value = x;
      toY.value = y;
      return;
    }
    if (toX.value === x && toY.value === y) return;

    fromX.value = toX.value;
    fromY.value = toY.value;
    toX.value = x;
    toY.value = y;
    // Only arc when actually changing lanes. A token settling within its own lane just
    // slides, because an arc there would look like a twitch.
    // Reduced motion keeps the travel but drops the lob, which is the part that reads as
    // movement through space rather than a change of position.
    arc.value = calm ? 0 : Math.abs(x - fromX.value) > 1 ? ARC : 0;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: calm ? duration.pourCalm : duration.pour,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [x, y, arc, fromX, fromY, progress, toX, toY, calm]);

  useEffect(() => {
    lift.value = withSpring(lifted ? 1 : 0, spring.snappy);
  }, [lifted, lift]);

  useEffect(() => {
    if (celebrate === null || calm) return;
    hop.value = withDelay(
      celebrate * duration.stagger,
      withSequence(
        withTiming(1, { duration: duration.hop, easing: Easing.out(Easing.quad) }),
        withSpring(0, spring.snappy),
      ),
    );
  }, [celebrate, hop, calm]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const px = fromX.value + (toX.value - fromX.value) * p;
    // A parabola peaking halfway through the travel, so the disc is lobbed rather than
    // dragged across the board.
    const parabola = 4 * p * (1 - p);
    const py = fromY.value + (toY.value - fromY.value) * p - arc.value * parabola;

    // Squash briefly on landing, then again for a completion bounce.
    const landing = p > 0.82 ? Math.sin(((p - 0.82) / 0.18) * Math.PI) : 0;
    const squash = 1 - landing * 0.14 - hop.value * 0.1;
    const stretch = 1 + landing * 0.08 + hop.value * 0.06;

    return {
      transform: [
        { translateX: px },
        { translateY: py - lift.value * LIFT - hop.value * 10 },
        { scaleX: stretch },
        { scaleY: squash },
      ],
    };
  });

  const palette = tokenColors[colorId % tokenColors.length]!;
  const fill = faceDown ? hiddenToken.fill : palette.fill;
  const rim = faceDown ? hiddenToken.shade : palette.shade;
  const badge = Math.max(12, Math.round(size * 0.36));

  return (
    <Animated.View
      style={[
        styles.token,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fill, borderColor: rim },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      {faceDown ? (
        <Text
          style={[
            styles.unknown,
            { fontSize: size * 0.5, lineHeight: size * 0.62 },
            // Lifted a touch on an anchor so the question mark clears the padlock badge.
            anchored ? { marginBottom: size * 0.1 } : null,
          ]}
          allowFontScaling={false}
        >
          ?
        </Text>
      ) : null}
      {anchored ? (
        // An anchor can never move, so it is marked by a shape rather than by colour - the
        // palette is colourblind-safe on purpose, and a tint or opacity change would vanish
        // for exactly the players who need the cue most. A padlock says "stays put" outright.
        // The badge ring reuses `rim`, which is already face-down aware, so a hidden anchor
        // still reads as locked without giving its colour away.
        <View
          style={[
            styles.badge,
            {
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              // Seated on the disc's lower edge. Offsets are measured inside the 2pt rim.
              bottom: -Math.round(size * 0.05) - 2,
              borderColor: rim,
            },
          ]}
        >
          <PadlockSolidIcon size={Math.round(badge * 0.6)} color={surface.ink} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  token: {
    position: 'absolute',
    left: 0,
    top: 0,
    // A flat disc with an inset rim: a carrom piece, not a glossy marble.
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A small round lock tag, cut from the board's own felt so it reads on every colour.
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: surface.board,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A question mark states "unknown" outright, which a bare dot only implied. Kept in the
  // muted mark colour so a face-down piece still recedes behind the coloured ones.
  unknown: {
    color: hiddenToken.mark,
    fontFamily: font.monoBold,
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export const Token = React.memo(TokenView);
