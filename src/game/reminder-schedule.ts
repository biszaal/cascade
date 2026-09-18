import { utcDay } from './day';

/**
 * When the daily reminder should next fire.
 *
 * Pure, and deliberately free of any expo-notifications import: that package does not load in
 * the node test environment, and this is the half worth testing.
 *
 * The window is a rolling list of one-shot instants rather than a repeating daily trigger,
 * because a repeating trigger cannot be conditional - it would fire on a day the player had
 * already solved. Rescheduling the whole window instead makes the caller idempotent.
 */
export function reminderDates(
  now: Date,
  hour: number,
  minute: number,
  lastSolvedUtcDay: string,
  days = 7,
): Date[] {
  const dates: Date[] = [];
  // Only the first day or two can ever be skipped - a future day cannot already be solved -
  // but expressing it as a filter over the window keeps it one rule instead of two.
  for (let offset = 0; dates.length < days && offset < days + 2; offset++) {
    // Built from wall-clock parts, so 19:00 stays 19:00 on both sides of a daylight-saving
    // change, which is what someone who picked 19:00 expects.
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    if (utcDay(at) === lastSolvedUtcDay) continue;
    dates.push(at);
  }
  return dates;
}
