import { describe, it, expect } from 'vitest';
import { describeLane, describeLaneAction, describeProgress, colorName } from './describe';
import { createState } from '@/engine/rules';
import type { GameState } from '@/engine/types';

function board(capacity: number, lanes: number[][], hidden?: number[]): GameState {
  return createState({
    capacity,
    colorCount: new Set(lanes.flat()).size,
    lanes: lanes.map((l) => [...l]),
    hidden: hidden ?? lanes.map(() => 0),
  });
}

describe('colour names', () => {
  it('names each palette entry', () => {
    expect(colorName(0)).toBe('Vermilion');
    expect(colorName(2)).toBe('Emerald');
  });

  it('wraps rather than returning undefined for an out-of-range id', () => {
    expect(colorName(99)).toBeTruthy();
  });
});

describe('describing a lane', () => {
  it('says a lane is empty', () => {
    expect(describeLane({ tokens: [], hidden: 0, anchored: false }, 3, 4)).toBe('Lane 4, empty');
  });

  it('leads with completion, since that is the goal', () => {
    expect(describeLane({ tokens: [2, 2, 2, 2], hidden: 0, anchored: false }, 0, 4)).toBe(
      'Lane 1, complete, all Emerald',
    );
  });

  it('names the top colour and how full the lane is', () => {
    expect(describeLane({ tokens: [0, 1], hidden: 0, anchored: false }, 1, 4)).toBe(
      'Lane 2, Sky on top, 2 of 4',
    );
  });

  it('mentions a run, because that is how many will move', () => {
    expect(describeLane({ tokens: [0, 1, 1], hidden: 0, anchored: false }, 0, 4)).toContain(
      '2 in a row',
    );
  });

  it('mentions face-down tokens', () => {
    expect(describeLane({ tokens: [0, 1, 2], hidden: 2, anchored: false }, 0, 4)).toContain(
      '2 face down',
    );
  });

  it('does not count face-down tokens into a visible run', () => {
    // All one colour, but the bottom two are face down, so only two are known to match.
    expect(describeLane({ tokens: [0, 0, 0, 0], hidden: 2, anchored: false }, 0, 5)).toContain(
      '2 in a row',
    );
  });

  it('announces an anchored lane so its destiny is audible', () => {
    const lane = { tokens: [1, 0], hidden: 0, anchored: true };
    expect(describeLane(lane, 3, 4)).toContain('Sky anchored at the base');
  });

  it('announces a face-down anchor without naming its colour', () => {
    // With anything face down the anchor is face down too, and a sighted player sees "?".
    const lane = { tokens: [1, 2, 0], hidden: 1, anchored: true };
    const spoken = describeLane(lane, 3, 4);
    expect(spoken).toContain('anchored at the base, colour unknown');
    expect(spoken).not.toContain('Sky');
  });

  it('says nothing about anchors on an ordinary lane', () => {
    const lane = { tokens: [1, 0], hidden: 0, anchored: false };
    expect(describeLane(lane, 3, 4)).not.toContain('anchored');
  });
});

describe('describing what a tap will do', () => {
  it('offers to lift when nothing is held', () => {
    expect(describeLaneAction(board(4, [[0, 1], []]), 0, null)).toBe('Lift Sky');
  });

  it('offers to lift a single token even when a run sits on top', () => {
    // One token moves per move, so the hint must not promise to lift the whole run.
    expect(describeLaneAction(board(4, [[0, 1, 1], []]), 0, null)).toBe('Lift Sky');
  });

  it('offers to put back the lane already held', () => {
    expect(describeLaneAction(board(4, [[0, 1], []]), 0, 0)).toBe('Put back');
  });

  it('offers a matching pour', () => {
    expect(describeLaneAction(board(4, [[0, 1], [1]]), 1, 0)).toBe('Pour Sky here');
  });

  it('explains a colour mismatch rather than staying silent', () => {
    expect(describeLaneAction(board(4, [[1], [0]]), 1, 0)).toBe('Cannot pour Sky onto Vermilion');
  });

  it('explains a full lane', () => {
    expect(describeLaneAction(board(4, [[0], [1, 1, 1, 1]]), 1, 0)).toContain('Full');
  });

  it('names an empty destination', () => {
    expect(describeLaneAction(board(4, [[0, 1], []]), 1, 0)).toBe('Pour Sky into the empty lane');
  });

  it('says a lone anchor cannot be lifted rather than offering to lift it', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0], [1, 1]], hidden: [0, 0], anchored: [true, false],
    });
    expect(describeLaneAction(state, 0, null)).toBe('Anchored, nothing can be lifted');
  });

  it('says nothing can be lifted from an empty lane', () => {
    expect(describeLaneAction(board(4, [[0], []]), 1, null)).toBe('Empty, nothing to lift');
  });
});

describe('describing progress', () => {
  it('states par before any move is made', () => {
    expect(describeProgress(0, 20)).toBe('No moves yet. Par is 20.');
  });

  it('reports being under par', () => {
    expect(describeProgress(18, 20)).toBe('18 moves, 2 under par.');
  });

  it('says "1 move", not "1 moves" - a screen reader speaks this', () => {
    expect(describeProgress(1, 20)).toBe('1 move, 19 under par.');
  });

  it('reports hitting par exactly', () => {
    expect(describeProgress(20, 20)).toBe('20 moves, exactly par.');
  });

  it('reports being over par', () => {
    expect(describeProgress(25, 20)).toBe('25 moves, 5 over par.');
  });
});
