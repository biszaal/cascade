import type { GameState, Move } from './types';
import { applyMoveInPlace, canMove, isSolved, moveFor, topColor, undoMoveInPlace } from './rules';

/**
 * IDA* solver.
 *
 * This is the most important file in the project. It computes each level's optimal move
 * count at build time, and that number becomes the level's par - so if this is wrong,
 * the scoring of every level in the game is wrong. It also backs the in-app hint.
 */

export interface SolveOptions {
  /** Search budget. The generator gets a big one; a runtime hint gets a small one. */
  maxNodes?: number;
  /** Refuse to look for solutions longer than this. */
  maxDepth?: number;
}

export interface SolveResult {
  solved: boolean;
  moves: Move[];
  /** Nodes expanded. The best single predictor of how hard a board feels to a human. */
  nodes: number;
  /** True when the search ran out of budget rather than out of board. */
  exhausted: boolean;
}

const DEFAULT_MAX_NODES = 2_000_000;
const DEFAULT_MAX_DEPTH = 200;

/**
 * Admissible lower bound: for each colour, the number of distinct lanes holding it,
 * minus one.
 *
 * A pour moves tokens of exactly one colour, so it can retire at most one unit of this
 * sum per move. That is what makes it admissible, and admissibility is what makes IDA*
 * return a genuinely optimal answer rather than merely a short one.
 */
export function heuristic(state: GameState): number {
  const lanesPerColor = new Map<number, number>();
  for (const lane of state.lanes) {
    if (lane.tokens.length === 0) continue;
    const seen = new Set<number>();
    for (const token of lane.tokens) seen.add(token);
    for (const color of seen) lanesPerColor.set(color, (lanesPerColor.get(color) ?? 0) + 1);
  }
  let total = 0;
  for (const count of lanesPerColor.values()) total += count - 1;
  return total;
}

/**
 * A key that ignores lane order, because lanes are interchangeable - the board with
 * [red,red] in slot 0 is the same puzzle as the one with [red,red] in slot 3.
 *
 * Sorting before hashing is where nearly all of this solver's speed comes from.
 */
export function canonicalKey(state: GameState): string {
  const parts = state.lanes.map((lane) => `${lane.tokens.join(',')}:${lane.hidden}`);
  parts.sort();
  return parts.join('|');
}

export function solve(state: GameState, options: SolveOptions = {}): SolveResult {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  const working = {
    capacity: state.capacity,
    colorCount: state.colorCount,
    lanes: state.lanes.map((lane) => ({ tokens: [...lane.tokens], hidden: lane.hidden })),
  };

  let nodes = 0;
  let exhausted = false;
  const path: Move[] = [];

  let threshold = heuristic(working);
  if (isSolved(working)) return { solved: true, moves: [], nodes: 0, exhausted: false };

  // Visited maps a canonical key to the cheapest g it has been reached at. Re-entering a
  // state at equal or greater cost can never lead anywhere new.
  let visited = new Map<string, number>();

  while (threshold <= maxDepth) {
    visited = new Map();
    const next = search(0, threshold, -1, -1);
    if (next === FOUND) {
      return { solved: true, moves: [...path], nodes, exhausted: false };
    }
    if (exhausted) return { solved: false, moves: [], nodes, exhausted: true };
    if (next === INFINITY) return { solved: false, moves: [], nodes, exhausted: false };
    threshold = next;
  }

  return { solved: false, moves: [], nodes, exhausted };

  /**
   * Depth-first search bounded by f = g + h. Returns FOUND, or the smallest f that
   * exceeded the bound - which becomes the next iteration's threshold.
   */
  function search(g: number, bound: number, lastFrom: number, lastTo: number): number {
    const h = heuristic(working);
    const f = g + h;
    if (f > bound) return f;
    if (h === 0 && isSolved(working)) return FOUND;

    if (nodes >= maxNodes) {
      exhausted = true;
      return INFINITY;
    }
    nodes++;

    const key = canonicalKey(working);
    const seenAt = visited.get(key);
    if (seenAt !== undefined && seenAt <= g) return INFINITY;
    visited.set(key, g);

    let min = INFINITY;
    const laneCount = working.lanes.length;

    // Only try the FIRST empty lane and the first lane of each identical shape. Every
    // empty lane is the same empty lane, and pouring into any of them gives the same
    // position, so exploring the rest is pure waste.
    const triedDestinations = new Set<string>();
    const triedSources = new Set<string>();

    for (let from = 0; from < laneCount; from++) {
      const source = working.lanes[from]!;
      if (source.tokens.length === 0) continue;

      const sourceShape = `${source.tokens.join(',')}:${source.hidden}`;
      if (triedSources.has(sourceShape)) continue;
      triedSources.add(sourceShape);

      triedDestinations.clear();
      for (let to = 0; to < laneCount; to++) {
        // Immediately reversing the previous pour is always a wasted pair of moves.
        if (from === lastTo && to === lastFrom) continue;
        if (!canMove(working, from, to)) continue;

        const dest = working.lanes[to]!;
        const destShape = `${dest.tokens.join(',')}:${dest.hidden}`;
        if (triedDestinations.has(destShape)) continue;
        triedDestinations.add(destShape);

        const move = moveFor(working, from, to);
        const undo = applyMoveInPlace(working, move);
        path.push(move);

        const result = search(g + 1, bound, from, to);
        if (result === FOUND) return FOUND;
        if (result < min) min = result;

        path.pop();
        undoMoveInPlace(working, undo);

        if (exhausted) return INFINITY;
      }
    }

    return min;
  }
}

const FOUND = -1;
const INFINITY = Number.MAX_SAFE_INTEGER;

/**
 * A single next move for the hint button.
 *
 * `known` is the level's precomputed optimal line. When the player is still on it, the
 * hint is a free array lookup; once they have deviated we pay for a bounded re-solve,
 * and if even that runs out of budget we fall back to any move that does not make the
 * board worse - a weak hint beats a spinner that never resolves.
 */
export function hintMove(
  state: GameState,
  known?: { movesPlayed: number; solution: Move[]; onPath: boolean },
): Move | null {
  if (known?.onPath) {
    const next = known.solution[known.movesPlayed];
    if (next && canMove(state, next.from, next.to)) return next;
  }

  const result = solve(state, { maxNodes: 150_000 });
  if (result.solved && result.moves.length > 0) return result.moves[0]!;

  return fallbackMove(state);
}

/** Any legal move that does not increase the heuristic. Used only when search gives up. */
function fallbackMove(state: GameState): Move | null {
  const base = heuristic(state);
  let best: Move | null = null;
  let bestScore = Number.MAX_SAFE_INTEGER;

  for (let from = 0; from < state.lanes.length; from++) {
    for (let to = 0; to < state.lanes.length; to++) {
      if (!canMove(state, from, to)) continue;
      const move = moveFor(state, from, to);
      const undo = applyMoveInPlace(state, move);
      const score = heuristic(state);
      undoMoveInPlace(state, undo);

      // Prefer a move that pours onto its own colour rather than into empty space.
      const ontoOwnColor = topColor(state.lanes[to]!) === topColor(state.lanes[from]!) ? 0 : 1;
      const ranked = score * 2 + ontoOwnColor;
      if (score <= base && ranked < bestScore) {
        bestScore = ranked;
        best = move;
      }
    }
  }
  return best;
}
