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
 *
 * Flags:
 *   --from <n>   regenerate only chapters n and above. Every chapter's seeds and ids are
 *                deterministic, so this writes exactly what a full run would.
 *   --jobs <n>   how many chapters to generate at once, each in its own process.
 *
 * Generation from chapter 11 on searches 8M nodes over wide pools and runs to hours on one
 * core. Chapters share nothing, so they run side by side, and a run that dies part way
 * keeps every pack that had already finished.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { buildPool, pickByPercentile } from '../src/engine/generator';
import { createState, replay, isSolved } from '../src/engine/rules';
import type { Level } from '../src/engine/types';
import { CHAPTERS, TOTAL_LEVELS, type ChapterPlan } from './level-plan';
import { attemptsFor, maxNodesFor, poolSizeFor, seedFor } from './level-budget';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'levels');

function packPath(chapter: number): string {
  return join(outDir, `chapter-${chapter}.json`);
}

function generateChapter(chapter: ChapterPlan): void {
  const levels: Level[] = [];
  const started = Date.now();

  // Ids run through the authored plan, never through whatever happens to be on disk, so a
  // chapter generated on its own numbers its levels exactly as a full run would.
  let globalId = CHAPTERS.filter((c) => c.n < chapter.n).reduce((sum, c) => sum + c.levels.length, 0);

  for (const plan of chapter.levels) {
    globalId++;
    const pool = buildPool(
      seedFor(chapter.n, plan.n),
      plan.spec,
      poolSizeFor(chapter.n, plan),
      maxNodesFor(chapter.n, plan),
      attemptsFor(chapter.n, plan),
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
    packPath(chapter.n),
    JSON.stringify({ chapter: chapter.n, name: chapter.name, color: chapter.color, levels }),
  );

  const pars = levels.map((l) => l.par);
  console.log(
    `  ${'-'.repeat(70)}\n  ${chapter.name}: ${levels.length} levels, ` +
      `par ${Math.min(...pars)}-${Math.max(...pars)}, ${((Date.now() - started) / 1000).toFixed(1)}s\n`,
  );
}

/**
 * The manifest lists the chapters the plan authors, reading each one's pack for its par
 * total. It is never built from the packs on disk: an orphaned pack left behind by a
 * shrinking plan must stay orphaned, so the "no stale pack" test can catch it.
 */
function writeManifest(): void {
  const manifest = CHAPTERS.map((chapter) => {
    if (!existsSync(packPath(chapter.n))) {
      throw new Error(`${chapter.name}: no pack on disk - generate chapter ${chapter.n} first`);
    }
    const pack = JSON.parse(readFileSync(packPath(chapter.n), 'utf8')) as { levels: Level[] };
    return {
      chapter: chapter.n,
      name: chapter.name,
      color: chapter.color,
      levels: pack.levels.length,
      parTotal: pack.levels.reduce((sum, l) => sum + l.par, 0),
    };
  });
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ chapters: manifest }, null, 2));
  console.log(`Wrote ${manifest.length} packs to assets/levels`);
}

function flag(name: string): number | undefined {
  const at = process.argv.indexOf(name);
  if (at === -1) return undefined;
  const value = Number(process.argv[at + 1]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} needs a positive whole number`);
  return value;
}

/** Generate one chapter in a child process running this same script. */
function runChild(chapter: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [...process.execArgv, fileURLToPath(import.meta.url), '--chapter', String(chapter)],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`chapter ${chapter} exited with code ${code}`)),
    );
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  const only = flag('--chapter');
  if (only !== undefined) {
    const chapter = CHAPTERS.find((c) => c.n === only);
    if (!chapter) throw new Error(`chapter ${only} is not in the plan`);
    generateChapter(chapter);
    return;
  }

  const from = flag('--from') ?? 1;
  const last = CHAPTERS[CHAPTERS.length - 1]!.n;
  if (from > last) throw new Error(`--from ${from}: the plan ends at chapter ${last}`);
  const jobs = flag('--jobs') ?? Math.max(1, availableParallelism() - 2);

  const queue = CHAPTERS.filter((c) => c.n >= from).map((c) => c.n);
  const levelCount = CHAPTERS.filter((c) => c.n >= from).reduce((sum, c) => sum + c.levels.length, 0);
  console.log(
    `Generating ${levelCount} of ${TOTAL_LEVELS} levels (chapters ${from}-${last}), ${jobs} at a time\n`,
  );

  const failures: string[] = [];
  const workers = Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      await runChild(next).catch((error: Error) => failures.push(error.message));
    }
  });
  await Promise.all(workers);

  if (failures.length > 0) {
    throw new Error(`generation failed - the manifest was left untouched:\n  ${failures.join('\n  ')}`);
  }
  writeManifest();
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
