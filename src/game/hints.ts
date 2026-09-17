/** Hints per day. They refill at no cost - a courtesy, not a currency. */
export const DAILY_HINT_ALLOWANCE = 5;

/** The player's own calendar day, so hints refill at their midnight rather than at UTC's. */
export function localDay(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${date}`;
}

/** How long until the player's next local midnight. */
export function msUntilNextDay(now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

function dayAfter(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year!, month! - 1, date! + 1));
}

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
