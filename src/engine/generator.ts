import type { GameState, LevelConfig, Move } from './types';
import { createState, countHidden, isSolved } from './rules';
import { solve } from './solver';
import { mulberry32, randomInt, shuffle } from './rng';

/**
 * Seeded level generation, run offline by scripts/generate-levels.ts and never at
 * runtime. Every level in the game is reproducible from its seed.
 */

export interface GenerationSpec {
  capacity: number;
  colorCount: number;
  /** Free lanes. Fewer free lanes is the sharpest difficulty lever there is. */
  emptyLanes: number;
  hiddenMin: number;
  hiddenMax: number;
  /**
   * How the board is built.
   *
   * `deal` shuffles every token into the lanes and then checks the result is solvable.
   * It only works when there is slack: measured over random deals, two free lanes are
   * solvable essentially always, but ONE free lane is genuinely unsolvable about 92% of
   * the time - not slow to solve, actually impossible.
   *
   * `reverse` starts from the finished board and walks legal moves backwards, so the
   * result is solvable by construction. It is the only workable option for tight boards.
   */
  strategy?: 'deal' | 'reverse';
  /** Reverse-play only: how many backward moves to walk. More walking, more tangled. */
  reverseSteps?: number;
}

export interface Candidate {
  seed: number;
  config: LevelConfig;
  solution: Move[];
  optimal: number;
  par: number;
  difficulty: number;
  nodes: number;
}

/**
 * Extra moves granted per face-down token.
 *
 * The solver knows what every hidden token is; a player does not, and will spend moves
 * finding out. Par has to pay for that discovery or hidden levels would be unwinnable at
 * three stars. This is the one number to recalibrate against real play data.
 */
export const HIDDEN_PENALTY = 0.6;

export function parFor(optimal: number, hiddenCount: number): number {
  return optimal + Math.ceil(hiddenCount * HIDDEN_PENALTY);
}

/**
 * How hard a board feels.
 *
 * Nodes expanded dominates, on a log scale, because search effort tracks human difficulty
 * far better than solution length does - a long but forced solution is easy, while a
 * short one with many plausible wrong turns is not.
 */
export function scoreDifficulty(input: {
  nodes: number;
  optimal: number;
  colorCount: number;
  emptyLanes: number;
  hiddenCount: number;
}): number {
  const search = 6 * Math.log2(input.nodes + 1);
  const length = 1.6 * input.optimal;
  const colors = 1.5 * input.colorCount;
  const blind = 2.2 * input.hiddenCount;
  const relief = 4 * input.emptyLanes;
  return Math.max(0, Math.round(search + length + colors + blind - relief));
}

/** Deal a shuffled, fully-mixed board from a spec. */
export function dealBoard(seed: number, spec: GenerationSpec): LevelConfig {
  const rng = mulberry32(seed);

  const pool: number[] = [];
  for (let color = 0; color < spec.colorCount; color++) {
    for (let n = 0; n < spec.capacity; n++) pool.push(color);
  }
  shuffle(rng, pool);

  const lanes: number[][] = [];
  for (let i = 0; i < spec.colorCount; i++) {
    lanes.push(pool.slice(i * spec.capacity, (i + 1) * spec.capacity));
  }
  for (let i = 0; i < spec.emptyLanes; i++) lanes.push([]);

  const hidden = lanes.map((lane) => {
    if (lane.length === 0) return 0;
    const span = spec.hiddenMax - spec.hiddenMin + 1;
    const want = spec.hiddenMin + randomInt(rng, Math.max(1, span));
    // A face-down token can never be on top, so a lane can hide at most capacity - 1.
    return Math.max(0, Math.min(want, spec.capacity - 1));
  });

  return { capacity: spec.capacity, colorCount: spec.colorCount, lanes, hidden };
}

/**
 * Build a board by walking backwards from the solved position.
 *
 * A reverse move lifts `k` same-coloured tokens off the top of a solved-ish lane and
 * drops them on another. It is only taken when the forward move that undoes it would be
 * legal, which makes the finished board solvable by construction - no search required,
 * and no dependence on getting lucky with a shuffle.
 */
export function reverseBoard(seed: number, spec: GenerationSpec): LevelConfig {
  const rng = mulberry32(seed);
  const steps = spec.reverseSteps ?? spec.colorCount * 6;

  const lanes: number[][] = [];
  for (let color = 0; color < spec.colorCount; color++) {
    lanes.push(new Array<number>(spec.capacity).fill(color));
  }
  for (let i = 0; i < spec.emptyLanes; i++) lanes.push([]);

  for (let step = 0; step < steps; step++) {
    const options: Array<{ from: number; to: number; count: number }> = [];

    for (let from = 0; from < lanes.length; from++) {
      const source = lanes[from]!;
      if (source.length === 0) continue;
      const color = source[source.length - 1]!;

      let run = 0;
      for (let i = source.length - 1; i >= 0 && source[i] === color; i--) run++;

      for (let to = 0; to < lanes.length; to++) {
        if (to === from) continue;
        const dest = lanes[to]!;
        const space = spec.capacity - dest.length;
        if (space === 0) continue;
        // Land on a different colour, so the tokens we place are exactly the top run of
        // the destination and the forward move puts back precisely what we took.
        if (dest.length > 0 && dest[dest.length - 1] === color) continue;

        for (let count = 1; count <= Math.min(run, space); count++) {
          // The forward move needs the source to accept the tokens back: either we
          // emptied it, or we left some of the same colour on top.
          const leaves = source.length - count;
          const legal = leaves === 0 || source[leaves - 1] === color;
          if (legal) options.push({ from, to, count });
        }
      }
    }

    if (options.length === 0) break;
    const pick = options[randomInt(rng, options.length)]!;
    const moved = lanes[pick.from]!.splice(lanes[pick.from]!.length - pick.count, pick.count);
    for (const token of moved) lanes[pick.to]!.push(token);
  }

  const hidden = lanes.map((lane) => {
    if (lane.length === 0) return 0;
    const span = spec.hiddenMax - spec.hiddenMin + 1;
    const want = spec.hiddenMin + randomInt(rng, Math.max(1, span));
    return Math.max(0, Math.min(want, spec.capacity - 1));
  });

  return { capacity: spec.capacity, colorCount: spec.colorCount, lanes, hidden };
}

/**
 * Try one seed. Returns null when the board is unusable: already solved, dealt into a
 * dead end, or too hard for the search budget.
 *
 * Hidden counts are applied BEFORE solving, so the recorded solution respects the pour
 * restriction that face-down tokens impose and is genuinely playable.
 */
export function tryCandidate(
  seed: number,
  spec: GenerationSpec,
  maxNodes = 400_000,
): Candidate | null {
  const strategy = spec.strategy ?? (spec.emptyLanes >= 2 ? 'deal' : 'reverse');
  const config = strategy === 'reverse' ? reverseBoard(seed, spec) : dealBoard(seed, spec);
  const state: GameState = createState(config);

  if (isSolved(state)) return null;

  const result = solve(state, { maxNodes });
  if (!result.solved) return null;

  // A board that falls apart in a couple of moves is not a puzzle.
  if (result.moves.length < spec.colorCount) return null;

  const hiddenCount = countHidden(state);
  return {
    seed,
    config,
    solution: result.moves,
    optimal: result.moves.length,
    par: parFor(result.moves.length, hiddenCount),
    difficulty: scoreDifficulty({
      nodes: result.nodes,
      optimal: result.moves.length,
      colorCount: spec.colorCount,
      emptyLanes: spec.emptyLanes,
      hiddenCount,
    }),
    nodes: result.nodes,
  };
}

/**
 * Build a pool of solvable candidates for one level slot.
 *
 * The caller then picks by percentile rather than against an absolute difficulty band.
 * Ranking within a pool self-calibrates: it produces a smooth ramp across a chapter
 * without anyone having to guess what score "level 17 of 30" ought to be.
 */
export function buildPool(
  baseSeed: number,
  spec: GenerationSpec,
  size: number,
  maxNodes = 400_000,
): Candidate[] {
  const pool: Candidate[] = [];
  for (let attempt = 0; pool.length < size && attempt < size * 12; attempt++) {
    const candidate = tryCandidate(baseSeed + attempt * 7919, spec, maxNodes);
    if (candidate) pool.push(candidate);
  }
  pool.sort((a, b) => a.difficulty - b.difficulty || a.seed - b.seed);
  return pool;
}

/** Pick the candidate sitting at `percentile` (0..1) of a ranked pool. */
export function pickByPercentile(pool: Candidate[], percentile: number): Candidate | null {
  if (pool.length === 0) return null;
  const clamped = Math.max(0, Math.min(1, percentile));
  const index = Math.round(clamped * (pool.length - 1));
  return pool[index]!;
}
