/**
 * Calendar days, in the two clocks this game counts in.
 *
 * Hints are a courtesy tied to the player's own day, so they refill at `localDay`'s
 * midnight. The daily board is derived from the UTC date so that everyone in the world
 * plays the same board offline, so anything counting those boards must use `utcDay` or it
 * will disagree with the board it is counting.
 */

/** The player's own calendar day. */
export function localDay(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${date}`;
}

/** The UTC calendar day, which is the one a daily board is keyed on. */
export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** How long until the player's next local midnight. */
export function msUntilNextDay(now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

/**
 * The calendar day after `day`.
 *
 * Arithmetic on the string alone - it never reads the clock - so it is correct for a local
 * day and a UTC day alike. Going through a Date also lets the runtime carry month and year
 * ends, and the hours DST skips, without a table of month lengths here.
 */
export function dayAfter(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year!, month! - 1, date! + 1));
}
