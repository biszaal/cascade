import { describe, it, expect } from 'vitest';
import { destinationStates } from './destinations';
import { canMove, createState } from '@/engine/rules';
import type { GameState } from '@/engine/types';

function board(capacity: number, lanes: number[][], hidden?: number[]): GameState {
  return createState({
    capacity,
    colorCount: new Set(lanes.flat()).size,
    lanes: lanes.map((l) => [...l]),
    hidden: hidden ?? lanes.map(() => 0),
  });
}

describe('destination states', () => {
  it('says nothing at all while no token is held', () => {
    const state = board(4, [[0, 0], [1], []]);
    expect(destinationStates(state, null)).toEqual([null, null, null]);
  });

  it('marks the held lane as the source', () => {
    const state = board(4, [[0, 0], [1], []]);
    expect(destinationStates(state, 0)![0]).toBe('source');
  });

  it('offers a lane topped by the same colour', () => {
    const state = board(4, [[1, 0], [0], []]);
    expect(destinationStates(state, 0)[1]).toBe('legal');
  });

  it('refuses a lane topped by another colour', () => {
    const state = board(4, [[1, 0], [2], []]);
    expect(destinationStates(state, 0)[1]).toBe('illegal');
  });

  it('refuses a full lane', () => {
    const state = board(2, [[1, 0], [0, 0], []]);
    expect(destinationStates(state, 0)[1]).toBe('illegal');
  });

  it('returns one entry per lane', () => {
    const state = board(4, [[0, 0], [1], [], [2]]);
    expect(destinationStates(state, 0)).toHaveLength(4);
  });

  it('agrees with canMove for every lane, so the board cannot promise what a tap refuses', () => {
    const state = board(4, [[1, 0], [0], [], [2, 2]]);
    const marks = destinationStates(state, 0);
    state.lanes.forEach((_, index) => {
      if (index === 0) return;
      expect(marks[index] === 'legal').toBe(canMove(state, 0, index));
    });
  });

  it('survives a selection that is out of range', () => {
    const state = board(4, [[0, 0], [1]]);
    expect(destinationStates(state, 9)).toEqual([null, null]);
  });
});
