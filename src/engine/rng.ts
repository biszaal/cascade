/**
 * mulberry32 - a small, fast, well-distributed seeded PRNG.
 *
 * Determinism is the point: a level is identified by its seed, so the same seed must
 * produce the same board on every machine and every run, forever. Never use Math.random
 * anywhere in generation.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

/** Fisher-Yates, in place. */
export function shuffle<T>(rng: () => number, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const a = items[i]!;
    const b = items[j]!;
    items[i] = b;
    items[j] = a;
  }
  return items;
}
