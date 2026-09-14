import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTERS } from './level-plan';
import { FORGE_START, LIGHT_START, POOL_SEED_STEP, attemptsFor, maxNodesFor, poolSizeFor, seedFor } from './level-budget';
import type { Level } from '../src/engine/types';

/**
 * The search budget and seeds behind every level.
 *
 * A shipped level is only reproducible if the numbers that built it never change, and
 * nothing else in the suite would notice if they did: the packs are already on disk, so
 * a repriced budget fails no pack test until someone regenerates and ships different
 * boards under the same level numbers.
 */

const here = dirname(fileURLToPath(import.meta.url));
const levelsDir = join(here, '..', 'assets', 'levels');

describe('level budgets', () => {
  it('still reproduces the first seed of every shipped level in chapters 1 to 10', () => {
    // buildPool records the seed of the candidate it keeps, and every candidate's seed is
    // the level's first seed plus a whole number of 7919 steps no larger than its budget.
    // So a changed formula for chapters 1-10 cannot keep every shipped seed inside its
    // level's range.
    for (const chapter of CHAPTERS.filter((c) => c.n < FORGE_START)) {
      const pack = JSON.parse(readFileSync(join(levelsDir, `chapter-${chapter.n}.json`), 'utf8')) as {
        levels: Level[];
      };
      for (const plan of chapter.levels) {
        const level = pack.levels.find((l) => l.index === plan.n)!;
        const offset = level.seed - seedFor(chapter.n, plan.n);
        const attempts = attemptsFor(chapter.n, plan) ?? poolSizeFor(chapter.n, plan) * 12;
        expect(offset % POOL_SEED_STEP, `${chapter.name} ${plan.n}`).toBe(0);
        expect(offset / POOL_SEED_STEP, `${chapter.name} ${plan.n}`).toBeGreaterThanOrEqual(0);
        expect(offset / POOL_SEED_STEP, `${chapter.name} ${plan.n}`).toBeLessThan(attempts);
      }
    }
  });

  it('keeps the budgets chapters 1 to 10 were generated with', () => {
    for (const chapter of CHAPTERS.filter((c) => c.n < FORGE_START)) {
      for (const plan of chapter.levels) {
        const work = plan.spec.colorCount * plan.spec.capacity;
        const pool = work <= 20 ? 14 : work <= 32 ? 10 : work <= 40 ? 7 : 5;
        expect(poolSizeFor(chapter.n, plan), `${chapter.name} ${plan.n}`).toBe(pool);
        expect(maxNodesFor(chapter.n, plan), `${chapter.name} ${plan.n}`).toBe(work <= 32 ? 600_000 : 2_000_000);
        expect(attemptsFor(chapter.n, plan), `${chapter.name} ${plan.n}`).toBe(
          plan.spec.anchors ? pool * 200 : undefined,
        );
      }
    }
  });

  it('gives the forge and light gates wider pools than the rest of their chapters', () => {
    for (const chapter of CHAPTERS.filter((c) => c.n >= FORGE_START)) {
      for (const plan of chapter.levels) {
        const gate = chapter.n >= LIGHT_START ? 48 : 24;
        expect(poolSizeFor(chapter.n, plan)).toBe(plan.beat === 'climax' ? gate : 16);
        expect(maxNodesFor(chapter.n, plan)).toBe(8_000_000);
      }
    }
  });

  it('never lets one level search seeds another level owns', () => {
    // Every level's pool walks POOL_SEED_STEP at a time for at most its attempt budget.
    // If two of those ranges overlap, neighbouring levels with the same spec rank the same
    // seeds and can ship the same board twice - which chapters 6-10 once did.
    const ranges = CHAPTERS.filter((c) => c.n >= 6).flatMap((chapter) =>
      chapter.levels.map((plan) => {
        const start = seedFor(chapter.n, plan.n);
        return { name: `${chapter.name} ${plan.n}`, start, end: start + attemptsFor(chapter.n, plan)! * POOL_SEED_STEP };
      }),
    );
    ranges.sort((a, b) => a.start - b.start);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]!.start, `${ranges[i]!.name} overlaps ${ranges[i - 1]!.name}`).toBeGreaterThanOrEqual(
        ranges[i - 1]!.end,
      );
    }
    expect(ranges[ranges.length - 1]!.end, 'seeds overflow the 32 bits mulberry32 reads').toBeLessThan(2 ** 32);
  });

  it('reserves room for a light gate in every level slot from chapter 11 on', () => {
    // The overlap check above only sees the pools the plan asks for today. The stride has
    // to hold the widest search any slot could be given, so a later retune that turns a
    // build into a gate cannot silently start sharing seeds.
    const stride = seedFor(FORGE_START, 2) - seedFor(FORGE_START, 1);
    expect(stride).toBeGreaterThan(48 * 60 * POOL_SEED_STEP);
    expect(seedFor(20, 10) + 48 * 60 * POOL_SEED_STEP).toBeLessThan(2 ** 32);
  });
});
