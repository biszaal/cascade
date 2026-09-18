import { describe, it, expect } from 'vitest';
import { dayAfter, localDay, msUntilNextDay, utcDay } from './day';

describe('local day', () => {
  it('turns over at local midnight', () => {
    expect(localDay(new Date(2026, 8, 15, 23, 59))).toBe('2026-09-15');
    expect(localDay(new Date(2026, 8, 16, 0, 1))).toBe('2026-09-16');
  });

  it('counts down to the next local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 8, 15, 23, 59))).toBe(60_000);
    expect(msUntilNextDay(new Date(2026, 11, 31, 12, 0))).toBe(12 * 3_600_000);
  });
});

describe('utc day', () => {
  it('reads the UTC calendar, not the device one', () => {
    expect(utcDay(new Date(Date.UTC(2026, 8, 15, 23, 59)))).toBe('2026-09-15');
    expect(utcDay(new Date(Date.UTC(2026, 8, 16, 0, 1)))).toBe('2026-09-16');
  });
});

describe('day after', () => {
  it('steps one day', () => {
    expect(dayAfter('2026-09-15')).toBe('2026-09-16');
  });

  it('carries a month end', () => {
    expect(dayAfter('2026-09-30')).toBe('2026-10-01');
    expect(dayAfter('2026-01-31')).toBe('2026-02-01');
  });

  it('carries a year end', () => {
    expect(dayAfter('2026-12-31')).toBe('2027-01-01');
  });

  it('knows a leap year from a common one', () => {
    expect(dayAfter('2028-02-28')).toBe('2028-02-29');
    expect(dayAfter('2026-02-28')).toBe('2026-03-01');
  });
});
