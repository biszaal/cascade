import type { GameState, LaneState } from '@/engine/types';
import { isLaneComplete, topColor, topRun } from '@/engine/rules';

/**
 * Spoken descriptions of the board.
 *
 * A colour-sorting game read aloud is a hard problem: the entire mechanic is a property
 * that a screen reader cannot show. These strings are the game for anyone using
 * VoiceOver or TalkBack, so they are pure functions and they are tested.
 */

/** Colour names, indexed to match `tokenColors` in the design tokens. */
const COLOR_NAMES = [
  'Vermilion',
  'Sky',
  'Emerald',
  'Saffron',
  'Magenta',
  'Indigo',
  'Cyan',
  'Clay',
  'Slate',
] as const;

export function colorName(colorId: number): string {
  return COLOR_NAMES[colorId % COLOR_NAMES.length] ?? `Colour ${colorId + 1}`;
}

/**
 * Describe one lane, leading with what matters most: whether it is done, then what is on
 * top, because the top token is the only one the player can actually move.
 */
export function describeLane(lane: LaneState, index: number, capacity: number): string {
  const position = `Lane ${index + 1}`;

  if (lane.tokens.length === 0) return `${position}, empty`;

  if (isLaneComplete(lane, capacity)) {
    return `${position}, complete, all ${colorName(lane.tokens[0]!)}`;
  }

  const top = topColor(lane);
  const run = topRun(lane);
  const parts = [
    position,
    `${colorName(top!)} on top`,
    run > 1 ? `${run} in a row` : null,
    `${lane.tokens.length} of ${capacity}`,
    lane.hidden > 0 ? `${lane.hidden} face down` : null,
  ].filter(Boolean);

  return parts.join(', ');
}

/** What double-tapping this lane will do, given what the player is currently holding. */
export function describeLaneAction(
  state: GameState,
  index: number,
  selected: number | null,
): string {
  const lane = state.lanes[index];
  if (!lane) return '';

  if (selected === null) {
    if (lane.tokens.length === 0) return 'Empty, nothing to lift';
    if (isLaneComplete(lane, state.capacity)) return 'Already complete';
    // One token per move, so never promise to lift a run.
    return `Lift ${colorName(topColor(lane)!)}`;
  }

  if (selected === index) return 'Put back';

  const source = state.lanes[selected];
  if (!source || source.tokens.length === 0) return '';

  const holding = colorName(topColor(source)!);
  if (lane.tokens.length >= state.capacity) return `Full, cannot take ${holding}`;
  if (lane.tokens.length === 0) return `Pour ${holding} into the empty lane`;

  const destination = colorName(topColor(lane)!);
  return destination === holding ? `Pour ${holding} here` : `Cannot pour ${holding} onto ${destination}`;
}

/** Progress read out for the HUD. */
export function describeProgress(moves: number, par: number): string {
  if (moves === 0) return `No moves yet. Par is ${par}.`;
  // Spoken aloud, so "1 moves" is not acceptable.
  const played = moves === 1 ? '1 move' : `${moves} moves`;
  const delta = moves - par;
  if (delta < 0) return `${played}, ${-delta} under par.`;
  if (delta === 0) return `${played}, exactly par.`;
  return `${played}, ${delta} over par.`;
}
