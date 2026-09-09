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
  /**
   * A base token that can never move, so this lane can only ever finish in its colour.
   * Anchors sit at index 0; the rule is enforced in `canMove`.
   */
  anchored: boolean;
}

export interface GameState {
  lanes: LaneState[];
  /** How many tokens a lane holds when full. Uniform across the board. */
  capacity: number;
  /** Number of distinct colours in play. Each appears exactly `capacity` times. */
  colorCount: number;
}

/**
 * One token travelling from the top of `from` onto `to`.
 *
 * `count` is always 1: the game moves a single token per move. It is kept as a field so
 * the apply/undo path and the recorded solutions stay explicit about how much moved.
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
  /** Which lanes carry an immovable base token, parallel to `lanes`. Absent means none. */
  anchored?: boolean[];
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
  /** Narrative role in the pacing curve: teach, build, rest, test or climax. */
  beat: string;
  /** Intended difficulty 0..1 from the authored plan, for reviewing the curve. */
  intensity: number;
  /** Why this level exists. */
  note: string;
}
