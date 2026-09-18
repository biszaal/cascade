import { describe, it, expect } from 'vitest';
import {
  RECORDS,
  describeRecord,
  earnedIds,
  isEarned,
  type ProgressSnapshot,
  type RecordChapter,
} from './achievements';

/** Twenty ten-level chapters, with fog and anchors where the shipped curve puts them. */
const chapters: RecordChapter[] = Array.from({ length: 20 }, (_, i) => {
  const chapter = i + 1;
  return {
    chapter,
    name: `Chapter ${chapter}`,
    firstLevelId: i * 10 + 1,
    levelCount: 10,
    hasFog: [4, 5].includes(chapter) || chapter >= 8,
    hasAnchors: chapter >= 6,
  };
});

const TOTAL = 200;

function snapshot(results: Record<number, { stars: number }> = {}, dailyBest = 0): ProgressSnapshot {
  return { results, totalLevels: TOTAL, chapters, dailyBest };
}

/** Every level at `stars`, which is the only snapshot that should earn everything. */
function everything(stars: number, dailyBest: number): ProgressSnapshot {
  const results: Record<number, { stars: number }> = {};
  for (let id = 1; id <= TOTAL; id++) results[id] = { stars };
  return snapshot(results, dailyBest);
}

const record = (id: string) => {
  const found = RECORDS.find((r) => r.id === id);
  if (!found) throw new Error(`no record ${id}`);
  return found;
};

describe('the set itself', () => {
  it('has no duplicate ids', () => {
    expect(new Set(RECORDS.map((r) => r.id)).size).toBe(RECORDS.length);
  });

  it('earns nothing on a fresh save', () => {
    expect(earnedIds(snapshot())).toEqual([]);
  });

  it('earns everything on a maximal save', () => {
    // The check that matters most: it catches a record that can never be earned at all.
    expect(earnedIds(everything(3, 30))).toEqual(RECORDS.map((r) => r.id));
  });

  it('keeps progress inside 0..1 at both ends', () => {
    for (const r of RECORDS) {
      expect(r.progress(snapshot())).toBeGreaterThanOrEqual(0);
      expect(r.progress(snapshot())).toBeLessThanOrEqual(1);
      expect(r.progress(everything(3, 365))).toBe(1);
    }
  });
});

describe('solving', () => {
  it('counts a first solve', () => {
    expect(isEarned(record('first-pour'), snapshot())).toBe(false);
    expect(isEarned(record('first-pour'), snapshot({ 1: { stars: 1 } }))).toBe(true);
  });

  it('counts a chapter only when every level in it is solved', () => {
    const nine: Record<number, { stars: number }> = {};
    for (let id = 1; id <= 9; id++) nine[id] = { stars: 1 };
    expect(isEarned(record('chapter-done'), snapshot(nine))).toBe(false);
    expect(isEarned(record('chapter-done'), snapshot({ ...nine, 10: { stars: 1 } }))).toBe(true);
  });
});

describe('par', () => {
  it('wants three stars, not a solve', () => {
    expect(isEarned(record('on-par'), snapshot({ 1: { stars: 2 } }))).toBe(false);
    expect(isEarned(record('on-par'), snapshot({ 1: { stars: 3 } }))).toBe(true);
  });

  it('needs every level in a chapter at par for a perfect chapter', () => {
    const chapter: Record<number, { stars: number }> = {};
    for (let id = 1; id <= 10; id++) chapter[id] = { stars: 3 };
    expect(isEarned(record('perfect-chapter'), snapshot(chapter))).toBe(true);
    expect(isEarned(record('perfect-chapter'), snapshot({ ...chapter, 5: { stars: 2 } }))).toBe(false);
  });
});

describe('mechanics', () => {
  it('reads face-down tokens from a fogged chapter, and not from a clear one', () => {
    expect(isEarned(record('into-the-dark'), snapshot({ 1: { stars: 3 } }))).toBe(false);
    expect(isEarned(record('into-the-dark'), snapshot({ 61: { stars: 3 } }))).toBe(false); // ch 7, no fog
    expect(isEarned(record('into-the-dark'), snapshot({ 31: { stars: 1 } }))).toBe(true); // ch 4
  });

  it('reads anchors from an anchored chapter only', () => {
    expect(isEarned(record('hold-fast'), snapshot({ 31: { stars: 3 } }))).toBe(false); // ch 4
    expect(isEarned(record('hold-fast'), snapshot({ 51: { stars: 1 } }))).toBe(true); // ch 6
  });
});

describe('gates', () => {
  it('is exactly the tenth level of chapters 11 to 20', () => {
    const gates = [110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
    const all: Record<number, { stars: number }> = {};
    for (const id of gates) all[id] = { stars: 1 };
    expect(isEarned(record('gatekeeper'), snapshot(all))).toBe(true);
    expect(record('gatekeeper').tally?.(snapshot(all))).toBe('10 of 10 gates');

    const missingOne = { ...all };
    delete missingOne[200];
    expect(isEarned(record('gatekeeper'), snapshot(missingOne))).toBe(false);
  });

  it('does not count an early chapter\'s tenth level', () => {
    expect(record('gatekeeper').tally?.(snapshot({ 100: { stars: 3 } }))).toBe('0 of 10 gates');
  });
});

describe('daily', () => {
  it('reads the best run, so a lapsed streak keeps what it earned', () => {
    expect(isEarned(record('seven-in-a-row'), snapshot({}, 6))).toBe(false);
    expect(isEarned(record('seven-in-a-row'), snapshot({}, 7))).toBe(true);
    expect(isEarned(record('seven-in-a-row'), snapshot({}, 8))).toBe(true);
  });

  it('caps the tally at the target', () => {
    expect(record('seven-in-a-row').tally?.(snapshot({}, 99))).toBe('7 of 7 days');
  });
});

describe('describeRecord', () => {
  it('says the state, the goal and the count', () => {
    expect(describeRecord(record('every-board'), snapshot({ 1: { stars: 1 } }))).toBe(
      'Every board, not yet earned. Solve every level in the game. 1 of 200 levels.',
    );
  });

  it('leaves the count out where there is none to give', () => {
    expect(describeRecord(record('first-pour'), snapshot({ 1: { stars: 1 } }))).toBe(
      'First pour, earned. Solve your first level.',
    );
  });
});
