/**
 * Dev-only switch that opens every chapter and level, so the whole game can be walked on a
 * simulator without solving the way there. Set `EXPO_PUBLIC_UNLOCK_ALL=1` in `.env` (which
 * is untracked) and restart the bundler with a cleared cache.
 *
 * It only opens doors: nothing is written to the save, so stars, records and the daily
 * streak all still read exactly what has actually been played.
 */
export const UNLOCK_ALL =
  process.env.NODE_ENV !== 'production' && process.env.EXPO_PUBLIC_UNLOCK_ALL === '1';
