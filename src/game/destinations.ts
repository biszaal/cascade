import { canMove } from '@/engine/rules';
import type { GameState } from '@/engine/types';

/**
 * What each lane is to the token currently held.
 *
 * A board that answers "where can this go?" only by refusing taps makes the player run
 * the rules in their head and confirm each guess with a shake. The rules are not the
 * interesting part of this game - the planning is - so the board states them instead.
 *
 * The answer comes from `canMove`, the same predicate the tap handler uses, so what the
 * board offers and what a tap will actually accept cannot drift apart.
 */
export type Destination = 'source' | 'legal' | 'illegal';

/**
 * One entry per lane, parallel to `state.lanes`. Every entry is null while nothing is
 * held: with no token in hand there is no such thing as a legal destination, and dimming
 * the board the moment a player looks at it would be noise.
 */
export function destinationStates(
  state: GameState,
  selected: number | null,
): (Destination | null)[] {
  if (selected === null || !state.lanes[selected]) return state.lanes.map(() => null);
  return state.lanes.map((_, index) => {
    if (index === selected) return 'source';
    return canMove(state, selected, index) ? 'legal' : 'illegal';
  });
}
