import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { duration, spring, surface } from '@/design/tokens';
import * as haptics from '@/game/haptics';

const STAR =
  'M12 2.4l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47L2.6 9.25l6.5-.95L12 2.4z';

interface StampedStarProps {
  filled: boolean;
  /** Position in the cascade; each star lands one `stampGap` after the last. */
  index: number;
  size?: number;
  /** A star already earned and already seen is simply there; only a new one stamps. */
  animate?: boolean;
}

/**
 * A star that stamps in with an overshoot and a ding, rather than appearing.
 *
 * Shared by the win sheet and the records screen so the two cannot drift: the overshoot, the
 * delay ladder and the haptic are one curve in one place, the same reason haptics and sound
 * fire from a single call per event.
 */
export function StampedStar({ filled, index, size = 44, animate = true }: StampedStarProps) {
  const scale = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      scale.value = 1;
      return;
    }
    if (!filled) {
      scale.value = withTiming(1, { duration: duration.sheet });
      return;
    }
    const delay = duration.stampLead + index * duration.stampGap;
    scale.value = withDelay(
      delay,
      withSequence(withSpring(1.28, { damping: 11, stiffness: 280 }), withSpring(1, spring.default)),
    );
    // The ding shares the stamp's delay, so each star is heard as it lands.
    const ding = setTimeout(haptics.tapStar, delay);
    return () => clearTimeout(ding);
  }, [animate, filled, index, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR} fill={filled ? surface.accent : surface.inactive} />
      </Svg>
    </Animated.View>
  );
}
