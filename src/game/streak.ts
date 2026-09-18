import { dayAfter } from './day';

/**
 * Consecutive daily boards solved.
 *
 * Counted in UTC days, because there is exactly one board per UTC day. On the player's own
 * clock the count would be wrong in both directions: east of Greenwich the board turns over
 * mid-evening, so one local day can hold two boards, and west of it two local days can hold
 * solves of the same board. Counting the thing the streak is a streak of keeps it honest,
 * and it agrees with the server, which only accepts a daily result dated UTC today or
 * yesterday.
 *
 * Kept by solving, not by opening the screen. Every board is solvable, restarts are free and
 * undo is five an attempt, so this is never a luck gate - and it is the only event the game
 * already records.
 *
 * There are deliberately no freezes and no repair. A thing you earn, hold and spend is a
 * currency, and this game does not have one.
 */

export interface Streak {
  current: number;
  best: number;
  /** The UTC day of the last board solved, or '' for a player who has solved none. */
  lastDay: string;
}

export const NO_STREAK: Streak = { current: 0, best: 0, lastDay: '' };

/** The streak after solving `day`'s board. Solving the same board again changes nothing. */
export function afterSolving(streak: Streak, day: string): Streak {
  if (streak.lastDay === day) return streak;
  const current = streak.lastDay && dayAfter(streak.lastDay) === day ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastDay: day };
}

/**
 * What the streak reads as on `today`. Never writes: a run that has lapsed simply reads 0,
 * and the next solve starts a new one.
 *
 * A run stays up through the whole day after it was last extended, because today's board is
 * still open and has not been missed yet. A stamp one day AHEAD holds it too - that is a
 * device clock a few hours fast across UTC midnight, the same case `hintsFor` defends
 * against, and treating it as a break would wipe a real run. Nothing can be farmed by
 * winding a clock forward, since extending a run still needs consecutive days.
 */
export function streakOn(streak: Streak, today: string): number {
  if (!streak.lastDay) return 0;
  if (streak.lastDay === today) return streak.current;
  if (dayAfter(streak.lastDay) === today) return streak.current;
  if (dayAfter(today) === streak.lastDay) return streak.current;
  return 0;
}

/** The streak in words, for the screen and for VoiceOver. Empty when there is no run. */
export function describeStreak(days: number): string {
  if (days <= 0) return '';
  return days === 1 ? '1 day in a row' : `${days} days in a row`;
}

/**
 * The streak as a tag beside another label, where `describeStreak`'s sentence would wrap.
 * Kept here so both wordings of the same idea live and are tested in one place.
 */
export function streakTag(days: number): string {
  if (days <= 0) return '';
  return `${days}-day streak`;
}
