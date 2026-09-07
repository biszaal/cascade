import { describe, it, expect } from 'vitest';
import { computeGeometry, lanePosition, slotPosition, rowsFor, MIN_TOKEN, MAX_TOKEN } from './layout';

describe('row wrapping', () => {
  it('keeps five or fewer lanes on one row', () => {
    expect(rowsFor(5)).toEqual({ rows: 1, perRow: 5 });
  });

  it('splits more than five lanes across two balanced rows', () => {
    expect(rowsFor(11)).toEqual({ rows: 2, perRow: 6 });
    expect(rowsFor(6)).toEqual({ rows: 2, perRow: 3 });
  });
});

describe('geometry', () => {
  it('fits the widest supported board inside a small phone without overflowing', () => {
    // 11 lanes of 5 on a 320pt-wide screen is the tightest case the game can produce.
    const g = computeGeometry(11, 5, 320, 520);
    expect(g.boardWidth).toBeLessThanOrEqual(320);
    expect(g.boardHeight).toBeLessThanOrEqual(520);
  });

  it('never shrinks a token below a tappable size', () => {
    const g = computeGeometry(11, 5, 200, 200);
    expect(g.tokenSize).toBeGreaterThanOrEqual(MIN_TOKEN);
  });

  it('does not blow tokens up on a tablet', () => {
    const g = computeGeometry(4, 4, 1000, 900);
    expect(g.tokenSize).toBeLessThanOrEqual(MAX_TOKEN);
  });

  it('grows the board when there is more room', () => {
    const small = computeGeometry(6, 4, 320, 400);
    const large = computeGeometry(6, 4, 500, 700);
    expect(large.tokenSize).toBeGreaterThanOrEqual(small.tokenSize);
  });
});

describe('positions', () => {
  it('lays lanes out left to right on the first row', () => {
    const g = computeGeometry(4, 4, 360, 500);
    expect(lanePosition(g, 1, 4).x).toBeGreaterThan(lanePosition(g, 0, 4).x);
    expect(lanePosition(g, 1, 4).y).toBe(lanePosition(g, 0, 4).y);
  });

  it('drops onto a second row once the first is full', () => {
    const g = computeGeometry(8, 4, 360, 500);
    expect(lanePosition(g, 4, 8).y).toBeGreaterThan(lanePosition(g, 0, 8).y);
  });

  it('centres a short final row instead of leaving it hanging left', () => {
    // 11 lanes: six on top, five below - so the bottom row must be nudged inward.
    const g = computeGeometry(11, 4, 360, 500);
    expect(lanePosition(g, 6, 11).x).toBeGreaterThan(lanePosition(g, 0, 11).x);
  });

  it('stacks slot 0 at the bottom, matching the engine array order', () => {
    const g = computeGeometry(4, 4, 360, 500);
    const bottom = slotPosition(g, 0, 0, 4, 4);
    const top = slotPosition(g, 0, 3, 4, 4);
    expect(bottom.y).toBeGreaterThan(top.y);
  });

  it('keeps every slot inside its lane', () => {
    const g = computeGeometry(6, 4, 360, 500);
    for (let slot = 0; slot < 4; slot++) {
      const pos = slotPosition(g, 0, slot, 4, 6);
      const lane = lanePosition(g, 0, 6);
      expect(pos.y).toBeGreaterThanOrEqual(lane.y);
      expect(pos.y + g.tokenSize).toBeLessThanOrEqual(lane.y + g.laneHeight + 0.01);
    }
  });
});
