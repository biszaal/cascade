import { describe, it, expect } from 'vitest';
import { bounceAt } from './bounce';

/** Every phase the animation will actually sample, at roughly one frame each. */
const sweep = Array.from({ length: 101 }, (_, i) => i / 100);

describe('bounce', () => {
  it('rests at both ends, so a token neither jumps on arrival nor stays squashed', () => {
    expect(bounceAt(0)).toEqual({ rebound: 0, impact: 0 });
    expect(bounceAt(1)).toEqual({ rebound: 0, impact: 0 });
  });

  it('is idle outside the phase, so an untouched token sits flat', () => {
    expect(bounceAt(-0.5)).toEqual({ rebound: 0, impact: 0 });
    expect(bounceAt(2)).toEqual({ rebound: 0, impact: 0 });
  });

  it('never sinks below the lane it landed in', () => {
    for (const p of sweep) expect(bounceAt(p).rebound).toBeGreaterThanOrEqual(0);
  });

  it('touches down between the two hops', () => {
    const resting = sweep.filter((p) => p > 0 && p < 1 && bounceAt(p).rebound < 0.01);
    // A contact partway through, not just the settle at the end.
    expect(resting.some((p) => p > 0.2 && p < 0.8)).toBe(true);
  });

  it('decays: the second hop is a fraction of the first', () => {
    const peak = (from: number, to: number) =>
      Math.max(...sweep.filter((p) => p >= from && p <= to).map((p) => bounceAt(p).rebound));
    const first = peak(0, 0.5);
    const second = peak(0.6, 0.85);
    expect(second).toBeGreaterThan(0.5);
    expect(second).toBeLessThan(first / 2);
  });

  it('squashes hardest at a touchdown and releases as the disc leaves it', () => {
    const impacts = sweep.map((p) => bounceAt(p).impact);
    expect(Math.max(...impacts)).toBeGreaterThan(0.8);
    // Airborne halfway up the first hop.
    expect(bounceAt(0.25).impact).toBe(0);
    // The last contact is the softest, and is gone by the time the phase ends.
    expect(bounceAt(0.86).impact).toBeLessThan(0.6);
    expect(bounceAt(0.99).impact).toBeLessThan(0.05);
  });
});
