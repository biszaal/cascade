/**
 * Build the level packs. Run with `npm run levels`.
 *
 * This runs offline and its output is committed. Nothing here executes at runtime - the
 * app only ever reads the JSON. That is deliberate: it means par is exact, generation
 * cost is paid once by us rather than on every player's phone, and a level is identical
 * on every device forever.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPool, pickByPercentile, type GenerationSpec } from '../src/engine/generator';
import { createState, replay, isSolved } from '../src/engine/rules';
import type { Level } from '../src/engine/types';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'levels');

const LEVELS_PER_CHAPTER = 30;

interface ChapterPlan {
  n: number;
  name: string;
  /** Index into `chapterColors` in the design tokens. */
  color: number;
  /** Candidates generated per level slot. Smaller where each solve is expensive. */
  poolSize: number;
  maxNodes: number;
  /** `t` runs 0 -> 1 across the chapter, giving the coarse ramp. */
  spec: (t: number) => GenerationSpec;
}

/**
 * Every chapter deals with two free lanes. That is not an aesthetic choice: measured over
 * random deals, a board with one free lane is genuinely unsolvable about 92% of the time,
 * while two free lanes are solvable essentially always. Difficulty comes from colour
 * count, lane capacity and face-down tokens instead.
 */
const CHAPTERS: ChapterPlan[] = [
  {
    n: 1,
    name: 'Saffron Path',
    color: 0,
    poolSize: 10,
    maxNodes: 400_000,
    spec: (t) => ({ capacity: 4, colorCount: 3 + Math.round(t * 2), emptyLanes: 2, hiddenMin: 0, hiddenMax: 0 }),
  },
  {
    n: 2,
    name: 'Emerald Path',
    color: 1,
    poolSize: 10,
    maxNodes: 400_000,
    spec: (t) => ({ capacity: 4, colorCount: 5 + Math.round(t * 2), emptyLanes: 2, hiddenMin: 0, hiddenMax: 0 }),
  },
  {
    n: 3,
    name: 'Vermilion Path',
    color: 2,
    poolSize: 8,
    maxNodes: 600_000,
    spec: (t) => ({ capacity: 4, colorCount: 7 + Math.round(t * 2), emptyLanes: 2, hiddenMin: 0, hiddenMax: 0 }),
  },
  {
    n: 4,
    name: 'Indigo Path',
    color: 3,
    poolSize: 8,
    maxNodes: 600_000,
    // Face-down tokens arrive here, and the colour count eases back to make room for them.
    spec: (t) => ({ capacity: 4, colorCount: 7 + Math.round(t), emptyLanes: 2, hiddenMin: 1, hiddenMax: 1 + Math.round(t) }),
  },
  {
    n: 5,
    name: 'Magenta Path',
    color: 4,
    poolSize: 6,
    maxNodes: 900_000,
    spec: (t) => ({ capacity: 4, colorCount: 8 + Math.round(t), emptyLanes: 2, hiddenMin: 2, hiddenMax: 2 }),
  },
  {
    n: 6,
    name: 'Slate Path',
    color: 5,
    poolSize: 4,
    maxNodes: 1_500_000,
    // Lanes get a fifth slot, which is the single biggest jump in the game.
    spec: (t) => ({ capacity: 5, colorCount: 8 + Math.round(t), emptyLanes: 2, hiddenMin: 2, hiddenMax: 3 }),
  },
];

function seedFor(chapter: number, index: number): number {
  return chapter * 1_000_003 + index * 7919 + 12345;
}

function generateChapter(plan: ChapterPlan) {
  const levels: Level[] = [];
  const started = Date.now();

  for (let index = 0; index < LEVELS_PER_CHAPTER; index++) {
    const t = index / (LEVELS_PER_CHAPTER - 1);
    const spec = plan.spec(t);
    const baseSeed = seedFor(plan.n, index);

    const pool = buildPool(baseSeed, spec, plan.poolSize, plan.maxNodes);
    // Rank within the pool and take the one at this level's position in the chapter, so
    // the fine-grained ramp calibrates itself instead of us guessing absolute scores.
    const chosen = pickByPercentile(pool, t);
    if (!chosen) throw new Error(`chapter ${plan.n} level ${index + 1}: empty candidate pool`);

    // Never ship a level without proving its recorded solution actually solves it.
    const final = replay(createState(chosen.config), chosen.solution);
    if (!final || !isSolved(final)) {
      throw new Error(`chapter ${plan.n} level ${index + 1}: recorded solution does not solve the board`);
    }

    levels.push({
      id: (plan.n - 1) * LEVELS_PER_CHAPTER + index + 1,
      chapter: plan.n,
      index: index + 1,
      seed: chosen.seed,
      config: chosen.config,
      par: chosen.par,
      solution: chosen.solution,
      difficulty: chosen.difficulty,
    });

    process.stdout.write(
      `\r  ${plan.name}  ${String(index + 1).padStart(2)}/${LEVELS_PER_CHAPTER}  ` +
        `par ${String(chosen.par).padStart(2)}  difficulty ${String(chosen.difficulty).padStart(3)}  ` +
        `pool ${String(pool.length).padStart(2)}     `,
    );
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const pars = levels.map((l) => l.par);
  const difficulties = levels.map((l) => l.difficulty);
  process.stdout.write(
    `\r  ${plan.name.padEnd(16)} 30 levels  par ${Math.min(...pars)}-${Math.max(...pars)}  ` +
      `difficulty ${Math.min(...difficulties)}-${Math.max(...difficulties)}  ${elapsed}s          \n`,
  );

  return { chapter: plan.n, name: plan.name, color: plan.color, levels };
}

function main() {
  mkdirSync(outDir, { recursive: true });
  console.log('Generating level packs\n');

  const manifest: Array<{ chapter: number; name: string; color: number; levels: number; parTotal: number }> = [];

  for (const plan of CHAPTERS) {
    const pack = generateChapter(plan);
    writeFileSync(join(outDir, `chapter-${plan.n}.json`), JSON.stringify(pack));
    manifest.push({
      chapter: pack.chapter,
      name: pack.name,
      color: pack.color,
      levels: pack.levels.length,
      parTotal: pack.levels.reduce((sum, l) => sum + l.par, 0),
    });
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ chapters: manifest }, null, 2));
  console.log(`\nWrote ${manifest.length} packs to assets/levels`);
}

main();
