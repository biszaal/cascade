import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState, replay, isSolved, countHidden } from '../src/engine/rules';
import { parFor } from '../src/engine/generator';
import { solve } from '../src/engine/solver';
import type { Level } from '../src/engine/types';
import { chapterColors } from '../src/design/tokens';
import { CHAPTERS } from './level-plan';

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

// Read from the authored plan, not the manifest: `npm run levels -- --from` rewrites the
// manifest, and a list built from the packs on disk would absorb an orphaned pack instead
// of letting the stale-pack test below catch it.
const packs: Pack[] = CHAPTERS.map(
  (chapter) => JSON.parse(readFileSync(join(levelsDir, `chapter-${chapter.n}.json`), 'utf8')) as Pack,
);
const allLevels = packs.flatMap((pack) => pack.levels);

/**
 * The game is arranged in five-chapter arcs. The first two each teach one mechanic on
 * deliberately gentle boards before testing it: water (chapters 1-5) is the base rules,
 * then hidden tokens; stone (chapters 6-10) is anchors. Forge (11-15) and light (16-20)
 * add no rule - each chapter poses a different shape of problem with the same pieces.
 * Chunking the pack list rather than hardcoding chapter numbers holds every arc to the
 * same curve.
 */
const ARC_SIZE = 5;
function arcsOf<T>(items: T[]): T[][] {
  const arcs: T[][] = [];
  for (let i = 0; i < items.length; i += ARC_SIZE) arcs.push(items.slice(i, i + ARC_SIZE));
  return arcs;
}
const arcs = arcsOf(packs);

/** Level 10 of every chapter from here on is a gate, a deliberate spike. */
const FIRST_GATED_CHAPTER = 11;
/**
 * How far a gate must stand above its chapter's second-hardest level. Difficulty's
 * dominant term is 6 x log2(nodes + 1), so eight points is slightly more than one doubling
 * of search effort - a spike a player feels, not a board that tops its chapter by a point.
 */
const GATE_MARGIN = 8;

// The opening level of each chapter - fixed and deterministic, not random. These are the
// smallest, quickest boards a chapter has, which keeps a full solve() cheap; a random or
// exhaustive sample would turn this file from a unit test into a benchmark.
//
// Levels 55 and 58 are added on top: two more small anchored boards from Bedrock, a rest
// and a tight one. The first sample's expected lengths came from a solver that let a lone
// anchor hide an identical free lane from the search, and it caught nothing, because it
// was checking the bug against itself. More anchored boards of varied shape give the
// anchor-specific paths through the search more chances to disagree with what shipped.
const SOLVE_SAMPLE_IDS = [1, 11, 21, 31, 41, 51, 55, 58, 61, 71, 81, 91];

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

  it('ships twenty chapters of ten levels', () => {
    expect(packs).toHaveLength(20);
    for (const pack of packs) expect(pack.levels, pack.name).toHaveLength(10);
  });

  it('numbers levels 1..200 with no gaps or repeats', () => {
    const ids = allLevels.map((l) => l.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 200 }, (_, i) => i + 1));
  });

  it('registers every planned chapter with the app', () => {
    // Metro needs literal require paths, so the app's pack list is written out by hand
    // and cannot be derived. A chapter missing from it generates, passes every test in
    // this file, and never reaches a player.
    const source = readFileSync(join(here, '..', 'src', 'data', 'levels.ts'), 'utf8');
    const registered = [...source.matchAll(/require\('\.\.\/\.\.\/assets\/levels\/chapter-(\d+)\.json'\)/g)].map(
      (match) => Number(match[1]),
    );
    expect(registered).toEqual(CHAPTERS.map((chapter) => chapter.n));
  });

  it('gives every chapter an accent of its own', () => {
    // The app looks accents up modulo the list's length, so a chapter past the end of it
    // does not fail - it quietly wears an earlier chapter's colour.
    const colors = CHAPTERS.map((chapter) => chapter.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const chapter of CHAPTERS) {
      expect(chapter.color, chapter.name).toBeLessThan(chapterColors.length);
    }
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

  it('never anchors two lanes to the same colour', () => {
    for (const level of allLevels) {
      const anchored = level.config.anchored ?? [];
      const colors = level.config.lanes
        .map((lane, i) => (anchored[i] ? lane[0] : null))
        .filter((c): c is number => c !== null && c !== undefined);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it('anchors at least one lane in every level from chapter 6 on', () => {
    // Anchors are the whole point of these chapters. A level that silently shipped without
    // one would pass every other check here and teach nothing.
    for (const level of allLevels.filter((l) => l.chapter >= 6)) {
      expect((level.config.anchored ?? []).some(Boolean), `level ${level.id}`).toBe(true);
    }
  });

  it('never ships the same board twice, from chapter 6 on', () => {
    // Neighbouring levels with the same spec once drew from overlapping seeds and shipped
    // one board under two level numbers. Chapters 1-5 are left out on purpose: they hold
    // three such pairs from before the seeds were fixed (levels 1/2, 23/26 and 35/38), and
    // removing them would reprice levels players have already been scored on.
    const seen = new Map<string, number>();
    for (const level of allLevels.filter((l) => l.chapter >= 6)) {
      const { lanes, hidden, anchored } = level.config;
      const key = JSON.stringify({ lanes, hidden, anchored });
      expect(seen.get(key), `level ${level.id} repeats level ${seen.get(key)}`).toBeUndefined();
      seen.set(key, level.id);
    }
  });

  it('leaves chapters 1 to 5 free of anchors', () => {
    for (const level of allLevels.filter((l) => l.chapter <= 5)) {
      expect((level.config.anchored ?? []).some(Boolean)).toBe(false);
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
   * instead of a player. The sample is SOLVE_SAMPLE_IDS above - twelve boards, not one per
   * chapter, for the reason documented there. maxNodes is bounded so a regression that
   * makes the search blow up fails fast instead of hanging.
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
  it('gets harder within each arc, and from arc to arc', () => {
    // A new mechanic resets the ceiling inside its own arc: Bedrock opens easier than
    // Deep closes, the same way Undertow once opened easier than Rapids closed, because
    // a mechanic has to be taught on a gentle board. Requiring monotonic chapters would
    // forbid exactly the pacing this curve was rebuilt to have, so the within-arc trend
    // is checked one arc at a time rather than across the seam between them.
    //
    // But no arc may be gentler than the one before it - the seam is where a new
    // mechanic gets taught, not where the game is allowed to get easier overall.
    for (const arc of arcs) {
      const averages = arc.map(
        (pack) => pack.levels.reduce((sum, l) => sum + l.difficulty, 0) / pack.levels.length,
      );
      for (let i = 2; i < averages.length; i++) {
        expect(
          averages[i],
          `${arc[i]!.name} is not harder on average than ${arc[i - 2]!.name}, so this arc's trend has stalled`,
        ).toBeGreaterThan(averages[i - 2]!);
      }
    }

    const arcMeans = arcs.map((arc) => {
      const diffs = arc.flatMap((pack) => pack.levels.map((l) => l.difficulty));
      return diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    });
    for (let i = 1; i < arcMeans.length; i++) {
      expect(
        arcMeans[i],
        `arc ${i + 1} is not harder on average than arc ${i}, so an arc got gentler overall`,
      ).toBeGreaterThan(arcMeans[i - 1]!);
    }

    // The game must not merely trend upward - it must actually arrive somewhere. The last
    // chapter is at least twice as hard on average as the first, which no amount of
    // within-arc shuffling can fake.
    const chapterAverages = packs.map(
      (pack) => pack.levels.reduce((sum, l) => sum + l.difficulty, 0) / pack.levels.length,
    );
    expect(
      chapterAverages[chapterAverages.length - 1],
      'the last chapter is not twice as hard as the first, so the game does not go anywhere',
    ).toBeGreaterThan(chapterAverages[0]! * 2);
  });

  it('raises the peak within each arc, and from arc to arc', () => {
    // Averages may dip where a mechanic is introduced (above), but within an arc the
    // ceiling must keep rising - otherwise a later chapter in the same arc is not
    // actually asking more of the player. That requirement resets at each arc seam for
    // the same reason the trend does: a new mechanic is taught gently, so Bedrock's peak
    // is not required to beat Deep's.
    for (const arc of arcs) {
      const peaks = arc.map((pack) => Math.max(...pack.levels.map((l) => l.difficulty)));
      for (let i = 1; i < peaks.length; i++) {
        expect(peaks[i], `${arc[i]!.name} peaks no higher than ${arc[i - 1]!.name}`).toBeGreaterThan(
          peaks[i - 1]!,
        );
      }
    }

    // The seam itself is still held to a floor: each arc's hardest board must clearly
    // beat the arc before it, so the game's absolute ceiling always rises.
    const arcPeaks = arcs.map((arc) => Math.max(...arc.flatMap((pack) => pack.levels.map((l) => l.difficulty))));
    for (let i = 1; i < arcPeaks.length; i++) {
      expect(arcPeaks[i], `arc ${i + 1} peaks no higher than arc ${i}`).toBeGreaterThan(arcPeaks[i - 1]!);
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

  it('makes every gate stand clear of its chapter', () => {
    // Topping the chapter is not enough for a gate - Core's climax once did that by a
    // single point, and a spike nobody can feel is just the last level. The climax test
    // above already proves each chapter has one and that it is the hardest.
    for (const pack of packs.filter((p) => p.chapter >= FIRST_GATED_CHAPTER)) {
      const difficulties = pack.levels.map((l) => l.difficulty).sort((a, b) => b - a);
      expect(
        difficulties[0]! - difficulties[1]!,
        `${pack.name}'s gate (${difficulties[0]}) is not ${GATE_MARGIN} clear of its next-hardest level (${difficulties[1]})`,
      ).toBeGreaterThanOrEqual(GATE_MARGIN);
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

  it('keeps face-down tokens out of the chapters teaching something else', () => {
    // Two mechanics get taught in this game, and each is introduced on a board that is
    // otherwise plain so the new idea is the only new thing: face-down tokens in chapter
    // 4, anchors in chapter 6. That means hidden tokens are absent twice over - chapters
    // 1-3, before either mechanic exists, and chapters 6-7, where anchors are taught on
    // their own before the two mechanics combine starting in chapter 8.
    const hiddenFree = new Set([1, 2, 3, 6, 7]);
    for (const pack of packs) {
      const hiddenTotal = pack.levels.reduce((sum, l) => sum + countHidden(createState(l.config)), 0);
      if (hiddenFree.has(pack.chapter)) expect(hiddenTotal, pack.name).toBe(0);
      else expect(hiddenTotal, pack.name).toBeGreaterThan(0);
    }
  });

  it('keeps every board inside the nine available token colours', () => {
    for (const level of allLevels) {
      expect(level.config.colorCount, `level ${level.id}`).toBeLessThanOrEqual(9);
    }
  });
});
