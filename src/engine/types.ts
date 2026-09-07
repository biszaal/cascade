/** A colour index into `tokenColors`. Never a hex string - the engine knows nothing about paint. */
export type ColorId = number;

/**
 * One lane of the board.
 *
 * `tokens[0]` is the BOTTOM of the lane; the last element is the top.
 * Tokens at indices `< hidden` are face-down.
 *
 * Invariant, enforced after every mutation: the top token is ALWAYS revealed, so
 * `hidden <= tokens.length - 1` for a non-empty lane and `hidden === 0` for an empty one.
 * That single invariant is the entire hidden-token mechanic - removing a token from the
 * top necessarily flips the next one face-up.
 */
export interface LaneState {
  tokens: ColorId[];
  hidden: number;
}

export interface GameState {
  lanes: LaneState[];
  /** How many tokens a lane holds when full. Uniform across the board. */
  capacity: number;
  /** Number of distinct colours in play. Each appears exactly `capacity` times. */
  colorCount: number;
}

/**
 * A pour. `count` consecutive same-coloured tokens travel from the top of `from` onto
 * `to`, and the whole thing counts as ONE move.
 */
export interface Move {
  from: number;
  to: number;
  count: number;
}

/** Everything needed to reverse an in-place move, so the solver can search without cloning. */
export interface UndoRecord {
  from: number;
  to: number;
  count: number;
  fromHidden: number;
  toHidden: number;
}

/** The shape stored in a generated level pack. */
export interface LevelConfig {
  capacity: number;
  colorCount: number;
  /** Lane contents, bottom-first. Empty arrays are the free lanes. */
  lanes: ColorId[][];
  /** Face-down count per lane, parallel to `lanes`. */
  hidden: number[];
}

export interface Level {
  id: number;
  chapter: number;
  index: number;
  seed: number;
  config: LevelConfig;
  /** Move budget for three stars. Includes the hidden-token fairness allowance. */
  par: number;
  /** Optimal solution found at build time, so the common hint case is an array lookup. */
  solution: Move[];
  difficulty: number;
}
