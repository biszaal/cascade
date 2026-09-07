import { describe, it, expect } from 'vitest';
import {
  dealBoard,
  tryCandidate,
  buildPool,
  pickByPercentile,
  scoreDifficulty,
  parFor,
} from './generator';
import type { GenerationSpec } from './generator';
import { createState, replay, isSolved, countHidden } from './rules';

const easy: GenerationSpec = {
  capacity: 4,
  colorCount: 4,
  emptyLanes: 2,
  hiddenMin: 0,
  hiddenMax: 0,
};

const blind: GenerationSpec = { ...easy, colorCount: 5, hiddenMin: 1, hiddenMax: 2 };

describe('dealBoard', () => {
  it('deals every colour exactly capacity times', () => {
    const config = dealBoard(1, easy);
    const counts = new Map<number, number>();
    for (const token of config.lanes.flat()) counts.set(token, (counts.get(token) ?? 0) + 1);
    expect(counts.size).toBe(easy.colorCount);
    for (const count of counts.values()) expect(count).toBe(easy.capacity);
  });

  it('adds the requested number of empty lanes', () => {
    const config = dealBoard(1, easy);
    expect(config.lanes.filter((l) => l.length === 0)).toHaveLength(easy.emptyLanes);
    expect(config.lanes).toHaveLength(easy.colorCount + easy.emptyLanes);
  });

  it('is deterministic - the same seed gives the same board', () => {
    expect(JSON.stringify(dealBoard(42, easy))).toBe(JSON.stringify(dealBoard(42, easy)));
  });

  it('gives different seeds different boards', () => {
    expect(JSON.stringify(dealBoard(1, easy))).not.toBe(JSON.stringify(dealBoard(2, easy)));
  });

  it('never hides so many tokens that the top would be face-down', () => {
    const config = dealBoard(3, { ...blind, hiddenMin: 9, hiddenMax: 9 });
    config.lanes.forEach((lane, i) => {
      if (lane.length === 0) expect(config.hidden[i]).toBe(0);
      else expect(config.hidden[i]).toBeLessThanOrEqual(config.capacity - 1);
    });
  });

  it('leaves empty lanes with nothing hidden', () => {
    const config = dealBoard(5, blind);
    config.lanes.forEach((lane, i) => {
      if (lane.length === 0) expect(config.hidden[i]).toBe(0);
    });
  });
});

describe('par', () => {
  it('equals the optimal move count when nothing is hidden', () => {
    expect(parFor(24, 0)).toBe(24);
  });

  it('grants extra moves to pay for discovering face-down tokens', () => {
    expect(parFor(24, 5)).toBeGreaterThan(24);
  });
});

describe('difficulty scoring', () => {
  it('rises with search effort', () => {
    const base = { optimal: 20, colorCount: 6, emptyLanes: 2, hiddenCount: 0 };
    expect(scoreDifficulty({ ...base, nodes: 50_000 })).toBeGreaterThan(
      scoreDifficulty({ ...base, nodes: 500 }),
    );
  });

  it('falls when the player is given another free lane', () => {
    const base = { nodes: 5000, optimal: 20, colorCount: 6, hiddenCount: 0 };
    expect(scoreDifficulty({ ...base, emptyLanes: 3 })).toBeLessThan(
      scoreDifficulty({ ...base, emptyLanes: 1 }),
    );
  });

  it('rises when tokens are face-down', () => {
    const base = { nodes: 5000, optimal: 20, colorCount: 6, emptyLanes: 2 };
    expect(scoreDifficulty({ ...base, hiddenCount: 8 })).toBeGreaterThan(
      scoreDifficulty({ ...base, hiddenCount: 0 }),
    );
  });
});

describe('candidates', () => {
  it('produces a board whose recorded solution really solves it', () => {
    const candidate = tryCandidate(12345, easy);
    expect(candidate).not.toBeNull();
    const state = createState(candidate!.config);
    const final = replay(state, candidate!.solution);
    expect(final).not.toBeNull();
    expect(isSolved(final!)).toBe(true);
  });

  it('records par at or above the optimal move count', () => {
    const candidate = tryCandidate(777, blind)!;
    expect(candidate.par).toBeGreaterThanOrEqual(candidate.optimal);
    expect(candidate.par).toBe(parFor(candidate.optimal, countHidden(createState(candidate.config))));
  });

  it('holds up on boards with face-down tokens', () => {
    const candidate = tryCandidate(555, blind);
    expect(candidate).not.toBeNull();
    const state = createState(candidate!.config);
    expect(countHidden(state)).toBeGreaterThan(0);
    expect(isSolved(replay(state, candidate!.solution)!)).toBe(true);
  });
});

describe('pool ranking', () => {
  it('returns a pool sorted from easiest to hardest', () => {
    const pool = buildPool(1000, easy, 8);
    expect(pool.length).toBeGreaterThan(4);
    for (let i = 1; i < pool.length; i++) {
      expect(pool[i]!.difficulty).toBeGreaterThanOrEqual(pool[i - 1]!.difficulty);
    }
  });

  it('picks harder boards at higher percentiles, which is the difficulty ramp', () => {
    const pool = buildPool(2000, easy, 10);
    const first = pickByPercentile(pool, 0)!;
    const last = pickByPercentile(pool, 1)!;
    expect(last.difficulty).toBeGreaterThanOrEqual(first.difficulty);
  });

  it('returns null rather than throwing on an empty pool', () => {
    expect(pickByPercentile([], 0.5)).toBeNull();
  });
});
