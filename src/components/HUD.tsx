import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, surface, type } from '@/design/tokens';
import { movesUntilStarLost } from '@/game/scoring';
import { BackIcon, HintIcon, RestartIcon, UndoIcon } from './Icons';

interface HUDProps {
  levelLabel: string;
  moves: number;
  par: number;
  hintsRemaining: number;
  canUndo: boolean;
  onBack: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onHint: () => void;
}

/**
 * Moves against par, and four controls. No timer, no lives, no coin balance - the only
 * pressure in this game is the par count, and it is stated plainly rather than shouted.
 */
export function HUD({
  levelLabel,
  moves,
  par,
  hintsRemaining,
  canUndo,
  onBack,
  onUndo,
  onRestart,
  onHint,
}: HUDProps) {
  const remaining = movesUntilStarLost(moves, par);
  const overPar = moves > par;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <BackIcon />
        </Pressable>
        <Text style={styles.level}>{levelLabel}</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>MOVES</Text>
          <Text style={[styles.scoreValue, overPar && styles.scoreValueOver]}>{moves}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>PAR</Text>
          <Text style={styles.scoreValue}>{par}</Text>
        </View>
      </View>

      <Text style={styles.hintLine}>
        {remaining === null
          ? 'One star secured'
          : overPar
            ? `${remaining} more to keep two stars`
            : `${remaining} left for three stars`}
      </Text>

      <View style={styles.controls}>
        <Control label="Undo" onPress={onUndo} disabled={!canUndo}>
          <UndoIcon color={canUndo ? surface.ink : surface.graphite} />
        </Control>
        <Control label="Restart" onPress={onRestart}>
          <RestartIcon />
        </Control>
        <Control label={`Hint ${hintsRemaining}`} onPress={onHint} disabled={hintsRemaining <= 0}>
          <HintIcon color={hintsRemaining > 0 ? surface.ink : surface.graphite} />
        </Control>
      </View>
    </View>
  );
}

function Control({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.control, disabled && styles.controlDisabled]}
    >
      {children}
      <Text style={[styles.controlLabel, disabled && styles.controlLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  level: { ...type.label, color: surface.graphite, textTransform: 'uppercase' },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  scoreBlock: { alignItems: 'center', minWidth: 64 },
  scoreLabel: { ...type.label, fontSize: 10, color: surface.graphite, letterSpacing: 1.2 },
  scoreValue: { ...type.numeralLarge, color: surface.ink },
  scoreValueOver: { color: surface.accent },
  divider: { width: 1, height: 30, backgroundColor: surface.hairline },

  hintLine: { ...type.label, color: surface.graphite, textAlign: 'center' },

  controls: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.base,
    paddingVertical: space.sm + 2,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: surface.chalk,
    borderWidth: 1,
    borderColor: surface.hairline,
  },
  controlDisabled: { opacity: 0.45 },
  controlLabel: { ...type.label, color: surface.ink },
  controlLabelDisabled: { color: surface.graphite },
});
