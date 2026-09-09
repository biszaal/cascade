# Anchored tokens, and chapters 6-10

**Date:** 2026-09-09
**Status:** approved, not yet implemented

## Problem

The game has 50 levels across five chapters. Level 50 runs nine colours, five deep, eleven
lanes, twenty-six face-down tokens, and a forty-nine move optimal solution. Every knob the
engine exposes is at or near its ceiling:

| Chapter | Colours | Capacity | Lanes | Hidden |
|---------|---------|----------|-------|--------|
| 1       | 3-5     | 3-5      | 5-7   | 0      |
| 2       | 4-7     | 3-5      | 6-9   | 0      |
| 3       | 5-9     | 3-5      | 7-11  | 0      |
| 4       | 4-8     | 3-5      | 6-10  | 4-16   |
| 5       | 6-9     | 3-5      | 8-11  | 6-26   |

Fifty more levels cannot come from turning those knobs further. More than eleven lanes stops
fitting a phone; more than nine colours breaks the colourblind-safe palette; deeper boards
produce longer solutions, and a sixty-move solution is tedium rather than difficulty. Scaling
would produce fifty levels that feel like levels the player has already beaten.

Chapters 6-10 therefore need a new rule.

## Goals

- One new mechanic, taught and mastered across fifty levels.
- Chapters 1-5 unchanged, byte for byte, including every par.
- Par stays provably optimal. The IDA* solver's admissibility is preserved and tested.
- The mechanic is describable to a screen reader and legible without colour.

## Non-goals

- Wild tokens and locked lanes. Both remain deferred; the rationale for preferring anchors
  over them is recorded below.
- Any change to scoring, progression, or the daily challenge.
- New art beyond the anchor's own treatment.

## The mechanic: anchored tokens

An **anchored token** occupies index 0 of a lane and can never move. That lane can therefore
only ever be completed in the anchor's colour.

The whole rule is one clause in `canMove`: refuse a move whose source lane is anchored and
holds exactly one token. An anchor is only ever the top of its lane when it is the last token
there, so that single clause makes it immovable without a special case anywhere else.

`isSolved` needs no change. It already requires every non-empty lane to be full and uniform;
since the anchor is the base, a uniform full anchored lane is necessarily the anchor's colour.

### Why anchors rather than wilds or locked lanes

The solver is IDA* with an admissible heuristic, and `solver.ts` states the stakes: it computes
each level's optimal move count at build time and that number becomes par, so an error there
misprices every level in the game. Admissible means never overestimating.

- **Anchors.** `misplacedTokens` counts tokens above the bottom unbroken single-colour run. An
  anchor is the base of that run, so it is correctly never counted, and it correctly never
  needs to move. The heuristic stays admissible **unchanged**. Anchors also *remove* legal
  moves, so the search space shrinks and generation gets faster.
- **Locked lanes.** Tokens in a permanently locked lane never move, but the heuristic counts
  them as needing to, which **overestimates** and breaks admissibility. Safe only if locked
  lanes are always empty - a subtle constraint whose violation is silent.
- **Wild tokens.** A wild can legitimately stay where it is, so counting it as misplaced
  **overestimates** too. Needs a reworked heuristic and widens branching. Wilds also tend to
  make puzzles easier, which is the opposite of the requirement.

### Why it is a difficulty lever, not decoration

`level-plan.ts` records that `emptyLanes` is "the sharpest difficulty lever there is" - free
lanes are the resource the whole genre trades in. An anchored lane can never become empty, so
it permanently withholds that resource while still occupying screen space. Anchors attack the
same resource locked lanes would, without the admissibility cost.

Anchors also compose with hidden tokens in a way neither mechanic reaches alone: the anchor
tells the player *what a lane must become* while the face-down tokens hide *what is in the
way*. Knowing the destination but not the obstacles is a better puzzle than knowing neither.

## Invariants

1. **One anchor per colour, board-wide.** `isSolved` requires each lane to be full and uniform,
   so each colour ends in exactly one lane. Two lanes anchored to the same colour is
   unsolvable by construction. The generator must enforce this.
2. **Anchors sit at index 0 only.** An anchor elsewhere would trap tokens beneath it that can
   never be excavated.
3. **An anchored lane is never empty.** It always holds at least its anchor, so it can never
   serve as a free lane.
4. **The existing top-is-revealed invariant is untouched.** A hidden anchor therefore flips
   face-up automatically the moment the lane is excavated down to it.

## Data model

`LaneState` and `LevelConfig` each gain one optional field, parallel to the existing `hidden`:

```ts
anchored?: boolean[]   // LevelConfig, parallel to lanes
anchored: boolean      // LaneState, per lane
```

Optional and defaulting to false, so all five existing chapter files parse unchanged and
chapters 1-5 regenerate to identical pars.

## Engine changes

| File | Change |
|------|--------|
| `types.ts` | the two fields above |
| `rules.ts` | one clause in `canMove`; `createState` reads `anchored` |
| `solver.ts` | **`canonicalKey` must incorporate anchors** (see risk below). Heuristics unchanged. |
| `generator.ts` | `GenerationSpec.anchors`, placement under invariant 1 |
| `describe.ts` | one clause: "Lane 4, Sky anchored at the base" |

### The canonical-key trap

`canonicalKey` sorts lanes before hashing, because - as its comment says - lanes are
interchangeable, and "sorting before hashing is where nearly all of this solver's speed comes
from". **Anchors break that assumption.** A lane anchored to Sky is not interchangeable with
one anchored to Emerald. If the key ignores anchors, two genuinely different boards collide,
the search prunes reachable branches, and par comes out wrong for every anchored level, with
no error raised.

The fix is to fold each lane's anchor colour into its key component before sorting. Unanchored
lanes still permute freely, so most of the dedup speed survives; anchored boards will generate
somewhat more slowly, which is acceptable.

This is the single highest-risk item in the design and gets a dedicated regression test.

## Generation

Anchored levels use `strategy: 'reverse'`. The generator's own notes record that a dealt board
with one free lane is genuinely unsolvable about 92% of the time, and anchors constrain a board
at least as hard as a missing free lane does. Reverse-play starts from the finished board and
walks legal moves backwards, so the result is solvable by construction - and because an anchor
never moves, a backward walk respects it automatically with no extra logic.

`GenerationSpec` gains `anchors: number`, the count of lanes to anchor. The generator assigns
distinct colours, satisfying invariant 1.

## Chapters

Chapters 1-5 descend through water: Spring, Brook, Rapids, Undertow, Deep. Chapters 6-10 descend
through stone, so the fiction marks the change of rule.

| Ch | Name | Introduces | Hidden | Par range |
|----|------|-----------|--------|-----------|
| 6  | Bedrock | one anchor, then two | none | 15-35 |
| 7  | Trench  | anchors crowd out free space | none | 30-50 |
| 8  | Mantle  | anchors and hidden together | yes | 40-60 |
| 9  | Fault   | many anchors, heavy hidden | heavy | 50-70 |
| 10 | Core    | hidden anchors | max | 60-85 |

Chapter 6 deliberately drops below chapter 5 in difficulty. `level-plan.ts` already states the
principle - "each new mechanic is taught on a deliberately easy board before it is ever tested
on a hard one" - and the `teach` beat exists for exactly this. Difficulty remains a sawtooth
within each chapter, not a ramp.

Chapter 10's hidden anchors need no new machinery. Invariant 4 means the anchor reveals itself
when excavated. The player knows a lane has a destiny and must dig to learn what it is.

## Accessibility and rendering

- `describe.ts` gains an anchor clause. Its output is already pure and already tested.
- The anchor must read without colour, since the palette is deliberately colourblind-safe. A
  keyed or notched base, not a tint.
- Reduced motion is unaffected.

## Testing

Test-driven, in this order:

1. `canMove` refuses to move a lone anchor; permits everything else it permitted before.
2. `canonicalKey` gives different keys to boards differing only in anchor placement.
3. Solver returns the hand-verified optimum on small anchored boards.
4. Heuristic admissibility: over generated anchored boards, `heuristic(s) <= optimal(s)`.
5. Regression: chapters 1-5 regenerate to byte-identical pars.
6. `describe.ts` announces an anchored lane.

## Risks

| Risk | Mitigation |
|------|-----------|
| `canonicalKey` collision silently corrupts par | Dedicated test, item 2 above |
| Anchors make boards unsolvable | `reverse` strategy makes solvability structural |
| Generation slows from reduced dedup | Measure; raise `maxNodes` per level if needed |
| Chapter 10 hidden anchors feel unfair | Taught across chapters 6-9 first; revisit if playtest disagrees |
