import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, replay, isSolved, countHidden } from '../src/engine/rules';
import { parFor } from '../src/engine/generator';
import type { Level } from '../src/engine/types';

/**
 * Validation of the shipped level packs.
 *
 * This is the most valuable test in the suite. The packs are generated once and committed,
 * so a later change to the pour rules or the solver would not fail any unit test - it
 * would silently invalidate the par of all 180 levels and mis-score the entire game.
 * Re-solving every shipped level against the current rules is what catches that.
 */

const here = dirname(fileURLToPath(import.meta.url));
const levelsDir = join(here, '..', 'assets', 'levels');

interface Pack {
  chapter: number;
  name: string;
  color: number;
  levels: Level[];
}

const packs: Pack[] = [1, 2, 3, 4, 5, 6].map(
  (n) => JSON.parse(readFileSync(join(levelsDir, `chapter-${n}.json`), 'utf8')) as Pack,
);
const allLevels = packs.flatMap((pack) => pack.levels);

describe('level packs', () => {
  it('ships six chapters of thirty levels', () => {
    expect(packs).toHaveLength(6);
    for (const pack of packs) expect(pack.levels).toHaveLength(30);
  });

  it('numbers levels 1..180 with no gaps or repeats', () => {
    const ids = allLevels.map((l) => l.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 180 }, (_, i) => i + 1));
  });

  it('deals every colour exactly capacity times in every level', () => {
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
      const state = createState(level.config);
      const final = replay(state, level.solution);
      expect(final, `level ${level.id} solution is not legal under the current rules`).not.toBeNull();
      expect(isSolved(final!), `level ${level.id} solution does not finish the board`).toBe(true);
    }
  });

  it('records a par consistent with its solution length and hidden count', () => {
    for (const level of allLevels) {
      const hidden = countHidden(createState(level.config));
      expect(level.par, `level ${level.id}`).toBe(parFor(level.solution.length, hidden));
      expect(level.par, `level ${level.id}`).toBeGreaterThanOrEqual(level.solution.length);
    }
  });

  it('gets harder from chapter to chapter', () => {
    const averages = packs.map(
      (pack) => pack.levels.reduce((sum, l) => sum + l.difficulty, 0) / pack.levels.length,
    );
    for (let i = 1; i < averages.length; i++) {
      expect(averages[i], `chapter ${i + 1} is not harder than chapter ${i}`).toBeGreaterThan(
        averages[i - 1]!,
      );
    }
  });

  it('gets harder within each chapter', () => {
    for (const pack of packs) {
      const first = pack.levels.slice(0, 5).reduce((s, l) => s + l.difficulty, 0) / 5;
      const last = pack.levels.slice(-5).reduce((s, l) => s + l.difficulty, 0) / 5;
      expect(last, `${pack.name} does not ramp`).toBeGreaterThan(first);
    }
  });

  it('opens with levels gentle enough to teach the mechanic', () => {
    const opening = packs[0]!.levels.slice(0, 3);
    for (const level of opening) {
      expect(level.config.colorCount, `level ${level.id}`).toBeLessThanOrEqual(3);
      expect(countHidden(createState(level.config)), `level ${level.id}`).toBe(0);
      expect(level.par, `level ${level.id}`).toBeLessThanOrEqual(14);
    }
  });

  it('introduces face-down tokens only from chapter four', () => {
    for (const pack of packs) {
      const hiddenTotal = pack.levels.reduce((sum, l) => sum + countHidden(createState(l.config)), 0);
      if (pack.chapter <= 3) expect(hiddenTotal, `${pack.name}`).toBe(0);
      else expect(hiddenTotal, `${pack.name}`).toBeGreaterThan(0);
    }
  });

  it('keeps every board inside the nine available token colours', () => {
    for (const level of allLevels) {
      expect(level.config.colorCount, `level ${level.id}`).toBeLessThanOrEqual(9);
    }
  });
});
