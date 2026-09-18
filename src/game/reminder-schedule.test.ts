import { describe, it, expect } from 'vitest';
import { utcDay } from './day';
import { reminderDates } from './reminder-schedule';

const HOUR = 19;
const MIN = 0;
/** The local instant of the reminder on the day `offset` days from `d`. */
const slot = (d: Date, offset = 0) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, HOUR, MIN);

describe('reminderDates', () => {
  it('schedules a week, starting today when today has not passed', () => {
    const now = new Date(2026, 8, 15, 8, 0);
    const dates = reminderDates(now, HOUR, MIN, '', 7);
    expect(dates).toHaveLength(7);
    expect(dates[0]!.getTime()).toBe(slot(now, 0).getTime());
    expect(dates[6]!.getTime()).toBe(slot(now, 6).getTime());
  });

  it('never schedules a moment already gone', () => {
    const now = new Date(2026, 8, 15, 20, 0);
    const dates = reminderDates(now, HOUR, MIN, '', 7);
    expect(dates).toHaveLength(7);
    expect(dates[0]!.getTime()).toBe(slot(now, 1).getTime());
    for (const d of dates) expect(d.getTime()).toBeGreaterThan(now.getTime());
  });

  it('skips today once today is solved', () => {
    const now = new Date(2026, 8, 15, 8, 0);
    const solvedToday = utcDay(slot(now, 0));
    const dates = reminderDates(now, HOUR, MIN, solvedToday, 7);
    expect(dates).toHaveLength(7);
    expect(dates[0]!.getTime()).toBe(slot(now, 1).getTime());
  });

  it('keeps the same wall clock every day, across a month end', () => {
    const now = new Date(2026, 8, 28, 8, 0);
    for (const d of reminderDates(now, HOUR, MIN, '', 7)) {
      expect(d.getHours()).toBe(HOUR);
      expect(d.getMinutes()).toBe(MIN);
    }
  });

  it('gives one instant per calendar day', () => {
    const days = reminderDates(new Date(2026, 8, 15, 8, 0), HOUR, MIN, '', 7).map((d) => d.getDate());
    expect(new Set(days).size).toBe(7);
  });

  it('honours a shorter window', () => {
    expect(reminderDates(new Date(2026, 8, 15, 8, 0), HOUR, MIN, '', 3)).toHaveLength(3);
  });

  it('schedules nothing when asked for nothing', () => {
    expect(reminderDates(new Date(2026, 8, 15, 8, 0), HOUR, MIN, '', 0)).toEqual([]);
  });
});
