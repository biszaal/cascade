import { dayAfter } from './day';

/** Hints per day. They refill at no cost - a courtesy, not a currency. */
export const DAILY_HINT_ALLOWANCE = 5;

/**
 * Hints left on `day`: whatever remains from earlier that day, or a full allowance on a new one.
 *
 * A count stamped one day AHEAD is not a new day either. Earlier builds stamped the UTC
 * date, which runs a day ahead of the local one in the evening west of Greenwich, and a
 * flight west can put the clock back across midnight - refilling for either would hand out
 * an extra allowance. Anything further ahead is a clock that was wound forward, and
 * refilling there beats locking the player out of hints until the calendar catches up.
 */
export function hintsFor(remaining: number | undefined, resetOn: string | undefined, day: string): number {
  if (resetOn !== day && resetOn !== dayAfter(day)) return DAILY_HINT_ALLOWANCE;
  return remaining ?? DAILY_HINT_ALLOWANCE;
}
