import { describe, it, expect } from 'vitest';
import { solve, heuristic, canonicalKey } from './solver';
import { createState, replay, isSolved, applyMove, moveFor } from './rules';
import { mulberry32, shuffle } from './rng';
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
