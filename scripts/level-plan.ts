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
): GenerationSpec {
  return {
    capacity,
    colorCount,
    emptyLanes,
    hiddenMin,
    hiddenMax,
    anchors,
    // One free lane is almost never solvable from a random deal, so those boards are
    // built by walking backwards from the finished position instead. Anchors force the
    // same choice at any shape: dealBoard cannot place them, so a dealt anchored board
    // would silently ship with no anchors at all.
    strategy: emptyLanes >= 2 && anchors === 0 ? 'deal' : 'reverse',
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
      { n: 10, beat: 'climax', intensity: 0.60, spec: spec(7, 5, 2, 0, 0, 4), note: 'Four anchors. More of this board is decided than is free.' },
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
      { n: 10, beat: 'climax', intensity: 0.72, spec: spec(8, 5, 2, 0, 0, 5), note: 'Eight colours, five anchors, two free lanes.' },
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
      { n: 6, beat: 'build', intensity: 0.70, spec: spec(7, 5, 2, 2, 3, 4), note: 'The same, tangled further.' },
      { n: 7, beat: 'tight', intensity: 0.55, pick: 0.95, spec: spec(6, 4, 1, 1, 2, 3), note: 'One free lane, and you cannot see what is coming.' },
      { n: 8, beat: 'build', intensity: 0.75, spec: spec(8, 5, 2, 2, 3, 5), note: 'Eight colours, five of them already assigned.' },
      { n: 9, beat: 'build', intensity: 0.78, spec: spec(8, 5, 2, 3, 4, 5), note: 'Almost nothing on this board is visible.' },
      { n: 10, beat: 'climax', intensity: 0.84, spec: spec(8, 5, 2, 3, 4, 6), note: 'Six anchors. The board is mostly decided and mostly unseen.' },
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
      { n: 6, beat: 'build', intensity: 0.84, spec: spec(9, 5, 2, 3, 4, 6), note: 'Nine colours. Six lanes cannot move.' },
      { n: 7, beat: 'tight', intensity: 0.66, pick: 0.95, spec: spec(7, 5, 1, 2, 3, 5), note: 'One free lane against five anchors.' },
      { n: 8, beat: 'build', intensity: 0.88, spec: spec(9, 5, 2, 3, 4, 6), note: 'The hardest ordinary board in the game so far.' },
      { n: 9, beat: 'tight', intensity: 0.70, pick: 0.95, spec: spec(8, 5, 1, 3, 4, 6), note: 'Tight, deep, anchored and blind at once.' },
      { n: 10, beat: 'climax', intensity: 0.92, spec: spec(9, 5, 2, 4, 4, 7), note: 'Seven anchors under four face-down tokens each.' },
    ],
  },
  {
    n: 10,
    name: 'Core',
    color: 9,
    levels: [
      { n: 1, beat: 'teach', intensity: 0.62, spec: spec(6, 4, 2, 1, 2, 2), note: 'An anchor you cannot see. You know the lane has a destiny; you must dig to learn it.' },
      { n: 2, beat: 'build', intensity: 0.72, spec: spec(7, 4, 2, 2, 2, 3), note: 'Two hidden destinies.' },
      { n: 3, beat: 'build', intensity: 0.80, spec: spec(7, 5, 2, 2, 3, 4), note: 'Deeper, and the anchors stay buried longer.' },
      { n: 4, beat: 'rest', intensity: 0.58, spec: spec(6, 3, 2, 1, 2, 3), note: 'Short enough to see the whole idea at once.' },
      { n: 5, beat: 'build', intensity: 0.86, spec: spec(8, 5, 2, 3, 4, 5), note: 'Five anchors, none of them visible at the start.' },
      { n: 6, beat: 'build', intensity: 0.90, spec: spec(8, 5, 2, 3, 4, 6), note: 'Six.' },
      { n: 7, beat: 'tight', intensity: 0.74, pick: 0.95, spec: spec(7, 5, 1, 2, 3, 5), note: 'One free lane, and every destination is a guess.' },
      { n: 8, beat: 'build', intensity: 0.94, spec: spec(9, 5, 2, 4, 4, 6), note: 'Nine colours, six buried anchors.' },
      { n: 9, beat: 'tight', intensity: 0.80, pick: 0.95, spec: spec(8, 5, 1, 3, 4, 6), note: 'The last tight board.' },
      { n: 10, beat: 'climax', intensity: 1.0, spec: spec(9, 5, 2, 4, 4, 7), note: 'The floor of the world. Nine colours, seven anchors, none of them visible.' },
    ],
  },
];

export const TOTAL_LEVELS = CHAPTERS.reduce((sum, c) => sum + c.levels.length, 0);
