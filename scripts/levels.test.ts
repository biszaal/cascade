import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, replay, isSolved, countHidden } from '../src/engine/rules';
import { parFor } from '../src/engine/generator';
import { solve } from '../src/engine/solver';
import type { Level } from '../src/engine/types';

/**
 * Validation of the shipped level packs.
 *
 * The most valuable tests in the suite. The packs are generated once and committed, so a
 * later change to the move rules or the solver would fail no unit test - it would
 * silently invalidate the par of every level and mis-score the whole game. Re-solving
 * each shipped level against the current rules catches that.
 *
 * The pacing tests below encode the authored curve, so a regenerated pack that quietly
 * flattens into "the same level fifty times" fails here rather than in a review.
 */

const here = dirname(fileURLToPath(import.meta.url));
const levelsDir = join(here, '..', 'assets', 'levels');

interface Pack {
  chapter: number;
  name: string;
  color: number;
  levels: Level[];
}

const packs: Pack[] = [1, 2, 3, 4, 5].map(
  (n) => JSON.parse(readFileSync(join(levelsDir, `chapter-${n}.json`), 'utf8')) as Pack,
);
const allLevels = packs.flatMap((pack) => pack.levels);

// The opening level of each chapter - fixed and deterministic, not random. These are the
// smallest, quickest boards a chapter has, which keeps a full solve() cheap; a random or
// exhaustive sample would turn this file from a unit test into a benchmark.
const SOLVE_SAMPLE_IDS = [1, 11, 21, 31, 41];

/** The shape of a board, which is what makes two levels feel alike. */
function shapeOf(level: Level): string {
  const hidden = level.config.hidden.reduce((a, b) => Math.max(a, b), 0);
  return `${level.config.colorCount}c-${level.config.capacity}x-${
    level.config.lanes.filter((l) => l.length === 0).length
  }e-h${hidden}`;
}

describe('level packs', () => {
  it('leaves no stale pack on disk for the app to pick up', () => {
    // Dropping the chapter count once left an orphaned pack behind that the app still
    // loaded - full of levels whose solutions no longer obeyed the rules. The tests read
    // a fixed list, so only this check would have caught it.
    const onDisk = readdirSync(levelsDir)
      .filter((f) => f.startsWith('chapter-') && f.endsWith('.json'))
      .sort();
    expect(onDisk).toEqual(packs.map((p) => `chapter-${p.chapter}.json`).sort());
  });

  it('ships five chapters of ten levels', () => {
    expect(packs).toHaveLength(5);
    for (const pack of packs) expect(pack.levels, pack.name).toHaveLength(10);
  });

  it('numbers levels 1..50 with no gaps or repeats', () => {
    const ids = allLevels.map((l) => l.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('deals every colour exactly capacity times', () => {
    for (const level of allLevels) {
      const counts = new Map<number, number>();
      for (const token of level.config.lanes.flat()) counts.set(token, (counts.get(token) ?? 0) + 1);
      expect(counts.size, `level ${level.id}`).toBe(level.config.colorCount);
      for (const count of counts.values()) expect(count, `level ${level.id}`).toBe(level.config.capacity);
    }
  });

  it('never hides a token that would sit on top of its lane', () => {
    for (const level of allLevels) {
      level.config.lanes.forEach((lane, i) => {
        const hidden = level.config.hidden[i] ?? 0;
        if (lane.length === 0) expect(hidden, `level ${level.id} lane ${i}`).toBe(0);
        else expect(hidden, `level ${level.id} lane ${i}`).toBeLessThanOrEqual(lane.length - 1);
      });
    }
  });

  it('is solvable - every recorded solution replays to a finished board', () => {
    for (const level of allLevels) {
      const final = replay(createState(level.config), level.solution);
      expect(final, `level ${level.id} solution is illegal under the current rules`).not.toBeNull();
      expect(isSolved(final!), `level ${level.id} solution does not finish the board`).toBe(true);
    }
  });

  it('moves exactly one token per move, everywhere', () => {
    for (const level of allLevels) {
      for (const move of level.solution) {
        expect(move.count, `level ${level.id} has a multi-token move`).toBe(1);
      }
    }
  });

  it('records a par consistent with its solution length and hidden count', () => {
    for (const level of allLevels) {
      const hidden = countHidden(createState(level.config));
      expect(level.par, `level ${level.id}`).toBe(parFor(level.solution.length, hidden));
      expect(level.par, `level ${level.id}`).toBeGreaterThanOrEqual(level.solution.length);
    }
  });

  /**
   * Every check above takes the recorded solution as given and checks arithmetic
   * consistency around it - none of them ever calls solve(). Par is the game's entire
   * scoring model, and it was computed at build time by feeding solve() through
   * canonicalKey; a regression there (say, a canonical key that starts collapsing two
   * genuinely different boards) would prune reachable branches and silently reprice a
   * level with no test failing, because nothing re-derives the optimal from scratch. This
   * re-solves a small, fixed sample - one level per chapter - and checks the search still
   * finds the same optimal length that shipped, so a repriced chapter reaches this suite
   * instead of a player. maxNodes is bounded so a regression that makes the search blow up
   * fails fast instead of hanging.
   */
  it('re-solves a fixed sample of shipped levels and finds the same optimal length', () => {
    for (const id of SOLVE_SAMPLE_IDS) {
      const level = allLevels.find((l) => l.id === id)!;
      const result = solve(createState(level.config), { maxNodes: 200_000 });
      expect(result.solved, `level ${level.id} did not solve within budget`).toBe(true);
      expect(
        result.moves.length,
        `level ${level.id} re-solved to a different optimal length than shipped`,
      ).toBe(level.solution.length);
    }
  });
});

describe('the authored curve', () => {
  it('gets harder over the course of the game', () => {
    const averages = packs.map(
      (pack) => pack.levels.reduce((sum, l) => sum + l.difficulty, 0) / pack.levels.length,
    );

    // Deliberately NOT a strict chapter-by-chapter ramp. Undertow opens easier than
    // Rapids closes, because it introduces face-down tokens and a new mechanic has to be
    // taught on a gentle board. Requiring monotonic chapters would forbid exactly the
    // pacing this curve was rebuilt to have.
    for (let i = 2; i < averages.length; i++) {
      expect(
        averages[i],
        `chapter ${i + 1} is not harder than chapter ${i - 1}, so the trend has stalled`,
      ).toBeGreaterThan(averages[i - 2]!);
    }
    expect(averages[averages.length - 1]).toBeGreaterThan(averages[0]! * 2);
  });

  it('raises the peak with every chapter', () => {
    // Averages may dip where a mechanic is introduced, but the ceiling must keep rising -
    // otherwise a later chapter is not actually asking more of the player.
    const peaks = packs.map((pack) => Math.max(...pack.levels.map((l) => l.difficulty)));
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i], `${packs[i]!.name} peaks no higher than ${packs[i - 1]!.name}`).toBeGreaterThan(
        peaks[i - 1]!,
      );
    }
  });

  it('ends every chapter on its hardest board', () => {
    for (const pack of packs) {
      const climax = pack.levels.find((l) => l.beat === 'climax');
      expect(climax, `${pack.name} has no climax`).toBeDefined();
      const hardest = Math.max(...pack.levels.map((l) => l.difficulty));
      expect(climax!.difficulty, `${pack.name}'s climax is not its hardest level`).toBe(hardest);
    }
  });

  it('drops into a genuine breather at every rest', () => {
    // A rest that is not easier than what came before is not a rest - it is just another
    // level, and the sawtooth flattens into the ramp we were trying to avoid.
    for (const pack of packs) {
      pack.levels.forEach((level, i) => {
        if (level.beat !== 'rest' || i === 0) return;
        const previous = pack.levels[i - 1]!;
        expect(
          level.difficulty,
          `${pack.name} ${level.index} is a rest but is not easier than the level before it`,
        ).toBeLessThan(previous.difficulty);
      });
    }
  });

  it('does not ship the same level fifty times', () => {
    // The complaint this curve was rebuilt to fix. Board shape - colours, depth, free
    // lanes, hidden - must actually vary, not just the seed behind it.
    const shapes = new Set(allLevels.map(shapeOf));
    expect(shapes.size, 'not enough distinct board shapes across the game').toBeGreaterThanOrEqual(25);

    for (const pack of packs) {
      const chapterShapes = new Set(pack.levels.map(shapeOf));
      expect(chapterShapes.size, `${pack.name} reuses too few board shapes`).toBeGreaterThanOrEqual(6);
    }
  });

  it('ships the board shape the plan asked for', () => {
    // Reverse-generated boards can drift: the walk fills the free lanes and empties them
    // again, so a level could ship with fewer free lanes than it was designed around.
    for (const level of allLevels) {
      const free = level.config.lanes.filter((l) => l.length === 0).length;
      const planned = level.config.lanes.length - level.config.colorCount;
      expect(free, `level ${level.id} has ${free} free lanes, not the planned ${planned}`).toBe(
        planned,
      );
    }
  });

  it('varies lane depth rather than only adding colours', () => {
    // Capacity changes how a board feels more than a colour does, so every depth the
    // game supports should actually appear.
    const depths = new Set(allLevels.map((l) => l.config.capacity));
    expect([...depths].sort()).toEqual([3, 4, 5]);
  });

  it('opens gently enough to teach the mechanic', () => {
    const opening = packs[0]!.levels.slice(0, 2);
    for (const level of opening) {
      expect(level.config.colorCount, `level ${level.id}`).toBeLessThanOrEqual(3);
      expect(countHidden(createState(level.config)), `level ${level.id}`).toBe(0);
      expect(level.par, `level ${level.id}`).toBeLessThanOrEqual(10);
    }
  });

  it('teaches face-down tokens on an easy board before testing them on a hard one', () => {
    const undertow = packs[3]!;
    const teach = undertow.levels[0]!;
    expect(teach.beat).toBe('teach');
    expect(countHidden(createState(teach.config)), 'the teaching level has nothing hidden').toBeGreaterThan(0);
    // Deliberately fewer colours than the chapter before it, so the new idea is the only
    // new thing on the board.
    expect(teach.config.colorCount).toBeLessThanOrEqual(5);
    expect(teach.difficulty).toBeLessThan(undertow.levels[9]!.difficulty);
  });

  it('keeps face-down tokens out of the first three chapters', () => {
    for (const pack of packs) {
      const hiddenTotal = pack.levels.reduce((sum, l) => sum + countHidden(createState(l.config)), 0);
      if (pack.chapter <= 3) expect(hiddenTotal, pack.name).toBe(0);
      else expect(hiddenTotal, pack.name).toBeGreaterThan(0);
    }
  });

  it('keeps every board inside the nine available token colours', () => {
    for (const level of allLevels) {
      expect(level.config.colorCount, `level ${level.id}`).toBeLessThanOrEqual(9);
    }
  });
});
