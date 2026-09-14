import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { duration, radius, space, surface, tokenColors, type } from '@/design/tokens';
import { Button } from './Button';
import { RestartIcon, UndoIcon } from './Icons';
import { metricsFor } from '@/game/responsive';
import { useReducedMotion } from '@/game/useReducedMotion';
import * as haptics from '@/game/haptics';

interface StuckSheetProps {
  visible: boolean;
  undosLeft: number;
  /** There is a move to take back and an undo left to spend on it. */
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onExit: () => void;
}

/**
 * The board has dead-ended: say so plainly, and offer the two ways out.
 *
 * Undo clears the dead end, so the sheet closes itself - there is no dismiss button,
 * because a board with no moves has nothing left to look at.
 */
export function StuckSheet({ visible, undosLeft, canUndo, onUndo, onRestart, onExit }: StuckSheetProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShown(false);
      return;
    }
    // Let the last pour land before the board is covered, so the player sees the move
    // that ended it.
    const timer = setTimeout(() => {
      setShown(true);
      haptics.tapStuck();
    }, duration.stuckDelay);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Modal visible={shown} transparent animationType="fade" onRequestClose={onExit}>
      <View style={styles.scrim}>
        <Card undosLeft={undosLeft} canUndo={canUndo} onUndo={onUndo} onRestart={onRestart} />
      </View>
    </Modal>
  );
}

function Card({ undosLeft, canUndo, onUndo, onRestart }: Omit<StuckSheetProps, 'visible' | 'onExit'>) {
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  const calm = useReducedMotion();
  const pop = useSharedValue(0.6);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (calm) {
      pop.value = 1;
      return;
    }
    // Under-damped on purpose: the card bounces in like a cartoon, then settles.
    pop.value = withSpring(1, { damping: 10, stiffness: 220 });
    wobble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration.stuckWobble, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: duration.stuckWobble, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(wobble);
  }, [calm, pop, wobble]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value * 6}deg` }] }));

  return (
    <Animated.View style={[styles.card, { maxWidth: Math.min(metrics.contentWidth, 400) }, cardStyle]}>
      <Animated.View style={faceStyle}>
        <SadToken />
      </Animated.View>

      <Text style={styles.title}>Out of moves!</Text>
      <Text style={styles.body}>No piece can move. Take a move back, or start the level over.</Text>

      {/* Both actions play their own sound (undo's whoop, restart's swoosh), so the buttons
          stay silent rather than tapping over them. */}
      <View style={styles.actions}>
        {canUndo ? (
          <Button
            label={`Undo (${undosLeft} left)`}
            onPress={onUndo}
            icon={<UndoIcon color={surface.chalk} />}
            silent
          />
        ) : (
          <Text style={styles.note}>No undos left</Text>
        )}
        <Button
          label="Restart level"
          variant={canUndo ? 'outline' : 'primary'}
          onPress={onRestart}
          icon={<RestartIcon color={canUndo ? surface.ink : surface.chalk} />}
          silent
        />
      </View>
    </Animated.View>
  );
}

/** A glum token, drawn from the board's own disc: a filled circle with its inset rim. */
function SadToken({ size = 88 }: { size?: number }) {
  const color = tokenColors[0]!;
  return (
    <Svg width={size} height={size} viewBox="0 0 88 88">
      <Circle cx={44} cy={44} r={40} fill={color.fill} stroke={color.shade} strokeWidth={4} />
      {/* Brows tilt up toward the middle - the universal "oh no". */}
      <Path d="M23 31 L37 26 M65 31 L51 26" stroke={color.ink} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={32} cy={40} r={5} fill={color.ink} />
      <Circle cx={56} cy={40} r={5} fill={color.ink} />
      <Path d="M30 64 Q44 52 58 64" stroke={color.ink} strokeWidth={5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: surface.scrim,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  card: {
    width: '100%',
    backgroundColor: surface.chalk,
    borderRadius: radius.sheet,
    borderWidth: 1,
    borderColor: surface.hairline,
    padding: space.lg,
    paddingTop: space.xl,
    gap: space.md,
    alignItems: 'center',
  },
  title: { ...type.hero, fontSize: 36, lineHeight: 42, color: surface.ink, textAlign: 'center', marginTop: space.xs },
  body: { ...type.body, color: surface.graphite, textAlign: 'center', maxWidth: 290, marginTop: -space.xs },
  note: { ...type.label, color: surface.accent, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
