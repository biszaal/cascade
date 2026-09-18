import { describe, it, expect } from 'vitest';
import { DAILY_HINT_ALLOWANCE, hintsFor } from './hints';

describe('daily hints', () => {
  it('allows five a day', () => {
    expect(DAILY_HINT_ALLOWANCE).toBe(5);
  });

  it('keeps what is left for the rest of the day', () => {
    expect(hintsFor(2, '2026-09-15', '2026-09-15')).toBe(2);
    expect(hintsFor(0, '2026-09-15', '2026-09-15')).toBe(0);
  });

  it('refills on a new day, however many were left', () => {
    expect(hintsFor(0, '2026-09-14', '2026-09-15')).toBe(5);
    expect(hintsFor(3, '2026-09-14', '2026-09-15')).toBe(5);
  });

  it('starts a first-time player on a full allowance', () => {
    expect(hintsFor(undefined, undefined, '2026-09-15')).toBe(5);
  });

  it('gives no extra allowance for a count stamped a day ahead', () => {
    // An earlier build's UTC date on a US evening, or a flight west across midnight.
    expect(hintsFor(1, '2026-09-16', '2026-09-15')).toBe(1);
    expect(hintsFor(0, '2027-01-01', '2026-12-31')).toBe(0);
  });

  it('refills rather than locking out a clock wound further ahead', () => {
    expect(hintsFor(0, '2027-03-01', '2026-09-15')).toBe(5);
  });
});
