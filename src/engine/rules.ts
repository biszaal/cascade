import type { ColorId, GameState, LaneState, LevelConfig, Move, UndoRecord } from './types';

/**
 * The rules of Cascade. Pure TypeScript, no React Native, no I/O - which is why the same
 * file backs the build-time level generator, the in-app hint, and (later) server-side
 * score validation.
 */

/** Build a playable state from a level config, enforcing the top-is-revealed invariant. */
export function createState(config: LevelConfig): GameState {
  return {
    capacity: config.capacity,
    colorCount: config.colorCount,
    lanes: config.lanes.map((tokens, i) => {
      const copy = [...tokens];
      return {
        tokens: copy,
        hidden: clampHidden(config.hidden[i] ?? 0, copy.length),
        // An empty lane has no base to anchor, so the flag is meaningless there.
        anchored: (config.anchored?.[i] ?? false) && copy.length > 0,
      };
    }),
  };
}

export function cloneState(state: GameState): GameState {
  return {
    capacity: state.capacity,
    colorCount: state.colorCount,
    lanes: state.lanes.map((lane) => ({
      tokens: [...lane.tokens],
      hidden: lane.hidden,
      anchored: lane.anchored,
    })),
  };
}

/** A face-down token can never sit on top, and an empty lane hides nothing. */
function clampHidden(hidden: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(hidden, length - 1));
}

export function topColor(lane: LaneState): ColorId | null {
  return lane.tokens.length === 0 ? null : lane.tokens[lane.tokens.length - 1]!;
}

/**
 * How many consecutive same-coloured tokens sit at the top.
 *
 * The run stops at the first face-down token: the player cannot see through it, so it
 * cannot be part of a pour even when its colour happens to match.
 */
export function topRun(lane: LaneState): number {
  const color = topColor(lane);
  if (color === null) return 0;
  let run = 0;
  for (let i = lane.tokens.length - 1; i >= lane.hidden; i--) {
    if (lane.tokens[i] !== color) break;
    run++;
  }
  return run;
}

export function isLaneUniform(lane: LaneState): boolean {
  if (lane.tokens.length === 0) return false;
  const first = lane.tokens[0]!;
  return lane.tokens.every((t) => t === first);
}

export function isLaneComplete(lane: LaneState, capacity: number): boolean {
  return lane.tokens.length === capacity && isLaneUniform(lane);
}

export function canMove(state: GameState, from: number, to: number): boolean {
  if (from === to) return false;
  const source = state.lanes[from];
  const dest = state.lanes[to];
  if (!source || !dest) return false;
  if (source.tokens.length === 0) return false;
  if (dest.tokens.length >= state.capacity) return false;

  // Taking a completed lane apart is never progress.
  if (isLaneComplete(source, state.capacity)) return false;

  const destTop = topColor(dest);
  if (destTop !== null && destTop !== topColor(source)) return false;

  // Moving a lane's LAST token into an empty lane just swaps two interchangeable lanes -
  // provably the same position, one move later. Relocating a taller stack one token at a
  // time is legitimate, so only this exact case is refused.
  if (destTop === null && source.tokens.length === 1) return false;

  return true;
}

/**
 * Build the move for a from/to pair.
 *
 * Exactly one token travels per move. A tap moves the top token and nothing else, so a
 * run of three same-coloured tokens costs three moves to relocate - which is what makes
 * a tidy board worth more than a lucky one.
 */
// `_state` is unused now that every move is one token, but the parameter stays so this
// reads alongside canMove(state, from, to) at every call site.
export function moveFor(_state: GameState, from: number, to: number): Move {
  return { from, to, count: 1 };
}

export function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < state.lanes.length; from++) {
    for (let to = 0; to < state.lanes.length; to++) {
      if (canMove(state, from, to)) moves.push(moveFor(state, from, to));
    }
  }
  return moves;
}

/**
 * Apply a pour by mutating `state`, returning what is needed to reverse it.
 *
 * The solver walks millions of nodes, so it cannot afford to clone a state per branch.
 * `applyMove` below wraps this for the UI, where immutability matters more than speed.
 */
export function applyMoveInPlace(state: GameState, move: Move): UndoRecord {
  const source = state.lanes[move.from]!;
  const dest = state.lanes[move.to]!;
  const undo: UndoRecord = {
    from: move.from,
    to: move.to,
    count: move.count,
    fromHidden: source.hidden,
    toHidden: dest.hidden,
  };

  for (let i = 0; i < move.count; i++) dest.tokens.push(source.tokens.pop()!);

  // The token now on top of the source must be face-up.
  source.hidden = clampHidden(source.hidden, source.tokens.length);

  // A lane that just became full and single-coloured is finished, so it flips itself
  // face-up. Without this a player could complete a lane blind and never be told.
  if (isLaneComplete(dest, state.capacity)) dest.hidden = 0;

  return undo;
}

export function undoMoveInPlace(state: GameState, undo: UndoRecord): void {
  const source = state.lanes[undo.from]!;
  const dest = state.lanes[undo.to]!;
  for (let i = 0; i < undo.count; i++) source.tokens.push(dest.tokens.pop()!);
  source.hidden = undo.fromHidden;
  dest.hidden = undo.toHidden;
}

/** Immutable apply, for the UI and for tests. */
export function applyMove(state: GameState, move: Move): GameState {
  const next = cloneState(state);
  applyMoveInPlace(next, move);
  return next;
}

export function isSolved(state: GameState): boolean {
  for (const lane of state.lanes) {
    if (lane.tokens.length === 0) continue;
    if (!isLaneComplete(lane, state.capacity)) return false;
  }
  return true;
}

/** True when no legal move remains and the board is not solved. */
export function isStuck(state: GameState): boolean {
  return !isSolved(state) && legalMoves(state).length === 0;
}

export function countHidden(state: GameState): number {
  return state.lanes.reduce((sum, lane) => sum + lane.hidden, 0);
}

/**
 * Replay a move list from a starting state.
 *
 * Returns null if any move in the list is illegal - which is exactly what a server-side
 * score validator needs, and what the level-pack test uses to prove a shipped solution
 * really solves its level.
 */
export function replay(state: GameState, moves: Move[]): GameState | null {
  let current = cloneState(state);
  for (const move of moves) {
    if (!canMove(current, move.from, move.to)) return null;
    const sized = moveFor(current, move.from, move.to);
    if (sized.count !== move.count) return null;
    applyMoveInPlace(current, move);
  }
  return current;
}
