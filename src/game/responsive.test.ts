import { describe, it, expect } from 'vitest';
import { metricsFor, sizeClassFor, TABLET_MIN_EDGE } from './responsive';

// Real device point sizes, so the thresholds are checked against hardware that exists.
const iPhone16Pro = [402, 874] as const;
const iPhone16ProMax = [440, 956] as const;
const iPadMini = [744, 1133] as const;
const iPadPro11 = [834, 1194] as const;
const iPadPro13 = [1024, 1366] as const;

describe('size class', () => {
  it('treats every current iPhone as compact, in either orientation', () => {
    for (const [w, h] of [iPhone16Pro, iPhone16ProMax]) {
      expect(sizeClassFor(w, h)).toBe('compact');
      expect(sizeClassFor(h, w)).toBe('compact');
    }
  });

  it('treats every iPad as regular, in either orientation', () => {
    for (const [w, h] of [iPadMini, iPadPro11, iPadPro13]) {
      expect(sizeClassFor(w, h)).toBe('regular');
      expect(sizeClassFor(h, w)).toBe('regular');
    }
  });

  it('treats a narrow split view on an iPad as compact, because it genuinely is', () => {
    // An iPad Pro handing this app a one-third column is not a tablet layout.
    expect(sizeClassFor(320, 1194)).toBe('compact');
  });

  it('switches class exactly at the threshold, not near it', () => {
    expect(sizeClassFor(TABLET_MIN_EDGE - 1, 1366)).toBe('compact');
    expect(sizeClassFor(TABLET_MIN_EDGE, 1366)).toBe('regular');
  });
});

describe('metrics', () => {
  it('never lets content span the whole width of a tablet', () => {
    const m = metricsFor(...iPadPro13);
    expect(m.contentWidth).toBeLessThanOrEqual(620);
    expect(m.contentWidth).toBeLessThan(1024);
  });

  it('lets content fill a phone, minus its gutters', () => {
    const m = metricsFor(...iPhone16Pro);
    expect(m.contentWidth).toBe(402 - 32);
  });

  it('draws a bigger board and bigger tokens on a tablet', () => {
    const phone = metricsFor(...iPhone16Pro);
    const tablet = metricsFor(...iPadPro11);
    expect(tablet.maxToken).toBeGreaterThan(phone.maxToken);
    expect(tablet.boardWidth).toBeGreaterThan(phone.boardWidth);
  });

  it('never lets the board exceed the window', () => {
    for (const [w, h] of [iPhone16Pro, iPadMini, iPadPro13, [320, 1194] as const]) {
      const m = metricsFor(w, h);
      expect(m.boardWidth).toBeLessThanOrEqual(w);
      expect(m.contentWidth).toBeLessThanOrEqual(w);
    }
  });

  it('gives the trail more columns on a tablet, so it is not a thin ribbon', () => {
    expect(metricsFor(...iPhone16Pro).trailColumns).toBe(3);
    expect(metricsFor(...iPadPro11).trailColumns).toBe(5);
  });

  it('reports orientation', () => {
    expect(metricsFor(834, 1194).isLandscape).toBe(false);
    expect(metricsFor(1194, 834).isLandscape).toBe(true);
  });

  it('allows the board more width in landscape, where height is the scarce axis', () => {
    expect(metricsFor(1194, 834).boardWidth).toBeGreaterThan(metricsFor(834, 1194).boardWidth);
  });
});
