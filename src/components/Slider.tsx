import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { elevation, plane, radius, spring, surface } from '@/design/tokens';

/** One press of VoiceOver's increment, and one tap of either end cap. */
const STEP = 0.05;

const TRACK = 6;
const KNOB = 22;

interface SliderProps {
  value: number;
  /** Live, on every frame of a drag: for previewing what the value does, never for storing it. */
  onChange: (value: number) => void;
  /** Once, when the finger lifts: the value worth persisting. */
  onCommit: (value: number) => void;
  label: string;
  disabled?: boolean;
}

/**
 * A volume slider, drawn from the board's own parts.
 *
 * The track is a lane - the same recessed well, at a lane's radius - and the knob is a
 * token resting in it. Nothing here is drawn only for this control.
 *
 * Built on the gesture and animation libraries the game already ships rather than a slider
 * dependency, which on this project would mean a native module and so a new build of an app
 * whose whole point today is that it can ship. The drag runs entirely on the UI thread: the
 * shared value moves the knob without a re-render, `onChange` previews the value as the
 * finger moves, and only `onCommit` writes it down.
 */
export function Slider({ value, onChange, onCommit, label, disabled }: SliderProps) {
  const [width, setWidth] = useState(0);
  const fraction = useSharedValue(clamp(value));
  const held = useSharedValue(0);

  // While the finger is down the shared value is the truth; a prop arriving mid-drag would
  // otherwise yank the knob back to where the store has got to.
  const settle = useCallback(
    (next: number) => {
      if (held.value === 0) fraction.value = clamp(next);
    },
    [fraction, held],
  );
  React.useEffect(() => settle(value), [value, settle]);

  const commitAt = useCallback(
    (next: number) => {
      const settled = clamp(next);
      onChange(settled);
      onCommit(settled);
    },
    [onChange, onCommit],
  );

  const span = Math.max(1, width - KNOB);

  const pan = Gesture.Pan()
    .enabled(!disabled && width > 0)
    .minDistance(0)
    .onBegin((event) => {
      held.value = 1;
      fraction.value = clampWorklet((event.x - KNOB / 2) / span);
      runOnJS(onChange)(fraction.value);
    })
    .onUpdate((event) => {
      fraction.value = clampWorklet((event.x - KNOB / 2) / span);
      runOnJS(onChange)(fraction.value);
    })
    .onFinalize(() => {
      held.value = 0;
      runOnJS(commitAt)(fraction.value);
    });

  const fillStyle = useAnimatedStyle(() => ({ width: `${fraction.value * 100}%` }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: fraction.value * span },
      { scale: withSpring(1 + held.value * 0.12, spring.snappy) },
    ],
  }));

  const onAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === 'increment' ? STEP : -STEP;
      commitAt(value + delta);
    },
    [commitAt, value],
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.touch, disabled && styles.disabled]}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        // Drag alone would leave this control unusable with a screen reader, which is not a
        // trade a volume setting gets to make.
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(value) * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        accessibilityState={{ disabled: !!disabled }}
      >
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none" />
      </View>
    </GestureDetector>
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clampWorklet(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

const styles = StyleSheet.create({
  // The drawn track is 6pt; the thing a thumb has to find is 44.
  touch: { height: 44, justifyContent: 'center', minWidth: 132, flex: 1 },
  disabled: { opacity: 0.4 },
  track: {
    ...plane('sunk'),
    height: TRACK,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginHorizontal: KNOB / 2,
  },
  fill: { height: '100%', backgroundColor: surface.accent, borderRadius: radius.pill },
  knob: {
    position: 'absolute',
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: surface.ink,
    ...elevation.resting,
  },
});
