import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { radius, space, surface, type } from '@/design/tokens';
import { Button } from './Button';
import { StampedStar } from './StampedStar';
import { metricsFor } from '@/game/responsive';

interface WinSheetProps {
  visible: boolean;
  stars: number;
  moves: number;
  par: number;
  isBest: boolean;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onExit: () => void;
}

export function WinSheet({
  visible,
  stars,
  moves,
  par,
  isBest,
  hasNext,
  onNext,
  onReplay,
  onExit,
}: WinSheetProps) {
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  const verdict =
    stars === 3 ? 'Par or better' : stars === 2 ? `${moves - par} over par` : `${moves - par} over par`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onExit}>
      <View style={styles.scrim}>
        {/* Capped and centred: a sheet stretched across an iPad puts its buttons at the
            far edges of a screen the player is holding in two hands. */}
        <View style={[styles.sheet, { maxWidth: metrics.contentWidth + 64 }]}>
          <View style={styles.stars}>
            {[0, 1, 2].map((i) => (
              <StampedStar key={i} filled={i < stars} index={i} />
            ))}
          </View>

          <Text style={styles.title}>Board cleared</Text>
          <Text style={styles.verdict}>{verdict}</Text>

          <View style={styles.numbers}>
            <View style={styles.number}>
              <Text style={styles.numberLabel}>MOVES</Text>
              <Text style={styles.numberValue}>{moves}</Text>
            </View>
            <View style={styles.numberDivider} />
            <View style={styles.number}>
              <Text style={styles.numberLabel}>PAR</Text>
              <Text style={styles.numberValue}>{par}</Text>
            </View>
          </View>

          {isBest ? <Text style={styles.best}>New personal best</Text> : null}

          <View style={styles.actions}>
            {hasNext ? <Button label="Next level" onPress={onNext} /> : null}
            {/* Replaying restarts the level, which plays its own swoosh. */}
            <Button label="Play again" variant="outline" onPress={onReplay} silent />
            <Button label="Back to chapter" variant="quiet" onPress={onExit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: surface.scrim, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    backgroundColor: surface.chalk,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
    alignItems: 'center',
  },
  stars: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  title: { ...type.title, color: surface.ink },
  verdict: { ...type.label, color: surface.graphite, marginTop: -space.sm },

  numbers: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginVertical: space.xs },
  number: { alignItems: 'center', minWidth: 62 },
  numberLabel: { ...type.label, fontSize: 10, letterSpacing: 1.2, color: surface.graphite },
  numberValue: { ...type.numeralLarge, color: surface.ink },
  numberDivider: { width: 1, height: 30, backgroundColor: surface.hairline },

  best: { ...type.label, color: surface.accent },
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.xs },
});
