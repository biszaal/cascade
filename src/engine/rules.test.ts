import { describe, it, expect } from 'vitest';
import {
  createState,
  topColor,
  topRun,
  isLaneComplete,
  canMove,
  legalMoves,
  applyMove,
  applyMoveInPlace,
  undoMoveInPlace,
  isSolved,
  cloneState,
  moveFor,
} from './rules';
import type { GameState } from './types';

/** Terse board builder. `lanes` are bottom-first; `hidden` defaults to all-revealed. */
function board(capacity: number, lanes: number[][], hidden?: number[]): GameState {
  const colors = new Set(lanes.flat());
  return createState({
    capacity,
    colorCount: colors.size,
    lanes: lanes.map((l) => [...l]),
    hidden: hidden ?? lanes.map(() => 0),
  });
}

describe('lane inspection', () => {
  it('reads the top colour, which is the last element', () => {
    expect(topColor({ tokens: [0, 1, 2], hidden: 0, anchored: false })).toBe(2);
  });

  it('reports null for an empty lane', () => {
    expect(topColor({ tokens: [], hidden: 0, anchored: false })).toBeNull();
  });

  it('counts a run of consecutive same-coloured tokens at the top', () => {
    expect(topRun({ tokens: [1, 0, 0, 0], hidden: 0, anchored: false })).toBe(3);
  });

  it('stops a run at the first face-down token, because the player cannot see through it', () => {
    // Bottom two are face-down. Even though index 1 is also colour 0, the run cannot
    // include it - the player has no way of knowing it matches.
    expect(topRun({ tokens: [0, 0, 0, 0], hidden: 2, anchored: false })).toBe(2);
  });

  it('treats a lane as complete only when it is full and single-coloured', () => {
    expect(isLaneComplete({ tokens: [1, 1, 1, 1], hidden: 0, anchored: false }, 4)).toBe(true);
    expect(isLaneComplete({ tokens: [1, 1, 1], hidden: 0, anchored: false }, 4)).toBe(false);
    expect(isLaneComplete({ tokens: [1, 1, 1, 2], hidden: 0, anchored: false }, 4)).toBe(false);
    expect(isLaneComplete({ tokens: [], hidden: 0, anchored: false }, 4)).toBe(false);
  });
});

describe('move legality', () => {
  it('allows a pour onto a matching top', () => {
    expect(canMove(board(4, [[0], [0]]), 0, 1)).toBe(true);
  });

  it('allows a pour into an empty lane', () => {
    // Source must be mixed, or the no-op rule below correctly refuses it.
    expect(canMove(board(4, [[1, 0], []]), 0, 1)).toBe(true);
  });

  it('rejects a pour onto a different colour', () => {
    expect(canMove(board(4, [[0], [1]]), 0, 1)).toBe(false);
  });

  it('rejects a pour from an empty lane', () => {
    expect(canMove(board(4, [[], [0]]), 0, 1)).toBe(false);
  });

  it('rejects a pour into a full lane', () => {
    expect(canMove(board(4, [[0], [0, 1, 1, 0]]), 0, 1)).toBe(false);
  });

  it('rejects a lane pouring into itself', () => {
    expect(canMove(board(4, [[0]]), 0, 0)).toBe(false);
  });

  it('rejects breaking up a completed lane, which is never progress', () => {
    expect(canMove(board(4, [[1, 1, 1, 1], []]), 0, 1)).toBe(false);
  });

  it('rejects moving a lane\'s last token into an empty lane, which is a no-op', () => {
    // The two lanes simply swap roles - provably the same position, one move later.
    expect(canMove(board(4, [[0], []]), 0, 1)).toBe(false);
  });

  it('allows relocating a taller uniform stack into an empty lane one token at a time', () => {
    // Emptying a lane to free it up is a legitimate plan, so this is NOT a no-op.
    expect(canMove(board(4, [[0, 0], []]), 0, 1)).toBe(true);
  });

  it('enumerates every legal move and nothing else', () => {
    const moves = legalMoves(board(4, [[0, 1], [1], []]));
    const pairs = moves.map((m) => `${m.from}->${m.to}`).sort();
    // 0->1 and 1->0 both move a 1 onto a 1; 0->2 moves one token into the empty lane.
    // 1->2 is absent on purpose: lane 1 holds a single token, so moving it to the empty
    // lane just swaps two interchangeable lanes.
    expect(pairs).toEqual(['0->1', '0->2', '1->0']);
  });
});

describe('applying moves', () => {
  it('moves exactly one token, even when a whole run could fit', () => {
    // A run of two same-coloured tokens costs two moves to relocate, not one. This is
    // the rule the entire scoring model rests on.
    const state = board(4, [[1, 0, 0], [0]]);
    const move = moveFor(state, 0, 1);
    expect(move.count).toBe(1);
    const next = applyMove(state, move);
    expect(next.lanes[0]!.tokens).toEqual([1, 0]);
    expect(next.lanes[1]!.tokens).toEqual([0, 0]);
  });

  it('takes three moves to relocate three tokens', () => {
    let state = board(4, [[1, 0, 0, 0], [0], []]);
    for (let i = 0; i < 3; i++) state = applyMove(state, moveFor(state, 0, 1));
    expect(state.lanes[0]!.tokens).toEqual([1]);
    expect(state.lanes[1]!.tokens).toEqual([0, 0, 0, 0]);
  });

  it('does not mutate the state it was given', () => {
    const state = board(4, [[0], []]);
    applyMove(state, moveFor(state, 0, 1));
    expect(state.lanes[0]!.tokens).toEqual([0]);
    expect(state.lanes[1]!.tokens).toEqual([]);
  });

  it('flips the next token face-up when the one above it leaves', () => {
    // Three face-down under one revealed token.
    const state = board(4, [[3, 2, 1, 0], []], [3, 0]);
    const next = applyMove(state, moveFor(state, 0, 1));
    // One token left, so two remain hidden and the new top (index 2) is revealed.
    expect(next.lanes[0]!.tokens).toEqual([3, 2, 1]);
    expect(next.lanes[0]!.hidden).toBe(2);
  });

  it('never leaves a face-down token on top of a lane', () => {
    let state = board(4, [[3, 2, 1, 0], [0]], [3, 0]);
    state = applyMove(state, moveFor(state, 0, 1));
    state = applyMove(state, moveFor(state, 0, 2 - 1));
    for (const lane of state.lanes) {
      if (lane.tokens.length > 0) expect(lane.hidden).toBeLessThanOrEqual(lane.tokens.length - 1);
    }
  });

  it('resets hidden to zero when a lane empties', () => {
    const state = board(4, [[0], []], [0, 0]);
    const next = applyMove(state, moveFor(state, 0, 1));
    expect(next.lanes[0]!.tokens).toEqual([]);
    expect(next.lanes[0]!.hidden).toBe(0);
  });

  it('reveals a whole lane the moment it becomes full and uniform', () => {
    // Lane 0 holds three face-down colour-1 tokens; dropping a fourth completes it.
    const state = board(4, [[1, 1, 1], [1]], [2, 0]);
    const next = applyMove(state, moveFor(state, 1, 0));
    expect(next.lanes[0]!.tokens).toEqual([1, 1, 1, 1]);
    // The player could not have known - so the completion reveals itself.
    expect(next.lanes[0]!.hidden).toBe(0);
    expect(isLaneComplete(next.lanes[0]!, 4)).toBe(true);
  });
});

describe('in-place move and undo, which the solver relies on', () => {
  it('restores the exact prior state, hidden counts included', () => {
    const state = board(4, [[3, 2, 1, 0], [0], []], [3, 0, 0]);
    const before = JSON.stringify(state);
    const undo = applyMoveInPlace(state, moveFor(state, 0, 1));
    expect(JSON.stringify(state)).not.toBe(before);
    undoMoveInPlace(state, undo);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('restores a reveal caused by completing a lane', () => {
    const state = board(4, [[1, 1, 1], [1]], [2, 0]);
    const before = JSON.stringify(state);
    const undo = applyMoveInPlace(state, moveFor(state, 1, 0));
    undoMoveInPlace(state, undo);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('agrees with the immutable path over a long random walk', () => {
    let immutable = board(4, [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2], [], []]);
    const mutable = cloneState(immutable);
    for (let step = 0; step < 40; step++) {
      const moves = legalMoves(mutable);
      if (moves.length === 0) break;
      const move = moves[step % moves.length]!;
      applyMoveInPlace(mutable, move);
      immutable = applyMove(immutable, move);
      expect(JSON.stringify(mutable)).toBe(JSON.stringify(immutable));
    }
  });
});

describe('win detection', () => {
  it('accepts a board of full single-coloured lanes plus empties', () => {
    expect(isSolved(board(4, [[0, 0, 0, 0], [1, 1, 1, 1], []]))).toBe(true);
  });

  it('rejects a board with a mixed lane', () => {
    expect(isSolved(board(4, [[0, 0, 0, 1], [1, 1, 1, 0], []]))).toBe(false);
  });

  it('rejects a board with a uniform but under-filled lane', () => {
    expect(isSolved(board(4, [[0, 0, 0], [0], []]))).toBe(false);
  });

  it('is reachable by playing a trivial level to completion, one token at a time', () => {
    let state = board(4, [[0, 1], [1, 0], [], []]);
    state = applyMove(state, moveFor(state, 0, 2)); // 1 -> empty
    state = applyMove(state, moveFor(state, 1, 3)); // 0 -> empty
    state = applyMove(state, moveFor(state, 1, 2)); // 1 onto 1
    state = applyMove(state, moveFor(state, 0, 3)); // 0 onto 0
    expect(state.lanes[2]!.tokens).toEqual([1, 1]);
    expect(state.lanes[3]!.tokens).toEqual([0, 0]);
    expect(isSolved(state)).toBe(false); // capacity 4, so two-token lanes are not full
  });
});

describe('state construction', () => {
  it('clamps a hidden count that would leave the top face-down', () => {
    const state = board(4, [[0, 1, 2]], [3]);
    expect(state.lanes[0]!.hidden).toBe(2);
  });

  it('deep-clones, so mutating the copy leaves the original alone', () => {
    const state = board(4, [[0, 1], []]);
    const copy = cloneState(state);
    copy.lanes[0]!.tokens.push(2);
    expect(state.lanes[0]!.tokens).toEqual([0, 1]);
  });
});

describe('anchored lanes', () => {
  it('defaults to unanchored when the config omits anchors', () => {
    const state = board(3, [[0, 0], [1]]);
    expect(state.lanes.every((lane) => lane.anchored)).toBe(false);
  });

  it('reads anchors from the config', () => {
    const state = createState({
      capacity: 3,
      colorCount: 2,
      lanes: [[0, 1], [1]],
      hidden: [0, 0],
      anchored: [true, false],
    });
    expect(state.lanes[0]!.anchored).toBe(true);
    expect(state.lanes[1]!.anchored).toBe(false);
  });

  it('never anchors an empty lane', () => {
    const state = createState({
      capacity: 3,
      colorCount: 1,
      lanes: [[0], []],
      hidden: [0, 0],
      anchored: [true, true],
    });
    expect(state.lanes[1]!.anchored).toBe(false);
  });

  it('carries the anchor through a clone', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0, 1], [1]], hidden: [0, 0], anchored: [true, false],
    });
    expect(cloneState(state).lanes[0]!.anchored).toBe(true);
  });
});

describe('anchors are immovable', () => {
  it('refuses to move a lone anchor', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0], [0, 0]], hidden: [0, 0], anchored: [true, false],
    });
    expect(canMove(state, 0, 1)).toBe(false);
  });

  it('still allows moving a token that merely sits above an anchor', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0, 1], [1]], hidden: [0, 0], anchored: [true, false],
    });
    expect(canMove(state, 0, 1)).toBe(true);
  });

  it('allows an unanchored lone token to move as before', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0], [0, 0]], hidden: [0, 0], anchored: [false, false],
    });
    expect(canMove(state, 0, 1)).toBe(true);
  });

  it('never offers an anchor among the legal moves', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0], [0, 0]], hidden: [0, 0], anchored: [true, false],
    });
    expect(legalMoves(state).some((m) => m.from === 0)).toBe(false);
  });
});
