/** Stars are earned against par, the solver's optimal move count for the level. */
export function starsFor(moves: number, par: number): 0 | 1 | 2 | 3 {
  if (moves <= 0) return 0;
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.25)) return 2;
  return 1;
}

/** Moves still available before the next star is lost. Null once only one star is left. */
export function movesUntilStarLost(moves: number, par: number): number | null {
  if (moves < par) return par - moves;
  const twoStarLimit = Math.ceil(par * 1.25);
  if (moves < twoStarLimit) return twoStarLimit - moves;
  return null;
}

/**
 * The one line under "Board cleared", stating the result as a golfer would.
 *
 * Par carries a small allowance on boards with face-down tokens, so beating it is
 * reachable and worth naming - the old copy spent a three-way branch to say "over par"
 * twice and never acknowledged a round under.
 */
export function verdictFor(moves: number, par: number): string {
  if (moves < par) return `${par - moves} under par`;
  if (moves === par) return 'Par';
  return `${moves - par} over par`;
}
