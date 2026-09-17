import { describe, it, expect } from 'vitest';
import { solve, heuristic, canonicalKey, hintMove, isDeadEnd } from './solver';
import { createState, replay, isSolved, applyMove, applyMoveInPlace, moveFor } from './rules';
import { mulberry32, shuffle } from './rng';
import { reverseBoard } from './generator';
import type { GameState } from './types';

function board(capacity: number, lanes: number[][], hidden?: number[]): GameState {
  return createState({
    capacity,
    colorCount: new Set(lanes.flat()).size,
    lanes: lanes.map((l) => [...l]),
    hidden: hidden ?? lanes.map(() => 0),
  });
}

describe('heuristic', () => {
  it('is zero for a solved board', () => {
    expect(heuristic(board(4, [[0, 0, 0, 0], [1, 1, 1, 1], []]))).toBe(0);
  });

  it('counts one per surplus lane holding a colour', () => {
    // Colour 0 is spread over two lanes, colour 1 over two lanes: 1 + 1.
    expect(heuristic(board(4, [[0, 1], [1, 0], [], []]))).toBe(2);
  });

  it('never over-estimates, which is what makes IDA* optimal', () => {
    const rng = mulberry32(99);
    for (let trial = 0; trial < 40; trial++) {
      const tokens = shuffle(rng, [0, 0, 0, 1, 1, 1, 2, 2, 2]);
      const state = board(3, [tokens.slice(0, 3), tokens.slice(3, 6), tokens.slice(6, 9), []]);
      const result = solve(state);
      if (!result.solved) continue;
      expect(heuristic(state)).toBeLessThanOrEqual(result.moves.length);
    }
  });

  it('keeps the heuristic admissible on anchored boards', () => {
    const spec = {
      capacity: 4, colorCount: 5, emptyLanes: 2,
      hiddenMin: 0, hiddenMax: 0,
      strategy: 'reverse' as const, reverseSteps: 30, anchors: 2,
    };
    for (let seed = 1; seed <= 20; seed++) {
      const state = createState(reverseBoard(seed, spec));
      const result = solve(state, { maxNodes: 300_000 });
      if (!result.solved) continue;
      // Admissible means never overestimating the true remaining cost.
      expect(heuristic(state)).toBeLessThanOrEqual(result.moves.length);
    }
  });
});

describe('canonical key', () => {
  it('treats lane order as irrelevant, since lanes are interchangeable', () => {
    const a = board(4, [[0, 0], [1, 1], []]);
    const b = board(4, [[1, 1], [], [0, 0]]);
    expect(canonicalKey(a)).toBe(canonicalKey(b));
  });

  it('distinguishes boards that differ only in what is face-down', () => {
    const a = board(4, [[0, 1, 2], []], [0, 0]);
    const b = board(4, [[0, 1, 2], []], [2, 0]);
    expect(canonicalKey(a)).not.toBe(canonicalKey(b));
  });
});

describe('canonicalKey with anchors', () => {
  it('separates boards that differ only in which lane is anchored', () => {
    const a = createState({
      capacity: 2, colorCount: 2, lanes: [[0], [1]], hidden: [0, 0], anchored: [true, false],
    });
    const b = createState({
      capacity: 2, colorCount: 2, lanes: [[0], [1]], hidden: [0, 0], anchored: [false, true],
    });
    expect(canonicalKey(a)).not.toBe(canonicalKey(b));
  });

  // Unanchored-lane order-independence is already covered above in 'canonical key' - an
  // unanchored board built here would exercise the exact same property, so it is not
  // repeated.
});

describe('solve', () => {
  it('returns an empty solution for an already-solved board', () => {
    const result = solve(board(4, [[0, 0, 0, 0], [1, 1, 1, 1], []]));
    expect(result.solved).toBe(true);
    expect(result.moves).toEqual([]);
  });

  it('finds the single move that finishes a one-move board', () => {
    const result = solve(board(4, [[0, 0, 0], [0], []]));
    expect(result.solved).toBe(true);
    expect(result.moves).toHaveLength(1);
  });

  it('finds a provably optimal solution on a hand-checked board', () => {
    // Lanes hold [0,1] and [1,0] with two free lanes, capacity 2.
    // Optimal is exactly 3: park the 1 from lane 0 in an empty lane, pour lane 1's 0 onto
    // lane 0's 0 to finish it, then pour lane 1's remaining 1 onto the parked 1.
    // It cannot be done in 2 - the heuristic floor is 2, but a single pour moves at most
    // one token here, so after one move at most one lane can be complete.
    const result = solve(board(2, [[0, 1], [1, 0], [], []]));
    expect(result.solved).toBe(true);
    expect(result.moves).toHaveLength(3);
  });

  it('reports a genuinely unsolvable board as unsolved', () => {
    // Both colours are locked under each other with no free space at all.
    const result = solve(board(2, [[0, 1], [1, 0]]));
    expect(result.solved).toBe(false);
    expect(result.exhausted).toBe(false);
  });

  it('produces solutions that actually replay to a solved board', () => {
    const rng = mulberry32(7);
    let checked = 0;
    for (let trial = 0; trial < 30; trial++) {
      const pool: number[] = [];
      for (let c = 0; c < 4; c++) for (let n = 0; n < 4; n++) pool.push(c);
      shuffle(rng, pool);
      const lanes = [pool.slice(0, 4), pool.slice(4, 8), pool.slice(8, 12), pool.slice(12, 16), [], []];
      const state = board(4, lanes);
      const result = solve(state);
      if (!result.solved) continue;
      const final = replay(state, result.moves);
      expect(final).not.toBeNull();
      expect(isSolved(final!)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('respects the pour restriction imposed by face-down tokens', () => {
    const rng = mulberry32(1234);
    let checked = 0;
    for (let trial = 0; trial < 20; trial++) {
      const pool: number[] = [];
      for (let c = 0; c < 4; c++) for (let n = 0; n < 4; n++) pool.push(c);
      shuffle(rng, pool);
      const lanes = [pool.slice(0, 4), pool.slice(4, 8), pool.slice(8, 12), pool.slice(12, 16), [], []];
      const state = board(4, lanes, [2, 2, 2, 2, 0, 0]);
      const result = solve(state);
      if (!result.solved) continue;
      // replay() re-derives every pour size from the live board, so if the solver had
      // ignored a face-down token this would come back null.
      const final = replay(state, result.moves);
      expect(final).not.toBeNull();
      expect(isSolved(final!)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('stops at the node cap instead of hanging, and says so', () => {
    const pool: number[] = [];
    for (let c = 0; c < 9; c++) for (let n = 0; n < 5; n++) pool.push(c);
    shuffle(mulberry32(4242), pool);
    const lanes: number[][] = [];
    for (let i = 0; i < 9; i++) lanes.push(pool.slice(i * 5, i * 5 + 5));
    lanes.push([]);
    const result = solve(board(5, lanes), { maxNodes: 500 });
    expect(result.exhausted).toBe(true);
    expect(result.solved).toBe(false);
  });

  it('counts the nodes it expanded, which is the difficulty signal', () => {
    const easy = solve(board(4, [[0, 0, 0], [0], []]));
    const hard = solve(board(4, [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []]));
    expect(easy.nodes).toBeGreaterThan(0);
    expect(hard.nodes).toBeGreaterThan(easy.nodes);
  });

  it('finds a next move from a position reached mid-game, which is what hints need', () => {
    const start = board(4, [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []]);
    const afterOne = applyMove(start, moveFor(start, 0, 3));
    const result = solve(afterOne);
    expect(result.solved).toBe(true);
    expect(result.moves.length).toBeGreaterThan(0);
    expect(isSolved(replay(afterOne, result.moves)!)).toBe(true);
  });
});

/**
 * Level 38 eight moves in, as a player reported it: one green token can go back and forth
 * between lanes 4 and 5, and nothing else can move at all. It has a legal move, so it is
 * not stuck in the narrow sense - but it can never be solved.
 */
function shuttleBoard(): GameState {
  const state = board(5, [[4], [0, 3, 2, 5, 3], [0, 4, 2, 0, 3], [1, 3, 1, 0, 0], [1, 4, 4, 2, 2], [5, 3, 4, 2], [1, 1], [5, 5, 5]]);
  state.lanes.forEach((lane, i) => (lane.hidden = [0, 2, 2, 2, 2, 2, 0, 0][i]!));
  return state;
}

describe('dead ends', () => {
  it('calls a board with no legal move a dead end', () => {
    expect(isDeadEnd(board(2, [[0, 1], [1, 0]]))).toBe(true);
  });

  it('calls a board whose only moves shuttle one token back and forth a dead end', () => {
    expect(isDeadEnd(shuttleBoard())).toBe(true);
  });

  it('does not call a solvable board a dead end', () => {
    const start = board(4, [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []]);
    expect(isDeadEnd(start)).toBe(false);
    expect(isDeadEnd(board(4, [[0, 0, 0], [0], []]))).toBe(false);
  });

  it('gives the benefit of the doubt when the board is too big to rule out', () => {
    // Solvable, but not within two positions. Running out of budget proves nothing, so it
    // must never read as stuck - a false alarm would cover a live board with the sheet.
    const start = board(4, [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []]);
    expect(isDeadEnd(start, 2)).toBe(false);
  });

  it('offers no hint on a dead end rather than a pointless shuffle', () => {
    expect(hintMove(shuttleBoard())).toBeNull();
  });
});

describe('solving anchored boards', () => {
  it('never returns a solution that moves an anchor', () => {
    const config = {
      capacity: 3, colorCount: 2,
      lanes: [[0, 1, 1], [1, 0, 0], []],
      hidden: [0, 0, 0],
      anchored: [true, true, false],
    };
    const result = solve(createState(config));
    expect(result.solved).toBe(true);

    const state = createState(config);
    for (const move of result.moves) {
      const lane = state.lanes[move.from]!;
      // An anchor is only ever the source of a move when it is alone in its lane, so this
      // is the exact condition that would mean the search moved one. Asserting the source
      // simply holds more than one token would be wrong: moving the last token out of an
      // UNANCHORED lane is legal and the optimal solution here does it twice.
      expect(lane.anchored && lane.tokens.length === 1).toBe(false);
      applyMoveInPlace(state, move);
    }
    expect(isSolved(state)).toBe(true);
  });

  it('does not let an anchored lane shadow an identical unanchored one', () => {
    // A lone anchor and a lone free token of the same colour look alike token for token,
    // but only one of them can move. The search tries each lane shape once, so if the two
    // shared a shape, whichever came first would stand in for both - and with the anchor
    // first, the one legal move on this board would never be tried. Both lane orders are
    // checked because only one of them exposes the bug.
    for (const anchored of [[true, false, false], [false, true, false]]) {
      const result = solve(
        createState({ capacity: 2, colorCount: 2, lanes: [[0], [0], [1, 1]], hidden: [0, 0, 0], anchored }),
      );
      expect(result.solved, `anchored ${anchored.join(',')}`).toBe(true);
      expect(result.moves, `anchored ${anchored.join(',')}`).toHaveLength(1);
    }
  });

  it('reports an unsolvable anchored board rather than cheating', () => {
    // Both lanes are anchored to Vermilion. Only one lane can hold a colour, so this
    // cannot be solved - and the solver must say so instead of moving an anchor.
    const result = solve(
      createState({
        capacity: 2, colorCount: 2,
        lanes: [[0, 1], [0, 1]],
        hidden: [0, 0],
        anchored: [true, true],
      }),
      { maxNodes: 50_000 },
    );
    expect(result.solved).toBe(false);
  });
});
