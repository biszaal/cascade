/**
 * The rebound a token makes after it drops into a lane.
 *
 * A disc that arrives and simply stops reads as a value being assigned. A disc that
 * bounces reads as an object landing in a well, which is what the board is pretending to
 * be - so a pour ends with two hops, the second a quarter of the first, and a squash at
 * each touchdown.
 *
 * Kept as plain maths rather than a stack of springs so the whole shape of the landing is
 * one function to read, and so it can be tested without a renderer.
 */

/** Where in the phase the first hop touches down, and where the second does. */
const FIRST_END = 0.55;
const SECOND_END = 0.85;

/** Peak height of each hop, in points above the lane's resting slot. */
const FIRST_HEIGHT = 11;
const SECOND_HEIGHT = 4;

/** How hard each touchdown squashes the disc, as a fraction of a full impact. */
const FIRST_IMPACT = 1;
const SECOND_IMPACT = 0.45;

/**
 * How much of the phase a squash takes to release. Wide enough that a touchdown always
 * lands on a drawn frame - a one-frame squash is a flicker, not a landing.
 */
const IMPACT_FADE = 0.16;

export interface Bounce {
  /** Points above the resting position. Never negative: the lane floor is solid. */
  rebound: number;
  /** 0 to 1. How compressed the disc is against whatever it just hit. */
  impact: number;
}

/**
 * The disc's state at `phase`, which runs 0 to 1 from the moment the pour lands. Outside
 * that range the token is simply at rest, so a disc that is not bouncing costs nothing.
 */
export function bounceAt(phase: number): Bounce {
  'worklet';
  if (phase <= 0 || phase >= 1) return { rebound: 0, impact: 0 };

  let rebound = 0;
  if (phase < FIRST_END) {
    rebound = FIRST_HEIGHT * Math.sin(Math.PI * (phase / FIRST_END));
  } else if (phase < SECOND_END) {
    rebound = SECOND_HEIGHT * Math.sin(Math.PI * ((phase - FIRST_END) / (SECOND_END - FIRST_END)));
  }

  // The squash is pinned to the touchdowns rather than to the height, so it peaks on
  // contact and lets go as the disc lifts off again.
  let impact = 0;
  if (phase >= SECOND_END) {
    impact = SECOND_IMPACT * (1 - (phase - SECOND_END) / (1 - SECOND_END));
  } else if (phase >= FIRST_END && phase < FIRST_END + IMPACT_FADE) {
    impact = FIRST_IMPACT * (1 - (phase - FIRST_END) / IMPACT_FADE);
  }

  return { rebound, impact };
}
