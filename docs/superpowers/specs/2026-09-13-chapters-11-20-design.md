# Chapters 11-20: the forge and light arcs

**Date:** 2026-09-13
**Status:** design approved, not yet implemented
**Depends on:** branch `anchored-tokens` merged to master (chapters 6-10, anchored tokens)

## Problem

Cascade will ship 100 levels across two five-chapter arcs: water (chapters 1-5, the base
rules and then face-down tokens) and stone (chapters 6-10, anchored tokens). The owner wants
100 more, taking the game to 200.

Every lever the engine exposes is already at or near its stop by chapter 10: nine colours
(the colourblind-safe palette's limit), capacity five, eleven lanes (a phone's limit), face-
down tokens, and anchors. `scripts/level-plan.ts` records why scaling a spec does not work:
"ramping one spec across a whole chapter made thirty levels feel like one level thirty
times". The same trap is waiting at a hundred.

## Decisions already made by the owner

1. **Difficulty keeps climbing** from where chapter 10 ends. Level 200 is the hardest board in
   the game.
2. **Composition only.** No new rule, mechanic, or engine behaviour.
3. **Every tenth level is a gate** - a deliberate spike - in chapters 11-20 only. Chapters 1-10
   keep their current pars.
4. **The ten chapter identities and the forge/light names** below are approved.

## Goals

- 100 levels in chapters 11-20, where no two chapters pose the same shape of problem.
- The difficulty curve keeps rising arc over arc, as the existing tests already demand.
- Levels 110, 120 ... 200 are unmistakable spikes.
- Chapters 1-10 regenerate byte-identically.

## Non-goals

- Any change to the rules, solver behaviour, renderer, or UI. (The chapter list is a
  `ScrollView`, so twenty chapters need no layout work.)
- Retuning chapters 1-10 in any way.
- New art beyond ten more chapter accent colours.

## Where the variety comes from

Variety has to come from the shape of the problem, not from difficulty numbers. Five
existing axes each change how a board feels, not just how hard it is:

1. **Fog distribution.** Chapters 1-10 keep `hiddenMin` and `hiddenMax` close together, which
   makes the fog uniform. A wide range (`hiddenMin: 0`, `hiddenMax: 4`) leaves some lanes fully
   readable and others opaque, so the player plans outward from what they can see.
2. **Aspect ratio.** Capacity 3 with many colours is wide and fast, and mistakes are cheap.
   Capacity 5 with few colours is deep and narrow, and each error buries four tokens.
3. **Determination ratio.** Many anchors fix most lanes' destinies, so the puzzle becomes
   ordering. One anchor under heavy fog makes it almost pure discovery.
4. **Construction.** Dealt boards tangle deeply. Reverse-walked boards (one free lane) are
   short, cramped and exact.
5. **Candidate selection.** `pick: 1.0` takes the single hardest board a shape's pool produces.

## The ten chapters

| Ch | Name | Identity | Defining settings |
|----|------|----------|-------------------|
| 11 | Ore | uneven fog | `hiddenMin: 0`, `hiddenMax: 3-4`; visible anchors |
| 12 | Smelt | wide and shallow | capacity 3, colours 7-9 |
| 13 | Anvil | deep and narrow | capacity 5, colours 5-7, one free lane on `tight` beats |
| 14 | Temper | mostly determined | anchors on 60-80% of colours, with maximum fog and nine colours to compensate |
| 15 | Alloy | barely determined | 1 anchor, fog 3-4 |
| 16 | Ember | the vice | one free lane on at least half its levels |
| 17 | Spark | full palette | colours 9 on every level, all else varying |
| 18 | Flare | reverse textures | most beats `tight` (one free lane, reverse-walked); `build` and the gate stay dealt |
| 19 | Corona | compound | every axis above, escalating |
| 20 | Zenith | the summit | the ten hardest boards the generator can produce |

Forge (11-15) and light (16-20) form the third and fourth arcs. The existing arc tests chunk
chapters in fives, so they apply to these arcs without modification.

Two identities pull against the curve and are constrained accordingly:

- **Flare (18) is reverse-walked by texture, but its peak cannot be.** Reverse-walked boards cap
  short (measured: difficulty 171 at nine colours with one free lane). Within the light arc its
  peak must still exceed Spark's. So its `tight` beats carry the identity, and its `build`
  levels and gate are dealt with two free lanes.
- **Temper (14) is mostly determined, and determination costs difficulty.** Measured on this
  project: fewer anchors make a board harder (Fault's climax scored 240/246/247/252 at 6/5/4/3
  anchors). Temper offsets its high anchor count with maximum fog and nine colours.

If measurement shows an identity still cannot out-peak the chapter before it inside its arc,
the plan may **swap the order of two identities within that arc**. Each name moves with its
identity. The owner is told, and no curve test is relaxed.

Each chapter keeps the house sawtooth: beats `teach`/`rest` early, `build` through the middle,
**`rest` at level 9, and the gate at level 10**. Resting at 9 means the spike is felt against
a dip, not against another hard board.

## Gates

Level 10 of every chapter from 11 on is a gate:

- `beat: 'climax'` and `pick: 1.0`, as every chapter 6-10 climax already uses.
- The chapter's most extreme settings within its identity, searched with a larger candidate pool
  than the rest of its chapter (24 in the forge arc, 48 in the light arc; see the budget table).
  The wider search is what lets a gate stand clear, not just top the chapter.
- **It must stand clear of the chapter:** its difficulty exceeds the chapter's second-hardest
  level by at least **8**. A new test enforces this for chapters 11 and above.

Eight is not arbitrary. Difficulty's dominant term is `6 × log2(nodes + 1)`, so eight points
is slightly more than one doubling of search effort. That is a spike a player feels, rather
than a board that merely tops the chapter by a point, as Core's climax once did.

## The ceiling problem, measured

Two more climbing arcs are the hard part. The stone arc peaks at **284** (Core). Its chapters
climb Bedrock 176, Trench 199, Mantle 261, Fault 280, Core 284, after a retune that won
Mantle and Fault's difficulty back while keeping their anchors visible. The forge arc must
beat 284, and the light arc must beat the forge arc's peak.

Difficulty is scored as:

```
6·log2(nodes + 1) + 1.6·optimal + 1.5·colours + 2.2·hidden − 4·emptyLanes
```

The colour, hidden-token and free-lane terms are already at their limits. Only **search
nodes** and **solution length** can still grow, and both come from finding harder boards of an
existing shape.

Probes on the Core-like shape (9 colours, capacity 5, two free lanes, maximum fog, three
hidden anchors, dealt). Each row searched its own seed range:

| Pool × `maxNodes` | Seed base | Hardest | Median | Most nodes used |
|---|---|---|---|---|
| 8 × 2M | 987,654,321 | 289 | 285 | — |
| 24 × 2M | 123,456,789 | 295 | 278 | 1.2M |
| 8 × 8M | 123,456,789 | 299 | 273 | 4.65M |
| 12 × 16M | 555,000,111 | 291 | 280 | 1.93M |
| 8 × 32M | 555,000,111 | 291 | 280 | 1.93M |

Other shapes at 8 × 2M: maximum fog with one *visible* anchor reached 277; uneven fog with
two visible anchors reached 247.

**What these probes do and do not show.** Boards needing more than 2M search nodes exist.
One needed 4.65M, and a 2M budget makes `tryCandidate` discard such a board, because `solve`
exhausts first. But they are occasional and depend on the seed. In the 16M and 32M runs no
candidate needed even 2M, so the extra budget changed nothing. The rows above do **not**
isolate budget from seed luck: the 289-to-299 spread mixes both, and seed variance alone moves
the hardest board by roughly ±5-10 points. From these rows alone the ceiling looked like
roughly 290-300, only 6-16 points above the stone arc's 284 with two more arcs to climb. The
controlled probe below separates the two effects and finds a little more room.

A controlled probe then held the seeds and the pool fixed and varied only `maxNodes`, plus one
wider search:

| Pool × `maxNodes` (seed base 777,000,333) | Hardest | p90 | Median | Candidates needing >2M nodes |
|---|---|---|---|---|
| 16 × 2M | 290 | 288 | 279 | 0 |
| 16 × 8M | 294 | 290 | 281 | 4 |
| 16 × 32M | 294 | 290 | 281 | 4 |
| 48 × 8M (seed base 31,415,926) | 305 | 293 | 279 | 8 |

Three conclusions:

1. **The search budget is a real but small lever, and it saturates at 8M.** Going from 2M to 8M
   admits the quarter of hard candidates that need 2-8M nodes and adds about 4 points. 32M
   changes nothing, so no budget above 8M is justified.
2. **Searching more seeds is what reaches the top.** Tripling the pool at 8M raised the hardest
   board from 294 to 305. The p90 moved only from 290 to 293, so the gain comes from rare
   outliers, not a higher typical board.
3. **Hidden anchors are worth about 8 points.** A face-down anchor counts toward `hiddenCount`,
   and at 8 × 2M the same maximum-fog shape reached 285 with one hidden anchor against 277
   with one visible anchor. Chapters that must set an arc's peak should hide their anchors
   wherever their identity allows.

Headroom is therefore narrow but real. Stone ends at 284. The forge arc can peak around 290-295
with ordinary pools. The light arc can peak around 300-305 by spending a wide seed search on
its gates.

| Arc | Chapters | `maxNodes` | Pool per level | Pool for the gate (level 10) |
|---|---|---|---|---|
| water, stone | 1-10 | unchanged (600k / 2M) | unchanged | unchanged |
| forge | 11-15 | 8M | 16 | 24 |
| light | 16-20 | 8M | 16 | 48 |

A 48 × 8M search took 274 seconds on this machine, so each light-arc gate costs roughly five
minutes of generation.

The plan's first task re-measures the chosen budgets against each arc's actual chapter specs,
before any chapter is authored. The decision rule is fixed now: **if the light arc cannot
out-peak the forge arc at the largest budget the plan measures, stop and put the numbers to the
owner.** The arc test must not be relaxed to fit. Given the narrow headroom above, the forge arc
should target a peak only just above the stone arc's final peak, keeping the hardest outliers
the search can find in reserve for the light arc.

## Generator changes (all gated on chapter ≥ 11)

`maxNodesFor`, `poolSizeFor`, `attemptsFor` and `seedFor` in `scripts/generate-levels.ts` all
feed chapters 1-10 as well. Any unconditional change reprices shipped levels, so each gains
a chapter-11-and-above branch and leaves the existing branches untouched:

- **`maxNodesFor` and `poolSizeFor`**: for chapter ≥ 11, return 8M and the pool sizes in the
  table above. The gate's larger pool is keyed on `beat === 'climax'`.
- **`attemptsFor`**: for chapter ≥ 11, allow 60 attempts per pool slot, not the 200 chapters
  6-10 use. Every probe pool filled completely at 60 per slot (dealt anchored boards are
  solvable 75-82% of the time). A 48-slot gate at 200 per slot would also break the seed
  arithmetic below.
- **`seedFor`**: chapters 6-10 step a stride of 7919 × (14 × 200 + 1) ≈ 22.18M per level, so
  chapter 10's last level starts near 1.109 billion. Chapters 11-20 get their own block starting
  after that, with a stride sized to their largest search, a light-arc gate: 7919 × (48 × 60 + 1)
  ≈ 22.82M per level. No pool can overrun into its neighbour's seeds. The block ends near
  1.109B + 100 × 22.82M ≈ 3.39 billion, still below mulberry32's 2³² (≈ 4.29 billion).
- **Regenerating from a chapter.** Generation already takes over 20 minutes at 2M, and these
  budgets multiply it. Two rate-limited agents on this project lost uncommitted work while a
  full regeneration was still running. Add `npm run levels -- --from <chapter>`, which regenerates
  only chapters ≥ N and rewrites the manifest from the authored plan (`CHAPTERS`), never from
  whatever packs happen to be on disk. Because every chapter's
  seeds and ids are deterministic, this must produce byte-identical output to a full run. The plan
  proves it once: run `npm run levels -- --from 6` on the merged branch, and require
  `git diff --stat -- assets/levels/` to print nothing.

## Registering the chapters with the app

`src/data/levels.ts` loads packs through a literal `require` list (Metro needs literal paths).
Chapters 11-20 must be appended to it in order, or they generate and pass every pack test
but never reach a player. The new registration test above guards this.

## Level plan conventions (`scripts/level-plan.ts`)

- Author through the existing `spec()` helper, as chapters 1-10 do.
- **Every level keeps at least one anchor.** Anchors are part of the game's vocabulary now, and
  a pack test already requires one in every level from chapter 6 on.
- **Every chapter carries some face-down tokens.** The face-down test exempts only the two
  teaching arcs' early chapters (1-3 and 6-7). Chapter 12's shallow lanes still take light fog.
- **At least six distinct board shapes per chapter**, where a shape is
  colours-capacity-free lanes-max hidden. The existing shape test requires this. Chapters that
  fix one axis by identity (12 fixes capacity 3; 17 fixes nine colours) must vary the others.
- Escalate with the strong levers: fog, colours, capacity, *fewer* anchors, and the budget.
  Never add anchors to chase difficulty. Measured on this project: anchor count barely moves
  solution length, and fewer anchors make a board harder.
- Record the measurements that justify each non-obvious spec in a comment beside it, as the
  existing file does.
- Chapter 10's anchors are hidden (`hideAnchors: true`); forge and light choose per identity.
  Chapter 11 (uneven fog) keeps them visible, so its readable lanes stay readable.

## Colours

`chapterColors` in `src/design/tokens.ts` has ten entries. Add ten more for chapters 11-20;
the existing ten must not change. The forge arc leans warm (ember, bronze, iron) and the light
arc bright (gold, white-gold, pale blue).

Be honest about what twenty accents can do. Well-known colourblind-safe palettes top out
around eight to ten mutually distinguishable colours, and this game already uses ten accents
plus nine token fills. Twenty accents cannot all be pairwise distinct under colour-vision
deficiency, and the spec does not pretend otherwise.

They do not need to be, because an accent never identifies a chapter on its own. On the
chapter list it is a swatch and a progress fill beside the chapter's name. On the home screen
it is a rule and a star tint beside "Name · level". The accessibility label names the chapter.
So the requirement is:

- each new accent is distinct in normal vision from its neighbouring chapters and from the
  nine `tokenColors` fills;
- neighbouring chapters differ in lightness as well as hue, so they stay separable under
  colour-vision deficiency;
- chapter identity keeps relying on the name, never on colour alone. Any future screen that
  shows an accent without the name breaks this, and must add the name.

## Tests (`scripts/levels.test.ts`)

Extend; do not weaken:

- Derive the pack list from the authored plan (`CHAPTERS` in `scripts/level-plan.ts`) instead
  of the hardcoded `[1..10]`. **Not** from the manifest: `--from` rewrites the manifest, and a
  manifest built from packs on disk would absorb an orphaned pack instead of letting the
  "no stale pack on disk" test catch it, which is the failure that test was written for.
- "ships ten chapters of ten levels" becomes twenty. "numbers levels 1..100" becomes 1..200.
- **New:** "registers every planned chapter with the app": the literal `require` list in
  `src/data/levels.ts` names exactly the chapters in `CHAPTERS`. Metro needs those literal
  paths, so the list cannot be derived. Without this guard a chapter can generate, pass every
  pack test, and never appear in the game.
- **New:** "every gate stands clear of its chapter": for chapters ≥ 11, the climax's
  difficulty exceeds the chapter's second-hardest level by at least 8. The existing
  "ends every chapter on its hardest board" test already requires a climax in every chapter,
  so a separate "is a gate" test would duplicate it.
- Every existing assertion keeps its meaning. The arc tests pick up arcs 3 and 4
  automatically. No curve assertion is edited to fit a result; if one fails, the numbers go to
  the owner.

## Risks

| Risk | Mitigation |
|---|---|
| The light arc cannot out-peak the forge arc | Budget measured first; stop-and-ask rule above, no test relaxation |
| Generation time grows to hours (each light gate ≈ 5 min at 48 × 8M) | `--from <chapter>`; forge and light authored and generated per arc |
| Budget or seed changes reprice chapters 1-10 | Every change gated on chapter ≥ 11; byte-identical check on 1-10 after every regeneration |
| Chapters blur together | Identity table; six-shape minimum per chapter; notes reviewed per chapter |
| Gates feel like ordinary climaxes | Clear-margin test (≥ 8) plus a `rest` at level 9 |
| Bundle size | ~12 KB per chapter; twenty chapters is well under a megabyte |
| Twenty accents cannot all be colourblind-distinct | Accents are decorative beside the chapter name; neighbours differ in lightness |
