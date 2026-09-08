/**
 * Build the level packs. Run with `npm run levels`.
 *
 * Runs offline; the output is committed. Nothing here executes at runtime - the app only
 * reads the JSON. That keeps par exact, pays the generation cost once, and makes a level
 * identical on every device forever.
 *
 * The curve is authored by hand in level-plan.ts. This script only realises it: for each
 * planned level it generates a pool of candidates matching that level's spec and picks
 * the one whose difficulty best matches the intended intensity.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPool, pickByPercentile } from '../src/engine/generator';
import { createState, replay, isSolved } from '../src/engine/rules';
import type { Level } from '../src/engine/types';
import { CHAPTERS, TOTAL_LEVELS, type LevelPlan } from './level-plan';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'levels');

/** Bigger pools where a solve is cheap; smaller where it is not. */
function poolSizeFor(plan: LevelPlan): number {
  const { colorCount, capacity } = plan.spec;
  const work = colorCount * capacity;
  if (work <= 20) return 14;
  if (work <= 32) return 10;
  if (work <= 40) return 7;
  return 5;
}

function maxNodesFor(plan: LevelPlan): number {
  const work = plan.spec.colorCount * plan.spec.capacity;
  return work <= 32 ? 600_000 : 2_000_000;
}

function seedFor(chapter: number, index: number): number {
  return chapter * 1_000_003 + index * 7919 + 4242;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  console.log(`Generating ${TOTAL_LEVELS} levels\n`);

  const manifest: Array<Record<string, unknown>> = [];
  let globalId = 0;

  for (const chapter of CHAPTERS) {
    const levels: Level[] = [];
    const started = Date.now();

    for (const plan of chapter.levels) {
      globalId++;
      const pool = buildPool(
        seedFor(chapter.n, plan.n),
        plan.spec,
        poolSizeFor(plan),
        maxNodesFor(plan),
      );

      // Rank the pool and take the candidate sitting at this level's intended intensity.
      // The spec sets the coarse shape; this picks how hard an instance of it to ship.
      const chosen = pickByPercentile(pool, plan.pick ?? plan.intensity);
      if (!chosen) throw new Error(`${chapter.name} ${plan.n}: empty candidate pool`);

      // Never ship a level without proving its recorded solution actually solves it.
      const final = replay(createState(chosen.config), chosen.solution);
      if (!final || !isSolved(final)) {
        throw new Error(`${chapter.name} ${plan.n}: recorded solution does not solve the board`);
      }

      levels.push({
        id: globalId,
        chapter: chapter.n,
        index: plan.n,
        seed: chosen.seed,
        config: chosen.config,
        par: chosen.par,
        solution: chosen.solution,
        difficulty: chosen.difficulty,
        beat: plan.beat,
        intensity: plan.intensity,
        note: plan.note,
      });

      const { colorCount, capacity, emptyLanes, hiddenMax } = plan.spec;
      console.log(
        `  ${chapter.name.padEnd(9)} ${String(plan.n).padStart(2)}  ` +
          `${plan.beat.padEnd(6)} ` +
          `${colorCount}c x${capacity} ${emptyLanes}free ${hiddenMax ? `h${hiddenMax}` : '  '}  ` +
          `par ${String(chosen.par).padStart(3)}  diff ${String(chosen.difficulty).padStart(3)}  ` +
          `pool ${String(pool.length).padStart(2)}`,
      );
    }

    writeFileSync(
      join(outDir, `chapter-${chapter.n}.json`),
      JSON.stringify({ chapter: chapter.n, name: chapter.name, color: chapter.color, levels }),
    );

    const pars = levels.map((l) => l.par);
    console.log(
      `  ${'-'.repeat(70)}\n  ${chapter.name}: ${levels.length} levels, ` +
        `par ${Math.min(...pars)}-${Math.max(...pars)}, ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
    );

    manifest.push({
      chapter: chapter.n,
      name: chapter.name,
      color: chapter.color,
      levels: levels.length,
      parTotal: pars.reduce((a, b) => a + b, 0),
    });
  }

  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ chapters: manifest }, null, 2));
  console.log(`Wrote ${manifest.length} packs to assets/levels`);
}

main();
