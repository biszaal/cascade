import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Lane } from './Lane';
import { Token } from './Token';
import { computeGeometry, lanePosition, slotPosition } from '@/game/layout';
import { isLaneComplete } from '@/engine/rules';
import { describeLane, describeLaneAction } from '@/game/describe';
import { useReducedMotion } from '@/game/useReducedMotion';
import type { GameState } from '@/engine/types';

interface BoardProps {
  state: GameState;
  /** Stable per-token identity, parallel to `state.lanes[].tokens`. */
  ids: number[][];
  selected: number | null;
  rejected: { lane: number; nonce: number } | null;
  justCompleted: number[];
  hintLane: number | null;
  width: number;
  height: number;
  /** Largest a token may be drawn; supplied by the screen from its size class. */
  maxToken?: number;
  onLanePress: (index: number) => void;
}

export function Board({
  state,
  ids,
  selected,
  rejected,
  justCompleted,
  hintLane,
  width,
  height,
  maxToken,
  onLanePress,
}: BoardProps) {
  const laneCount = state.lanes.length;
  const calm = useReducedMotion();

  const geometry = useMemo(
    () => computeGeometry(laneCount, state.capacity, width, height, maxToken),
    [laneCount, state.capacity, width, height, maxToken],
  );

  // Exactly one token moves per move, so exactly one token lifts. Raising the whole
  // same-coloured run promised a pour the rules no longer deliver.
  const liftedCount = selected === null || state.lanes[selected]!.tokens.length === 0 ? 0 : 1;

  const tokens = useMemo(() => {
    const out: Array<{
      key: number;
      colorId: number;
      faceDown: boolean;
      x: number;
      y: number;
      lifted: boolean;
      celebrate: number | null;
    }> = [];

    state.lanes.forEach((lane, laneIndex) => {
      const celebrating = justCompleted.includes(laneIndex);
      lane.tokens.forEach((colorId, slot) => {
        const position = slotPosition(geometry, laneIndex, slot, state.capacity, laneCount);
        const isLifted = selected === laneIndex && slot >= lane.tokens.length - liftedCount;
        out.push({
          key: ids[laneIndex]?.[slot] ?? laneIndex * 1000 + slot,
          colorId,
          faceDown: slot < lane.hidden,
          x: position.x,
          y: position.y,
          lifted: isLifted,
          // Stagger the celebration from the bottom of the lane upward.
          celebrate: celebrating ? slot : null,
        });
      });
    });
    return out;
  }, [state, ids, geometry, selected, liftedCount, justCompleted, laneCount]);

  return (
    <View style={[styles.board, { width: geometry.boardWidth, height: geometry.boardHeight }]}>
      {state.lanes.map((lane, index) => {
        const position = lanePosition(geometry, index, laneCount);
        const complete = isLaneComplete(lane, state.capacity);
        return (
          <Lane
            key={index}
            x={position.x}
            y={position.y}
            width={geometry.laneWidth}
            height={geometry.laneHeight}
            complete={complete}
            completeColor={complete ? lane.tokens[0]! : null}
            selected={selected === index || hintLane === index}
            rejectNonce={rejected?.lane === index ? rejected.nonce : null}
            calm={calm}
            // The whole mechanic is colour, which a screen reader cannot show - so the
            // lane has to say what it holds and what tapping it would do.
            label={describeLane(lane, index, state.capacity)}
            hint={describeLaneAction(state, index, selected)}
            onPress={() => onLanePress(index)}
          />
        );
      })}

      {/* Tokens live above every lane so a pour can travel between them. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {tokens.map((token) => (
          <Token
            key={token.key}
            colorId={token.colorId}
            faceDown={token.faceDown}
            size={geometry.tokenSize}
            x={token.x}
            y={token.y}
            lifted={token.lifted}
            celebrate={token.celebrate}
            calm={calm}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { position: 'relative', alignSelf: 'center' },
});
