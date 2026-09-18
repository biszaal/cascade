import { describe, it, expect } from 'vitest';
import { afterSolving, describeStreak, NO_STREAK, streakOn, streakTag, type Streak } from './streak';

const at = (current: number, best: number, lastDay: string): Streak => ({ current, best, lastDay });

describe('afterSolving', () => {
  it('starts a run at one', () => {
    expect(afterSolving(NO_STREAK, '2026-09-15')).toEqual(at(1, 1, '2026-09-15'));
  });

  it('extends a run solved the day before', () => {
    expect(afterSolving(at(3, 3, '2026-09-14'), '2026-09-15')).toEqual(at(4, 4, '2026-09-15'));
  });

  it('is idempotent on the same board', () => {
    const solved = at(4, 4, '2026-09-15');
    expect(afterSolving(solved, '2026-09-15')).toEqual(solved);
    expect(afterSolving(afterSolving(solved, '2026-09-15'), '2026-09-15')).toEqual(solved);
  });

  it('restarts at one after a missed day', () => {
    expect(afterSolving(at(9, 9, '2026-09-13'), '2026-09-15')).toEqual(at(1, 9, '2026-09-15'));
  });

  it('keeps the best run after the current one breaks', () => {
    const broken = afterSolving(at(9, 9, '2026-09-01'), '2026-09-15');
    expect(broken.current).toBe(1);
    expect(broken.best).toBe(9);
  });

  it('carries a month end', () => {
    expect(afterSolving(at(2, 2, '2026-09-30'), '2026-10-01').current).toBe(3);
  });
});

describe('streakOn', () => {
  it('reads nothing for a player who has never solved one', () => {
    expect(streakOn(NO_STREAK, '2026-09-15')).toBe(0);
  });

  it('reads the run on the day it was last extended', () => {
    expect(streakOn(at(4, 4, '2026-09-15'), '2026-09-15')).toBe(4);
  });

  it('holds the run through the day after, while that board is still open', () => {
    expect(streakOn(at(4, 4, '2026-09-14'), '2026-09-15')).toBe(4);
  });

  it('drops to nothing once a whole board was missed', () => {
    expect(streakOn(at(4, 4, '2026-09-13'), '2026-09-15')).toBe(0);
  });

  it('holds a run stamped one day ahead of the clock', () => {
    // A device a few hours fast across UTC midnight, not a real future.
    expect(streakOn(at(4, 4, '2026-09-16'), '2026-09-15')).toBe(4);
  });

  it('never reports more than was earned', () => {
    expect(streakOn(at(1, 9, '2026-09-15'), '2026-09-15')).toBe(1);
  });
});

describe('describeStreak', () => {
  it('says nothing at zero', () => {
    expect(describeStreak(0)).toBe('');
  });

  it('counts one day in the singular', () => {
    expect(describeStreak(1)).toBe('1 day in a row');
  });

  it('counts the rest in the plural', () => {
    expect(describeStreak(7)).toBe('7 days in a row');
  });
});

describe('streakTag', () => {
  it('says nothing at zero', () => {
    expect(streakTag(0)).toBe('');
  });

  it('stays short enough to sit beside a label', () => {
    expect(streakTag(1)).toBe('1-day streak');
    expect(streakTag(14)).toBe('14-day streak');
  });
});
