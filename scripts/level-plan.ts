import type { GenerationSpec } from '../src/engine/generator';

/**
 * The level plan, authored by hand.
 *
 * Every level has its OWN spec. The previous curve ramped one spec across a whole
 * chapter, which made thirty levels feel like one level thirty times - the boards
 * differed but the shape of the problem never did.
 *
 * Difficulty is a sawtooth, not a ramp. It rises overall, but every few levels drops
 * into a rest so the climb is felt rather than endured, and each new mechanic is taught
 * on a deliberately easy board before it is ever tested on a hard one.
 *
 * The levers, and what each one changes about how a board *feels*:
 *
 * - `colorCount`  how much there is to keep track of. The main difficulty axis.
 * - `capacity`    how tall a lane is. Three is quick and puzzle-like, five is a long
 *                 commitment where a wrong token buries four others. Changing this
 *                 changes the texture more than adding a colour does.
 * - `emptyLanes`  how much room to manoeuvre. Measured: a one-free-lane board tops out
 *                 around eight moves however hard it is tangled, because the reachable
 *                 state space is genuinely shallow. So these are not the hardest boards -
 *                 they are SHORT and TIGHT, a different texture, and they are labelled
 *                 `tight` rather than pretending to be a difficulty peak.
 * - `hidden`      how much is unknown. Introduced late, and always taught on a board
 *                 that is otherwise easy.
 */

export type Beat = 'teach' | 'build' | 'rest' | 'tight' | 'climax';

export interface LevelPlan {
  n: number;
  /** Narrative role, used to shape the curve and to sanity-check it afterwards. */
  beat: Beat;
  /** Where this level sits in the curve, 0..1. Rises overall, dips at every rest. */
  intensity: number;
  /**
   * Which candidate to take from the ranked pool, 0..1. Defaults to `intensity`.
   *
   * They are separate because a `tight` board's difficulty and its place in the curve
   * disagree: we want the hardest instance the shape can produce, while still admitting
   * the shape itself is a quick one.
   */
  pick?: number;
  spec: GenerationSpec;
  /** Why this level exists. Read the column top to bottom to review the pacing. */
  note: string;
}

function spec(
  colorCount: number,
  capacity: number,
  emptyLanes: number,
  hiddenMin = 0,
  hiddenMax = 0,
  anchors = 0,
  // Anchored lanes are dealt face-up unless this is set, so the anchors of Mantle and
  // Fault stay in sight and Core - the only chapter that sets it - is where the player
  // first meets an anchor they cannot see.
  hideAnchors = false,
): GenerationSpec {
  return {
    capacity,
    colorCount,
    emptyLanes,
    hiddenMin,
    hiddenMax,
    anchors,
    hideAnchors,
    // One free lane is almost never solvable from a random deal, so those boards are
    // built by walking backwards from the finished position instead. dealBoard can place
    // anchors now, so that tightness is the only remaining reason to walk backwards -
    // exactly as before anchors existed.
    strategy: emptyLanes >= 2 ? 'deal' : 'reverse',
    reverseSteps: colorCount * capacity * 4,
  };
}

export interface ChapterPlan {
  n: number;
  name: string;
  color: number;
  levels: LevelPlan[];
}

/** Chapter names follow the water the game is named for, from source to depth. */
export const CHAPTERS: ChapterPlan[] = [
  {
    n: 1,
    name: 'Spring',
    color: 0,
    levels: [
      { n: 1, beat: 'teach', intensity: 0.04, spec: spec(3, 3, 2), note: 'The first pour. Three colours, short lanes, room to spare.' },
      { n: 2, beat: 'teach', intensity: 0.09, spec: spec(3, 3, 2), note: 'Same shape, one step harder. Let the tap-tap rhythm settle.' },
      { n: 3, beat: 'build', intensity: 0.15, spec: spec(3, 4, 2), note: 'Lanes grow to four. Same colours, so only the depth is new.' },
      { n: 4, beat: 'build', intensity: 0.22, spec: spec(4, 4, 2), note: 'A fourth colour.' },
      { n: 5, beat: 'build', intensity: 0.28, spec: spec(4, 4, 2), note: 'Practise four colours before anything is taken away.' },
      { n: 6, beat: 'rest', intensity: 0.18, spec: spec(3, 5, 2), note: 'Breather. Tall lanes, few colours - novel to look at, easy to solve.' },
      { n: 7, beat: 'tight', intensity: 0.30, pick: 1, spec: spec(4, 4, 1), note: 'A single free lane. Short, but one careless move deadlocks it.' },
      { n: 8, beat: 'build', intensity: 0.32, spec: spec(5, 4, 2), note: 'Room returns, a fifth colour arrives.' },
      { n: 9, beat: 'tight', intensity: 0.34, pick: 1, spec: spec(4, 3, 1), note: 'Cramped in both directions. Over quickly, or not at all.' },
      { n: 10, beat: 'climax', intensity: 0.36, pick: 1, spec: spec(5, 4, 2), note: 'Everything the chapter taught, at full size.' },
    ],
  },
  {
    n: 2,
    name: 'Brook',
    color: 1,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.30, spec: spec(5, 4, 2), note: 'Open gently after a chapter climax.' },
      { n: 2, beat: 'build', intensity: 0.38, spec: spec(6, 4, 2), note: 'Six colours.' },
      { n: 3, beat: 'build', intensity: 0.44, spec: spec(5, 5, 2), note: 'Five-deep lanes: a wrong token now buries four.' },
      { n: 4, beat: 'build', intensity: 0.46, spec: spec(6, 4, 2), note: 'Back to four-deep, holding six colours.' },
      { n: 5, beat: 'rest', intensity: 0.24, spec: spec(4, 3, 2), note: 'A short, quick board. Deliberately over in a minute.' },
      { n: 6, beat: 'build', intensity: 0.52, spec: spec(7, 4, 2), note: 'Seven colours.' },
      { n: 7, beat: 'build', intensity: 0.56, spec: spec(6, 5, 2), note: 'Depth and breadth together.' },
      { n: 8, beat: 'tight', intensity: 0.42, pick: 1, spec: spec(5, 4, 1), note: 'Tight again, with five colours. A palate cleanser between long boards.' },
      { n: 9, beat: 'build', intensity: 0.58, spec: spec(7, 4, 2), note: 'Recover with room to work.' },
      { n: 10, beat: 'climax', intensity: 0.66, pick: 1, spec: spec(7, 5, 2), note: 'Seven colours, five deep.' },
    ],
  },
  {
    n: 3,
    name: 'Rapids',
    color: 2,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.46, spec: spec(6, 4, 2), note: 'Settle before the hardest visible boards in the game.' },
      { n: 2, beat: 'build', intensity: 0.54, spec: spec(7, 4, 2), note: '' },
      { n: 3, beat: 'build', intensity: 0.62, spec: spec(8, 4, 2), note: 'Eight colours - the board is now genuinely busy.' },
      { n: 4, beat: 'build', intensity: 0.58, spec: spec(6, 5, 2), note: 'Fewer colours, more depth. Same pressure, different feel.' },
      { n: 5, beat: 'rest', intensity: 0.34, spec: spec(5, 3, 2), note: 'A real breather, and the last one for a while.' },
      { n: 6, beat: 'build', intensity: 0.68, spec: spec(8, 4, 2), note: '' },
      { n: 7, beat: 'build', intensity: 0.70, spec: spec(7, 5, 2), note: '' },
      { n: 8, beat: 'tight', intensity: 0.52, pick: 1, spec: spec(8, 4, 1), note: 'Eight colours, one free lane. Busy to look at, quick to lose.' },
      { n: 9, beat: 'build', intensity: 0.74, spec: spec(9, 4, 2), note: 'The full palette.' },
      { n: 10, beat: 'climax', intensity: 0.82, pick: 1, spec: spec(9, 4, 2), note: 'Nine colours, nothing hidden. The hardest honest board.' },
    ],
  },
  {
    n: 4,
    name: 'Undertow',
    color: 3,
    levels: [
      { n: 1, beat: 'teach', intensity: 0.40, spec: spec(4, 4, 2, 1, 1), note: 'Face-down tokens arrive. Only four colours, so the new idea is the only new thing.' },
      { n: 2, beat: 'build', intensity: 0.48, spec: spec(5, 4, 2, 1, 1), note: 'Practise reading a board you cannot fully see.' },
      { n: 3, beat: 'build', intensity: 0.55, spec: spec(6, 4, 2, 1, 1), note: '' },
      { n: 4, beat: 'build', intensity: 0.60, spec: spec(5, 4, 2, 2, 2), note: 'Two face-down per lane: half the board is unknown.' },
      { n: 5, beat: 'build', intensity: 0.58, spec: spec(6, 5, 2, 1, 1), note: 'Deeper lanes hide their secrets longer.' },
      { n: 6, beat: 'rest', intensity: 0.42, spec: spec(5, 3, 2, 1, 1), note: 'Short lanes reveal quickly. A breather that still uses the mechanic.' },
      { n: 7, beat: 'build', intensity: 0.70, spec: spec(7, 4, 2, 1, 2), note: '' },
      { n: 8, beat: 'build', intensity: 0.72, spec: spec(6, 5, 2, 2, 2), note: '' },
      { n: 9, beat: 'tight', intensity: 0.58, pick: 1, spec: spec(7, 4, 1, 1, 1), note: 'Hidden tokens with one free lane. Guessing wrong ends it immediately.' },
      { n: 10, beat: 'climax', intensity: 0.86, pick: 1, spec: spec(8, 4, 2, 2, 2), note: '' },
    ],
  },
  {
    n: 5,
    name: 'Deep',
    color: 4,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.54, spec: spec(6, 4, 2, 1, 1), note: 'Open the last chapter kindly.' },
      { n: 2, beat: 'build', intensity: 0.66, spec: spec(7, 4, 2, 1, 2), note: '' },
      { n: 3, beat: 'build', intensity: 0.74, spec: spec(8, 4, 2, 1, 2), note: '' },
      { n: 4, beat: 'build', intensity: 0.78, spec: spec(7, 5, 2, 2, 2), note: 'Five deep with two hidden - the longest boards yet.' },
      { n: 5, beat: 'rest', intensity: 0.50, spec: spec(6, 3, 2, 1, 1), note: 'The last breather in the game.' },
      { n: 6, beat: 'build', intensity: 0.84, spec: spec(8, 5, 2, 2, 2), note: '' },
      { n: 7, beat: 'build', intensity: 0.88, spec: spec(9, 4, 2, 2, 2), note: 'Full palette, half of it face-down.' },
      { n: 8, beat: 'build', intensity: 0.92, spec: spec(8, 5, 2, 2, 3), note: '' },
      { n: 9, beat: 'tight', intensity: 0.66, pick: 1, spec: spec(9, 4, 1, 2, 2), note: 'The tightest board in the game: nine colours, one free lane, half unseen.' },
      { n: 10, beat: 'climax', intensity: 1.0, pick: 1, spec: spec(9, 5, 2, 2, 3), note: 'The last board. Nine colours, five deep, mostly unknown.' },
    ],
  },
  {
    n: 6,
    name: 'Bedrock',
    color: 5,
    levels: [
      { n: 1, beat: 'teach', intensity: 0.05, spec: spec(4, 4, 2, 0, 0, 1), note: 'One anchor. That lane can only ever finish in its colour.' },
      { n: 2, beat: 'teach', intensity: 0.10, spec: spec(5, 4, 2, 0, 0, 1), note: 'The same idea with one more colour to place around it.' },
      { n: 3, beat: 'build', intensity: 0.20, spec: spec(5, 4, 2, 0, 0, 2), note: 'Two anchors. Two lanes are now spoken for before a move is made.' },
      { n: 4, beat: 'build', intensity: 0.28, spec: spec(5, 5, 2, 0, 0, 2), note: 'Deeper lanes, so a wrong token buries more beneath it.' },
      { n: 5, beat: 'rest', intensity: 0.15, spec: spec(5, 3, 2, 0, 0, 2), note: 'Short and shallow. A breath before the squeeze.' },
      { n: 6, beat: 'build', intensity: 0.35, spec: spec(6, 4, 2, 0, 0, 2), note: 'Six colours against two anchors.' },
      { n: 7, beat: 'build', intensity: 0.42, spec: spec(6, 5, 2, 0, 0, 3), note: 'Three anchors: half the board is committed.' },
      { n: 8, beat: 'tight', intensity: 0.30, pick: 0.95, spec: spec(5, 4, 1, 0, 0, 2), note: 'One free lane and two anchors. Short, and there is almost nowhere to put anything.' },
      { n: 9, beat: 'build', intensity: 0.50, spec: spec(7, 5, 2, 0, 0, 3), note: 'Seven colours, three anchors.' },
      { n: 10, beat: 'climax', intensity: 0.60, pick: 1.0, spec: spec(7, 5, 2, 0, 0, 4), note: 'Four anchors. More of this board is decided than is free.' },
    ],
  },
  {
    n: 7,
    name: 'Trench',
    color: 6,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.30, spec: spec(6, 4, 2, 0, 0, 2), note: 'Settling in: the anchors are familiar now.' },
      { n: 2, beat: 'build', intensity: 0.42, spec: spec(6, 4, 2, 0, 0, 3), note: 'Three anchors and room to work.' },
      { n: 3, beat: 'build', intensity: 0.50, spec: spec(6, 5, 2, 0, 0, 3), note: 'The same shape, one token deeper.' },
      { n: 4, beat: 'build', intensity: 0.55, spec: spec(7, 5, 2, 0, 0, 4), note: 'Four anchors: the free lanes are the whole game now.' },
      { n: 5, beat: 'rest', intensity: 0.32, spec: spec(6, 3, 2, 0, 0, 3), note: 'Shallow again, briefly.' },
      { n: 6, beat: 'build', intensity: 0.60, spec: spec(7, 4, 2, 0, 0, 4), note: 'Seven colours and four fixed destinations.' },
      { n: 7, beat: 'tight', intensity: 0.45, pick: 0.95, spec: spec(6, 4, 1, 0, 0, 3), note: 'One free lane, three anchors.' },
      { n: 8, beat: 'build', intensity: 0.66, spec: spec(7, 5, 2, 0, 0, 5), note: 'Five anchors. Most of the board is already spoken for.' },
      { n: 9, beat: 'tight', intensity: 0.50, pick: 0.95, spec: spec(6, 5, 1, 0, 0, 4), note: 'The tightest board yet, and four of its lanes cannot move.' },
      { n: 10, beat: 'climax', intensity: 0.72, pick: 1.0, spec: spec(8, 5, 2, 0, 0, 5), note: 'Eight colours, five anchors, two free lanes.' },
    ],
  },
  {
    n: 8,
    name: 'Mantle',
    color: 7,
    levels: [
      { n: 1, beat: 'teach', intensity: 0.40, spec: spec(6, 4, 2, 1, 1, 2), note: 'One face-down token per lane, and the anchors you already know.' },
      { n: 2, beat: 'build', intensity: 0.50, spec: spec(6, 4, 2, 1, 2, 3), note: 'The anchor says what the lane must become; the hidden tokens hide what is in the way.' },
      { n: 3, beat: 'build', intensity: 0.58, spec: spec(6, 5, 2, 1, 2, 3), note: 'Deeper, and less of it visible.' },
      { n: 4, beat: 'rest', intensity: 0.38, spec: spec(6, 3, 2, 1, 1, 2), note: 'A short board to re-read the mechanic on.' },
      { n: 5, beat: 'build', intensity: 0.64, spec: spec(7, 5, 2, 2, 3, 4), note: 'Four anchors under three face-down tokens each.' },
      // Same spec as level 5 - same colours, depth and anchor count - so what makes this
      // one harder is only the deal: a different seed, tangled worse.
      { n: 6, beat: 'build', intensity: 0.70, spec: spec(7, 5, 2, 2, 3, 4), note: 'Same shape as level 5, dealt into a worse tangle.' },
      { n: 7, beat: 'tight', intensity: 0.55, pick: 0.95, spec: spec(6, 4, 1, 1, 2, 3), note: 'One free lane, and you cannot see what is coming.' },
      { n: 8, beat: 'build', intensity: 0.76, spec: spec(8, 5, 2, 3, 4, 4), note: 'Eight colours under the deepest fog a five-deep lane can hold.' },
      { n: 9, beat: 'build', intensity: 0.80, spec: spec(9, 5, 2, 3, 4, 4), note: 'Nine colours arrive a level early, still under four anchors.' },
      // Keeping anchors visible (product decision, so Core stays the only chapter that
      // buries them) leaves fog as the lever for Mantle and Fault both. Measured at
      // colorCount 9, capacity 5, emptyLanes 2, maximum fog (hiddenMin 4 = hiddenMax 4,
      // the most a five-deep lane can hide) across three seeds: anchors 3 hit 266, 262,
      // 256 - one seed under Deep's 258, too close to risk. Anchors 1-2 held 264-277
      // every time. Two anchors, keeping one more than Fault's climax so Fault can still
      // be the harder of the two: hardest measured 270, 264, 276.
      { n: 10, beat: 'climax', intensity: 0.86, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 2), note: 'Nine colours, fog as deep as a lane allows, and only two anchors to lean on.' },
    ],
  },
  {
    n: 9,
    name: 'Fault',
    color: 8,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.55, spec: spec(7, 4, 2, 1, 2, 3), note: 'A gentler opening after the Mantle\'s last board.' },
      { n: 2, beat: 'build', intensity: 0.68, spec: spec(7, 5, 2, 2, 3, 4), note: 'Back to depth.' },
      { n: 3, beat: 'build', intensity: 0.74, spec: spec(8, 5, 2, 2, 3, 5), note: 'Eight colours, five anchors.' },
      { n: 4, beat: 'build', intensity: 0.80, spec: spec(8, 5, 2, 3, 4, 5), note: 'Deeper into the dark.' },
      { n: 5, beat: 'rest', intensity: 0.50, spec: spec(7, 3, 2, 1, 2, 4), note: 'Shallow, and over quickly.' },
      { n: 6, beat: 'build', intensity: 0.85, spec: spec(9, 5, 2, 3, 4, 4), note: 'Nine colours. Four lanes cannot move, and most of the rest are half-buried.' },
      { n: 7, beat: 'tight', intensity: 0.66, pick: 0.95, spec: spec(7, 5, 1, 2, 3, 5), note: 'One free lane against five anchors.' },
      { n: 8, beat: 'build', intensity: 0.89, spec: spec(9, 5, 2, 4, 4, 3), note: 'The hardest ordinary board in the game so far - fog as deep as a lane allows, three anchors holding it together.' },
      { n: 9, beat: 'tight', intensity: 0.70, pick: 0.95, spec: spec(8, 5, 1, 3, 4, 6), note: 'Tight, deep, anchored and blind at once.' },
      // Product decision: keep anchors visible through Mantle and Fault, so Core - where
      // they are buried - is the chapter that introduces that. That costs both chapters
      // the fog an anchored lane used to carry, so the lever left is how many lanes stay
      // fogged at all: fewer anchors, never more, at the deepest fog a five-deep lane can
      // hold (hiddenMin 4 = hiddenMax 4). Measured at colorCount 9, capacity 5, emptyLanes
      // 2 across three seeds: anchors 1 held 277, 268, 274 - clear of Mantle's anchors-2
      // climax (measured 270, 264, 276 at the same shape) and of Deep's 258, and still
      // under Core's 284.
      { n: 10, beat: 'climax', intensity: 0.93, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 1), note: 'One anchor in sight - everything else is fog as deep as a lane allows.' },
    ],
  },
  {
    n: 10,
    name: 'Core',
    color: 9,
    levels: [
      { n: 1, beat: 'teach', intensity: 0.62, spec: spec(6, 4, 2, 1, 2, 2, true), note: 'An anchor you cannot see. You know the lane has a destiny; you must dig to learn it.' },
      { n: 2, beat: 'build', intensity: 0.72, spec: spec(7, 4, 2, 2, 2, 3, true), note: 'Two hidden destinies.' },
      { n: 3, beat: 'build', intensity: 0.80, spec: spec(7, 5, 2, 2, 3, 4, true), note: 'Deeper, and the anchors stay buried longer.' },
      { n: 4, beat: 'rest', intensity: 0.58, spec: spec(6, 3, 2, 1, 2, 3, true), note: 'Short enough to see the whole idea at once.' },
      { n: 5, beat: 'build', intensity: 0.86, spec: spec(8, 5, 2, 3, 4, 5, true), note: 'Five anchors, none of them visible at the start.' },
      { n: 6, beat: 'build', intensity: 0.90, spec: spec(8, 5, 2, 3, 4, 6, true), note: 'Six.' },
      { n: 7, beat: 'tight', intensity: 0.74, pick: 0.95, spec: spec(7, 5, 1, 2, 3, 5, true), note: 'One free lane, and every destination is a guess.' },
      { n: 8, beat: 'build', intensity: 0.94, spec: spec(9, 5, 2, 4, 4, 6, true), note: 'Nine colours, six buried anchors.' },
      { n: 9, beat: 'tight', intensity: 0.80, pick: 0.95, spec: spec(8, 5, 1, 3, 4, 6, true), note: 'The last tight board.' },
      // Core is the arc's final chapter and must top Fault's climax (294) clearly, not by
      // the single point seven anchors left it short by. `emptyLanes: 1` - measured as the
      // sharpest lever there is - was tried first, at colorCount 9, capacity 5, maximum
      // fog and anchors reduced to 3: it capped at difficulty 171, because a reverse-walked
      // board is short by construction (mean optimal ~18) however tangled its walk, so the
      // sharpest lever on paper is the wrong tool at this size. Falling back to
      // `emptyLanes: 2` with `anchors: 3` - fewer anchors, not more, per the measurement
      // that a heavily anchored board is more determined and therefore easier - reaches
      // 295: the summit, ahead of Fault, by construction rather than luck.
      { n: 10, beat: 'climax', intensity: 1.0, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 3, true), note: 'The floor of the world. Nine colours, none of them visible, and only three anchors - a board this open asks more than one that is mostly decided.' },
    ],
  },

  // The forge arc, chapters 11-15. No new rule: each chapter poses a different shape of
  // problem with the pieces the player already has, and level 10 of each is a gate that
  // stands clear of everything before it.
  //
  // The spec ordered the arc Ore, Smelt, Anvil, Temper, Alloy. Measured gates at 8M nodes
  // put wide-and-shallow Smelt's ceiling at 181 (nine colours, capacity 3, the most fog a
  // three-deep lane can hold) against uneven-fog Ore's 250-254, and the peak must rise
  // through an arc - so Smelt opens it and Ore follows. Each name moved with its identity.
  {
    n: 11,
    name: 'Smelt',
    color: 10,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.20, spec: spec(7, 3, 2, 0, 1, 1), note: 'Wide and shallow. Seven colours, three deep: mistakes are cheap and quick to undo.' },
      { n: 2, beat: 'build', intensity: 0.35, spec: spec(7, 3, 2, 1, 2, 1, true), note: 'The same width, with the anchor buried.' },
      { n: 3, beat: 'build', intensity: 0.45, spec: spec(8, 3, 2, 0, 1, 2), note: 'Eight colours across short lanes.' },
      { n: 4, beat: 'rest', intensity: 0.25, spec: spec(7, 3, 2, 1, 1, 1), note: 'A breath: one face-down token per lane.' },
      { n: 5, beat: 'build', intensity: 0.55, spec: spec(8, 3, 2, 1, 2, 2, true), note: 'Two buried anchors among eight colours.' },
      { n: 6, beat: 'build', intensity: 0.65, spec: spec(9, 3, 2, 1, 1, 2, true), note: 'The full palette, three deep.' },
      { n: 7, beat: 'tight', intensity: 0.50, pick: 0.95, spec: spec(9, 3, 1, 1, 2, 2, true), note: 'Nine short lanes and one free one. Busy, and over fast.' },
      { n: 8, beat: 'build', intensity: 0.75, spec: spec(9, 3, 2, 2, 2, 3, true), note: 'Every lane as dark as three-deep allows.' },
      { n: 9, beat: 'rest', intensity: 0.45, spec: spec(8, 3, 2, 0, 1, 2), note: 'Shallow and mostly visible, before the gate.' },
      // Measured at this slot, 24 candidates at 8M nodes: 181, p90 174, median 160. One
      // buried anchor rather than three keeps the board from settling its own lanes.
      { n: 10, beat: 'climax', intensity: 0.85, pick: 1.0, spec: spec(9, 3, 2, 2, 2, 1, true), note: 'Gate. Nine colours, every lane half-dark, one anchor you have to dig for.' },
    ],
  },
  {
    n: 12,
    name: 'Ore',
    color: 11,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.45, spec: spec(6, 4, 2, 0, 3, 2), note: 'Uneven fog. Some lanes read plainly, some not at all - plan outward from what you can see.' },
      { n: 2, beat: 'build', intensity: 0.55, spec: spec(7, 4, 2, 0, 3, 2), note: 'Seven colours, with the clear lanes as your footing.' },
      { n: 3, beat: 'build', intensity: 0.62, spec: spec(7, 5, 2, 0, 4, 2), note: 'Five deep: the dark lanes hide up to four.' },
      { n: 4, beat: 'rest', intensity: 0.40, spec: spec(6, 4, 2, 0, 3, 3), note: 'Three anchors in sight, so most of the board is already decided.' },
      { n: 5, beat: 'build', intensity: 0.68, spec: spec(8, 4, 2, 0, 3, 2), note: 'Eight colours.' },
      { n: 6, beat: 'tight', intensity: 0.55, pick: 0.95, spec: spec(7, 4, 1, 0, 3, 2), note: 'One free lane, and you cannot see into half the others.' },
      { n: 7, beat: 'build', intensity: 0.74, spec: spec(8, 5, 2, 0, 4, 3), note: 'Deep lanes, some clear, some black.' },
      { n: 8, beat: 'build', intensity: 0.80, spec: spec(9, 4, 2, 0, 3, 2), note: 'The full palette over uneven fog.' },
      { n: 9, beat: 'rest', intensity: 0.50, spec: spec(7, 4, 2, 0, 3, 3), note: 'A readable board before the gate.' },
      { n: 10, beat: 'climax', intensity: 0.90, pick: 1.0, spec: spec(8, 5, 2, 0, 4, 2), note: 'Gate. Eight colours five deep, and only the fog decides which lanes you can read.' },
    ],
  },
  {
    n: 13,
    name: 'Anvil',
    color: 12,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.45, spec: spec(5, 5, 2, 2, 3, 2, true), note: 'Deep and narrow. Few colours, but a wrong token buries four.' },
      { n: 2, beat: 'build', intensity: 0.55, spec: spec(6, 5, 2, 2, 3, 2, true), note: 'Six colours, five deep.' },
      { n: 3, beat: 'tight', intensity: 0.50, pick: 0.95, spec: spec(6, 5, 1, 2, 3, 2, true), note: 'One free lane under a five-deep stack.' },
      { n: 4, beat: 'build', intensity: 0.62, spec: spec(6, 5, 2, 3, 4, 2, true), note: 'The fog sinks to the bottom of every lane.' },
      { n: 5, beat: 'rest', intensity: 0.40, spec: spec(5, 5, 2, 2, 3, 1, true), note: 'Five colours again, briefly.' },
      { n: 6, beat: 'build', intensity: 0.70, spec: spec(7, 5, 2, 2, 3, 2, true), note: 'Seven colours - as wide as this chapter gets.' },
      { n: 7, beat: 'tight', intensity: 0.58, pick: 0.95, spec: spec(7, 5, 1, 3, 4, 3, true), note: 'Tight and deep at once.' },
      { n: 8, beat: 'build', intensity: 0.76, spec: spec(7, 5, 2, 3, 4, 2, true), note: 'Seven colours, nearly all of them face-down.' },
      { n: 9, beat: 'rest', intensity: 0.55, spec: spec(6, 5, 2, 2, 3, 2, true), note: 'Room to breathe before the gate.' },
      // Measured at this slot, 24 candidates at 8M nodes: 237, p90 229, median 220.
      { n: 10, beat: 'climax', intensity: 0.92, pick: 1.0, spec: spec(7, 5, 2, 4, 4, 1, true), note: 'Gate. Seven colours, the deepest fog a lane can hold, and one buried anchor.' },
    ],
  },
  {
    n: 14,
    name: 'Temper',
    color: 13,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.50, spec: spec(9, 3, 2, 2, 2, 6), note: 'Mostly determined: six of nine lanes are anchored, and every other lane is fogged.' },
      { n: 2, beat: 'build', intensity: 0.58, spec: spec(9, 4, 2, 3, 3, 6), note: 'Four deep. The anchors tell you where; the fog hides how.' },
      { n: 3, beat: 'build', intensity: 0.64, spec: spec(8, 5, 2, 4, 4, 5), note: 'Five anchors of eight, over the deepest fog.' },
      { n: 4, beat: 'rest', intensity: 0.45, spec: spec(9, 3, 2, 2, 2, 7), note: 'Seven anchors. Almost nothing is left to decide.' },
      { n: 5, beat: 'build', intensity: 0.70, spec: spec(9, 5, 2, 4, 4, 7), note: 'Seven anchors, nine colours, five deep.' },
      { n: 6, beat: 'tight', intensity: 0.60, pick: 0.95, spec: spec(9, 4, 1, 3, 3, 6), note: 'One free lane, and six lanes that will never move.' },
      { n: 7, beat: 'build', intensity: 0.74, spec: spec(8, 4, 2, 3, 3, 5), note: 'Every destination known, the order anything but.' },
      { n: 8, beat: 'build', intensity: 0.80, spec: spec(9, 5, 2, 4, 4, 7), note: 'The deepest fog, held in place by seven anchors.' },
      { n: 9, beat: 'rest', intensity: 0.55, spec: spec(8, 3, 2, 2, 2, 5), note: 'Short lanes before the gate.' },
      // Temper's anchors stay in sight. Measured at this slot, 24 candidates at 8M nodes,
      // with six anchors buried the gate reached 307 and seven reached 303 - above Alloy's
      // 291, which must top the arc. In sight, six anchors reached 251, between Anvil and
      // Alloy where the curve needs it: visible anchors lift the fog off their own lanes.
      { n: 10, beat: 'climax', intensity: 0.94, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 6), note: 'Gate. Nine colours, six anchors, and fog as deep as it goes on every lane they do not hold.' },
    ],
  },
  {
    n: 15,
    name: 'Alloy',
    color: 14,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.55, spec: spec(7, 4, 2, 3, 3, 1, true), note: 'Barely determined. One buried anchor, and fog over nearly every token.' },
      { n: 2, beat: 'build', intensity: 0.62, spec: spec(8, 4, 2, 3, 3, 1, true), note: 'Eight colours and almost nothing to hold on to.' },
      { n: 3, beat: 'build', intensity: 0.70, spec: spec(7, 5, 2, 3, 4, 1, true), note: 'Five deep: the discovery takes longer.' },
      { n: 4, beat: 'tight', intensity: 0.60, pick: 0.95, spec: spec(8, 5, 1, 3, 4, 1, true), note: 'One free lane, blind.' },
      { n: 5, beat: 'build', intensity: 0.76, spec: spec(9, 4, 2, 3, 3, 1, true), note: 'Nine colours.' },
      { n: 6, beat: 'build', intensity: 0.80, spec: spec(8, 5, 2, 3, 4, 1, true), note: '' },
      { n: 7, beat: 'tight', intensity: 0.66, pick: 0.95, spec: spec(9, 5, 1, 3, 4, 1, true), note: 'Nine colours, one free lane, and you can see almost none of it.' },
      { n: 8, beat: 'build', intensity: 0.86, spec: spec(9, 5, 2, 3, 4, 1, true), note: 'The hardest ordinary board of the forge.' },
      { n: 9, beat: 'rest', intensity: 0.60, spec: spec(7, 4, 2, 3, 3, 1, true), note: 'A smaller board before the last gate of the arc.' },
      // The forge arc's summit, and it must clear the stone arc's 284. Measured at this
      // slot, 24 candidates at 8M nodes: 291, p90 284, median 276. Fog 3-4 instead of a
      // flat 4 topped out at 279. The spec keeps the hardest outliers in reserve for the
      // light arc, so this aims only just past the stone arc.
      { n: 10, beat: 'climax', intensity: 1.0, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 1, true), note: 'Gate. Nine colours, every lane as dark as it goes, one buried anchor. The top of the forge.' },
    ],
  },

  // The light arc, chapters 16-20. Its gates search 48 candidates each, and must climb
  // past the forge's 291 by its last chapter.
  //
  // Measured on this project, at the deepest fog a five-deep lane holds, burying more
  // anchors makes a gate HARDER, not easier: at 8M nodes, one buried anchor peaked at
  // 293-301 across these slots, two at 299-302, six at 303-315. Fewer anchors made boards
  // harder only while those anchors stayed in sight, where every anchor lifts the fog off
  // its own lane. So the light gates escalate by burying more anchors, not fewer.
  {
    n: 16,
    name: 'Ember',
    color: 15,
    levels: [
      { n: 1, beat: 'tight', intensity: 0.50, pick: 0.9, spec: spec(6, 5, 1, 3, 4, 2, true), note: 'The vice. One free lane, from the very first move.' },
      { n: 2, beat: 'build', intensity: 0.60, spec: spec(7, 4, 2, 3, 3, 2, true), note: 'Room returns, briefly.' },
      { n: 3, beat: 'tight', intensity: 0.56, pick: 0.95, spec: spec(7, 5, 1, 3, 4, 2, true), note: 'Seven colours pressed into one free lane.' },
      { n: 4, beat: 'build', intensity: 0.66, spec: spec(8, 4, 2, 3, 3, 2, true), note: '' },
      { n: 5, beat: 'tight', intensity: 0.58, pick: 0.95, spec: spec(8, 4, 1, 3, 3, 2, true), note: 'Short lanes, no slack.' },
      { n: 6, beat: 'build', intensity: 0.74, spec: spec(8, 5, 2, 3, 4, 2, true), note: 'Five deep with two free lanes - the most room this chapter gives.' },
      { n: 7, beat: 'tight', intensity: 0.62, pick: 0.95, spec: spec(9, 4, 1, 3, 3, 2, true), note: 'The full palette in the vice.' },
      { n: 8, beat: 'tight', intensity: 0.66, pick: 0.95, spec: spec(8, 5, 1, 3, 4, 3, true), note: 'Deep, blind, and one free lane.' },
      { n: 9, beat: 'rest', intensity: 0.50, spec: spec(7, 3, 2, 1, 2, 2, true), note: 'The vice opens before the gate.' },
      // The arc's opening gate must sit under Spark's. Measured at this slot, 48 candidates
      // at 8M nodes: one buried anchor 301, fog 3-4 290, two anchors in sight 279.
      { n: 10, beat: 'climax', intensity: 0.85, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 2), note: 'Gate. Out of the vice at last - and into nine colours under the deepest fog.' },
    ],
  },
  {
    n: 17,
    name: 'Spark',
    color: 16,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.50, spec: spec(9, 3, 2, 0, 1, 2), note: 'Full palette, on every board in this chapter. Short lanes to start.' },
      { n: 2, beat: 'build', intensity: 0.60, spec: spec(9, 4, 2, 2, 3, 2, true), note: 'Nine colours, four deep.' },
      { n: 3, beat: 'build', intensity: 0.66, spec: spec(9, 4, 2, 3, 3, 1, true), note: 'One anchor to hold nine colours.' },
      { n: 4, beat: 'tight', intensity: 0.58, pick: 0.95, spec: spec(9, 4, 1, 2, 3, 2, true), note: 'Nine colours, one free lane.' },
      { n: 5, beat: 'build', intensity: 0.72, spec: spec(9, 5, 2, 2, 3, 2, true), note: 'Five deep, with the fog kept shallow.' },
      { n: 6, beat: 'rest', intensity: 0.50, spec: spec(9, 3, 2, 2, 2, 2, true), note: 'Short lanes again.' },
      { n: 7, beat: 'build', intensity: 0.78, spec: spec(9, 5, 2, 3, 4, 2, true), note: 'The fog sinks deeper.' },
      { n: 8, beat: 'build', intensity: 0.82, spec: spec(9, 5, 2, 3, 4, 3, true), note: 'Three buried anchors among nine colours.' },
      { n: 9, beat: 'rest', intensity: 0.55, spec: spec(9, 4, 2, 1, 2, 2), note: 'Anchors in sight before the gate.' },
      // Measured at this slot, 48 candidates at 8M nodes: 300. Two buried anchors reached
      // 302, which Flare's gate (303) would clear by too little to trust a retune.
      { n: 10, beat: 'climax', intensity: 0.88, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 1, true), note: 'Gate. Nine colours, the deepest fog, one anchor somewhere underneath.' },
    ],
  },
  {
    n: 18,
    name: 'Flare',
    color: 17,
    levels: [
      { n: 1, beat: 'tight', intensity: 0.55, pick: 0.95, spec: spec(8, 5, 1, 3, 4, 3, true), note: 'Reverse-walked: short, cramped, exact.' },
      { n: 2, beat: 'tight', intensity: 0.58, pick: 0.95, spec: spec(9, 4, 1, 3, 3, 3, true), note: 'Nine colours, one free lane.' },
      { n: 3, beat: 'build', intensity: 0.72, spec: spec(9, 5, 2, 3, 4, 4, true), note: 'Room to work, and a long way to go.' },
      { n: 4, beat: 'tight', intensity: 0.64, pick: 0.95, spec: spec(9, 5, 1, 4, 4, 3, true), note: 'The tightest shape there is, as dark as it goes.' },
      { n: 5, beat: 'tight', intensity: 0.60, pick: 0.95, spec: spec(7, 5, 1, 4, 4, 4, true), note: 'Fewer colours, four of them buried in place.' },
      { n: 6, beat: 'build', intensity: 0.80, spec: spec(9, 5, 2, 3, 4, 5, true), note: 'Five buried anchors.' },
      { n: 7, beat: 'tight', intensity: 0.66, pick: 0.95, spec: spec(8, 4, 1, 3, 3, 4, true), note: '' },
      // Reverse-walked boards cap short: nine colours, capacity 5 and one free lane
      // measured 174 at most. So Flare's identity lives in its tight beats, and its builds
      // and gate are dealt with two free lanes so its peak can still clear Spark's.
      { n: 8, beat: 'tight', intensity: 0.70, pick: 1.0, spec: spec(9, 5, 1, 4, 4, 2, true), note: 'The hardest tight board the generator can find.' },
      { n: 9, beat: 'rest', intensity: 0.50, spec: spec(7, 3, 2, 2, 2, 3, true), note: 'Short and shallow before the gate.' },
      // Measured at this slot, 48 candidates at 8M nodes: six buried anchors 303, two 301.
      { n: 10, beat: 'climax', intensity: 0.92, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 6, true), note: 'Gate. Two free lanes after a chapter of one - and six buried anchors to use them on.' },
    ],
  },
  {
    n: 19,
    name: 'Corona',
    color: 18,
    levels: [
      { n: 1, beat: 'rest', intensity: 0.55, spec: spec(8, 4, 2, 1, 2, 3, true), note: 'Compound: every lever in this game, one at a time and then together.' },
      { n: 2, beat: 'build', intensity: 0.66, spec: spec(9, 4, 2, 3, 3, 4, true), note: 'Four buried anchors.' },
      { n: 3, beat: 'tight', intensity: 0.60, pick: 0.95, spec: spec(9, 5, 1, 4, 4, 4, true), note: 'One free lane, nine colours, the deepest fog.' },
      { n: 4, beat: 'build', intensity: 0.74, spec: spec(8, 5, 2, 4, 4, 4, true), note: '' },
      { n: 5, beat: 'rest', intensity: 0.55, spec: spec(9, 3, 2, 2, 2, 4, true), note: 'Shallow, briefly.' },
      { n: 6, beat: 'build', intensity: 0.80, spec: spec(9, 5, 2, 3, 4, 5, true), note: 'Five buried anchors, five deep.' },
      { n: 7, beat: 'tight', intensity: 0.70, pick: 1.0, spec: spec(9, 5, 1, 4, 4, 5, true), note: 'Tight, deep, blind and anchored at once.' },
      { n: 8, beat: 'build', intensity: 0.84, spec: spec(9, 5, 2, 4, 4, 3, true), note: 'The hardest ordinary board of the arc so far.' },
      { n: 9, beat: 'rest', intensity: 0.60, spec: spec(8, 4, 2, 3, 3, 3, true), note: 'A smaller board before the gate.' },
      // Measured at this slot, 48 candidates at 8M nodes: seven buried anchors 306, six 305.
      { n: 10, beat: 'climax', intensity: 0.96, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 7, true), note: 'Gate. Seven of nine lanes anchored, and not one anchor in sight.' },
    ],
  },
  {
    n: 20,
    name: 'Zenith',
    color: 19,
    levels: [
      // Zenith is the summit, but it still keeps six board shapes and the house rests at
      // levels 6 and 9, so its ordinary levels pick high in their pools rather than all
      // sharing the one hardest shape.
      { n: 1, beat: 'rest', intensity: 0.70, spec: spec(8, 5, 2, 4, 4, 3, true), note: 'The summit. Even the opening board is dark to the bottom.' },
      { n: 2, beat: 'build', intensity: 0.86, spec: spec(9, 5, 2, 4, 4, 2, true), note: '' },
      { n: 3, beat: 'build', intensity: 0.84, spec: spec(9, 4, 2, 3, 3, 4, true), note: 'Four deep, four buried anchors.' },
      { n: 4, beat: 'tight', intensity: 0.80, pick: 1.0, spec: spec(9, 5, 1, 4, 4, 3, true), note: 'The hardest tight board of the game.' },
      { n: 5, beat: 'build', intensity: 0.90, spec: spec(9, 5, 2, 4, 4, 5, true), note: 'Five buried anchors.' },
      { n: 6, beat: 'rest', intensity: 0.70, spec: spec(9, 3, 2, 2, 2, 5, true), note: 'Shallow, and still nine colours.' },
      { n: 7, beat: 'tight', intensity: 0.82, pick: 1.0, spec: spec(9, 4, 1, 3, 3, 4, true), note: '' },
      { n: 8, beat: 'build', intensity: 0.94, spec: spec(9, 5, 2, 4, 4, 7, true), note: 'Seven buried anchors. The last ordinary board.' },
      { n: 9, beat: 'rest', intensity: 0.70, spec: spec(8, 4, 2, 3, 3, 4, true), note: 'One breath before the last level in the game.' },
      // The hardest board in the game. Measured at this slot, 48 candidates at 8M nodes:
      // six buried anchors 315, seven 303, one 293.
      { n: 10, beat: 'climax', intensity: 1.0, pick: 1.0, spec: spec(9, 5, 2, 4, 4, 6, true), note: 'Gate, and the end. Nine colours, six buried anchors, fog to the floor of every lane.' },
    ],
  },
];

export const TOTAL_LEVELS = CHAPTERS.reduce((sum, c) => sum + c.levels.length, 0);
