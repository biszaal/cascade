import type { LevelPlan } from './level-plan';

/**
 * How hard the generator is allowed to search for each planned level, and where its seeds
 * start. Every number here feeds a shipped level's par, so a change to a branch that
 * chapters 1-10 read reprices levels players have already been scored on. Chapters 11 and
 * above take their own branch in each function for exactly that reason.
 */

/** The first chapter of the forge arc, and of every budget branch the stone arc never reads. */
export const FORGE_START = 11;
/** The first chapter of the light arc, whose gates search the widest pools in the game. */
export const LIGHT_START = 16;

/** buildPool's step between consecutive seeds in one pool. */
export const POOL_SEED_STEP = 7919;

/** buildPool asks for this many seeds per pool slot on an anchored spec, in chapters 6-10. */
const ANCHORED_ATTEMPTS_PER_SLOT = 200;

/**
 * Seeds per pool slot from chapter 11 on. Every probe pool filled completely at this rate
 * (dealt anchored boards measured solvable 75-82% of the time), and a 48-slot gate at 200
 * per slot would overrun the seed block below.
 */
const FORGE_ATTEMPTS_PER_SLOT = 60;

/**
 * The search budget from chapter 11 on. Measured with seeds and pool held fixed: 2M to 8M
 * admits the quarter of hard candidates that need 2-8M nodes and adds about 4 points of
 * difficulty; 32M changed nothing. So no budget above 8M is justified.
 */
const FORGE_MAX_NODES = 8_000_000;

/** Pool sizes from chapter 11 on. Searching more seeds, not more nodes, reaches the top. */
const FORGE_POOL = 16;
const FORGE_GATE_POOL = 24;
const LIGHT_GATE_POOL = 48;

/** Bigger pools where a solve is cheap; smaller where it is not. */
export function poolSizeFor(chapter: number, plan: LevelPlan): number {
  if (chapter >= FORGE_START) {
    if (plan.beat !== 'climax') return FORGE_POOL;
    return chapter >= LIGHT_START ? LIGHT_GATE_POOL : FORGE_GATE_POOL;
  }
  const { colorCount, capacity } = plan.spec;
  const work = colorCount * capacity;
  if (work <= 20) return 14;
  if (work <= 32) return 10;
  if (work <= 40) return 7;
  return 5;
}

export function maxNodesFor(chapter: number, plan: LevelPlan): number {
  if (chapter >= FORGE_START) return FORGE_MAX_NODES;
  const work = plan.spec.colorCount * plan.spec.capacity;
  return work <= 32 ? 600_000 : 2_000_000;
}

/**
 * How many seeds to try before giving up on a pool.
 *
 * Anchored specs lose far more seeds than unanchored ones, for a different reason
 * depending on how the board is built. Most anchored levels are dealt, and a dealt
 * anchored board comes back unsolvable 18-25% of the time (measured solvable 75-82%) -
 * tryCandidate rejects those, so every loss costs a seed. The tight one-free-lane levels
 * are still reverse-walked, and there the walk only reaches its planned free-lane count
 * when one of the FEW lanes still able to fully empty happens to do so at the same step as
 * another; anchoring removes such lanes, and those shapes measured failing 22-51% of seeds
 * against 2-3% unanchored. Either way the default budget runs dry, so anchored specs get a
 * much larger one; unanchored specs keep buildPool's default exactly, so chapters 1-5 try
 * the identical seeds in the identical order.
 */
export function attemptsFor(chapter: number, plan: LevelPlan): number | undefined {
  if (chapter >= FORGE_START) return poolSizeFor(chapter, plan) * FORGE_ATTEMPTS_PER_SLOT;
  if (!plan.spec.anchors) return undefined;
  return poolSizeFor(chapter, plan) * ANCHORED_ATTEMPTS_PER_SLOT;
}

/** The seed span one level in chapters 6-10 owns: one step more than its largest search. */
const STONE_STRIDE = POOL_SEED_STEP * (14 * ANCHORED_ATTEMPTS_PER_SLOT + 1);

/** The seed span one level from chapter 11 on owns, sized to a light-arc gate's search. */
const FORGE_STRIDE = POOL_SEED_STEP * (LIGHT_GATE_POOL * FORGE_ATTEMPTS_PER_SLOT + 1);

/**
 * The first seed a level's pool tries.
 *
 * The original formula steps 7919 per level, and buildPool also steps 7919 per attempt -
 * so level n+1's pool begins exactly at level n's second seed. Two neighbouring levels
 * with the same spec then draw from the same seeds, rank them the same way, and can ship
 * the identical board twice; chapters 6-10 did, twice.
 *
 * Chapters 1-5 keep that formula unchanged, because their levels are already shipped and
 * priced. From chapter 6 on, each level owns a disjoint block of seeds one pool can never
 * run past: a stride of one step more than the largest pool (14, from poolSizeFor) times
 * its anchored budget. Every seed in that range sits at 4242 plus a multiple of 7919,
 * which no seed of chapters 1-5 does, so the new blocks cannot collide with the old ones
 * either.
 *
 * Chapters 11-20 get their own block, starting one stone stride after chapter 10's last
 * level (whose pool ends near 1.117 billion), with a stride sized to the largest search
 * they run. The block ends near 3.41 billion, still inside the 32 bits mulberry32 reads.
 */
export function seedFor(chapter: number, index: number): number {
  if (chapter <= 5) return chapter * 1_000_003 + index * POOL_SEED_STEP + 4242;
  if (chapter < FORGE_START) return ((chapter - 6) * 10 + index) * STONE_STRIDE + 4242;
  return 51 * STONE_STRIDE + ((chapter - FORGE_START) * 10 + (index - 1)) * FORGE_STRIDE + 4242;
}
