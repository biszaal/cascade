# Anchored Tokens & Chapters 6-10 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an immovable "anchored" base token to the engine and ship 50 new levels (chapters 6-10) built on it.

**Architecture:** One new rule expressed as a single clause in `canMove`. Anchors are carried as a boolean per lane, parallel to the existing `hidden` count. The IDA* heuristics are untouched and stay admissible; the two places that *clone or hash* lane state must learn about anchors or par silently breaks. Levels are authored by hand in `scripts/level-plan.ts` and realised by `scripts/generate-levels.ts`.

**Tech Stack:** TypeScript, Vitest, React Native (Expo SDK 57), Reanimated.

**Spec:** `docs/superpowers/specs/2026-09-09-anchored-tokens-chapters-6-10-design.md`

## Global Constraints

- **Chapters 1-5 must not change.** Every par in `assets/levels/chapter-1..5.json` stays byte-identical.
- **`anchored` is optional in `LevelConfig`.** Absent means all-false, so existing packs parse unchanged.
- **One anchor per colour, board-wide.** `isSolved` requires every non-empty lane to be full and uniform, so two lanes anchored to the same colour is unsolvable.
- **Anchors sit at index 0 only.**
- **Heuristics stay untouched.** `misplacedTokens` and `colorSpread` are already admissible under anchors. Do not "improve" them.
- **No new dependencies.**
- Run `npm run typecheck` and `npm test` before every commit.

---

### Task 1: Carry anchors through lane state

Anchors must survive every place lane state is built or copied. There are **three** such places and missing any one of them breaks par silently.

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/rules.ts` (`createState`, `cloneState`)
- Modify: `src/engine/solver.ts:101` (`solve`'s working clone)
- Test: `src/engine/rules.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `LaneState.anchored: boolean`, `LevelConfig.anchored?: boolean[]`

- [ ] **Step 1: Write the failing test**

Add to `src/engine/rules.test.ts`:

```ts
describe('anchored lanes', () => {
  it('defaults to unanchored when the config omits anchors', () => {
    const state = board(3, [[0, 0], [1]]);
    expect(state.lanes.every((lane) => lane.anchored)).toBe(false);
  });

  it('reads anchors from the config', () => {
    const state = createState({
      capacity: 3,
      colorCount: 2,
      lanes: [[0, 1], [1]],
      hidden: [0, 0],
      anchored: [true, false],
    });
    expect(state.lanes[0]!.anchored).toBe(true);
    expect(state.lanes[1]!.anchored).toBe(false);
  });

  it('never anchors an empty lane', () => {
    const state = createState({
      capacity: 3,
      colorCount: 1,
      lanes: [[0], []],
      hidden: [0, 0],
      anchored: [true, true],
    });
    expect(state.lanes[1]!.anchored).toBe(false);
  });

  it('carries the anchor through a clone', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0, 1], [1]], hidden: [0, 0], anchored: [true, false],
    });
    expect(cloneState(state).lanes[0]!.anchored).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rules.test.ts -t "anchored lanes"`
Expected: FAIL — `anchored` is not a property of `LaneState`, and `createState` rejects the extra config key at compile time.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/types.ts`, add to `LaneState`:

```ts
  /**
   * A base token that can never move, so this lane can only ever finish in its colour.
   * Anchors sit at index 0; the rule is enforced in `canMove`.
   */
  anchored: boolean;
```

and to `LevelConfig`, after `hidden`:

```ts
  /** Which lanes carry an immovable base token, parallel to `lanes`. Absent means none. */
  anchored?: boolean[];
```

In `src/engine/rules.ts`, `createState`:

```ts
    lanes: config.lanes.map((tokens, i) => {
      const copy = [...tokens];
      return {
        tokens: copy,
        hidden: clampHidden(config.hidden[i] ?? 0, copy.length),
        // An empty lane has no base to anchor, so the flag is meaningless there.
        anchored: (config.anchored?.[i] ?? false) && copy.length > 0,
      };
    }),
```

In `src/engine/rules.ts`, `cloneState`:

```ts
    lanes: state.lanes.map((lane) => ({
      tokens: [...lane.tokens],
      hidden: lane.hidden,
      anchored: lane.anchored,
    })),
```

In `src/engine/solver.ts:101`, inside `solve`:

```ts
    lanes: state.lanes.map((lane) => ({
      tokens: [...lane.tokens],
      hidden: lane.hidden,
      anchored: lane.anchored,
    })),
```

This third one is easy to miss and has no test of its own until Task 2 — the solver would otherwise search a board where anchors do not exist and return solutions that are too short.

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all existing tests plus the four new ones pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/rules.ts src/engine/solver.ts src/engine/rules.test.ts
git commit -m "Carry an anchored flag through lane state"
```

---

### Task 2: An anchor cannot move

**Files:**
- Modify: `src/engine/rules.ts` (`canMove`)
- Test: `src/engine/rules.test.ts`

**Interfaces:**
- Consumes: `LaneState.anchored` from Task 1
- Produces: no new signatures; `canMove(state, from, to)` gains one refusal

- [ ] **Step 1: Write the failing test**

```ts
describe('anchors are immovable', () => {
  it('refuses to move a lone anchor', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0], [0, 0]], hidden: [0, 0], anchored: [true, false],
    });
    expect(canMove(state, 0, 1)).toBe(false);
  });

  it('still allows moving a token that merely sits above an anchor', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0, 1], [1]], hidden: [0, 0], anchored: [true, false],
    });
    expect(canMove(state, 0, 1)).toBe(true);
  });

  it('allows an unanchored lone token to move as before', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0], [0, 0]], hidden: [0, 0], anchored: [false, false],
    });
    expect(canMove(state, 0, 1)).toBe(true);
  });

  it('never offers an anchor among the legal moves', () => {
    const state = createState({
      capacity: 3, colorCount: 2, lanes: [[0], [0, 0]], hidden: [0, 0], anchored: [true, false],
    });
    expect(legalMoves(state).some((m) => m.from === 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rules.test.ts -t "anchors are immovable"`
Expected: FAIL — the first test returns `true`, because nothing stops the anchor moving yet.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/rules.ts`, inside `canMove`, directly after the completed-lane refusal:

```ts
  // An anchor is only ever the top of its lane when it is the last token there, so this
  // single clause is the whole immovability rule.
  if (source.anchored && source.tokens.length === 1) return false;
```

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.ts src/engine/rules.test.ts
git commit -m "Refuse to move an anchored base token"
```

---

### Task 3: The canonical key must distinguish anchors

**This is the highest-risk task in the plan.** `canonicalKey` sorts lanes because lanes are interchangeable. Anchors break that: a lane anchored to Sky is not interchangeable with one anchored to Emerald. Without this fix two different boards collide, the search prunes reachable branches, and par is wrong with no error raised.

**Files:**
- Modify: `src/engine/solver.ts` (`canonicalKey`)
- Test: `src/engine/solver.test.ts`

**Interfaces:**
- Consumes: `LaneState.anchored` from Task 1
- Produces: `canonicalKey(state)` — same signature, anchor-aware output

- [ ] **Step 1: Write the failing test**

Add to `src/engine/solver.test.ts`:

```ts
describe('canonicalKey with anchors', () => {
  it('separates boards that differ only in which lane is anchored', () => {
    const a = createState({
      capacity: 2, colorCount: 2, lanes: [[0], [1]], hidden: [0, 0], anchored: [true, false],
    });
    const b = createState({
      capacity: 2, colorCount: 2, lanes: [[0], [1]], hidden: [0, 0], anchored: [false, true],
    });
    expect(canonicalKey(a)).not.toBe(canonicalKey(b));
  });

  it('still treats unanchored lanes as interchangeable', () => {
    const a = createState({ capacity: 2, colorCount: 2, lanes: [[0], [1]], hidden: [0, 0] });
    const b = createState({ capacity: 2, colorCount: 2, lanes: [[1], [0]], hidden: [0, 0] });
    expect(canonicalKey(a)).toBe(canonicalKey(b));
  });
});
```

Ensure `canonicalKey` and `createState` are imported in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/solver.test.ts -t "canonicalKey with anchors"`
Expected: FAIL on the first test — both keys are `"0:0|1:0"`.

- [ ] **Step 3: Write minimal implementation**

```ts
export function canonicalKey(state: GameState): string {
  const parts = state.lanes.map(
    (lane) => `${lane.tokens.join(',')}:${lane.hidden}${lane.anchored ? 'a' : ''}`,
  );
  parts.sort();
  return parts.join('|');
}
```

An anchored lane's colour is already the first element of `tokens`, so the `a` marker is enough to make the two lanes sort and compare distinctly. Unanchored lanes keep their exact previous key, so chapters 1-5 hash identically and their pars cannot drift.

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npm test`
Expected: all pass, including every existing solver test.

- [ ] **Step 5: Commit**

```bash
git add src/engine/solver.ts src/engine/solver.test.ts
git commit -m "Stop the canonical key collapsing differently anchored boards"
```

---

### Task 4: Solver correctness on anchored boards

Proves the solver both respects anchors and still returns the optimum.

**Files:**
- Test: `src/engine/solver.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3
- Produces: nothing

- [ ] **Step 1: Write the failing test**

```ts
describe('solving anchored boards', () => {
  it('never returns a solution that moves an anchor', () => {
    const config = {
      capacity: 3, colorCount: 2,
      lanes: [[0, 1, 1], [1, 0, 0], []],
      hidden: [0, 0, 0],
      anchored: [true, true, false],
    };
    const result = solve(createState(config));
    expect(result.solved).toBe(true);

    const state = createState(config);
    for (const move of result.moves) {
      expect(state.lanes[move.from]!.tokens.length).toBeGreaterThan(1);
      applyMoveInPlace(state, move);
    }
    expect(isSolved(state)).toBe(true);
  });

  it('reports an unsolvable anchored board rather than cheating', () => {
    // Both lanes are anchored to Vermilion. Only one lane can hold a colour, so this
    // cannot be solved - and the solver must say so instead of moving an anchor.
    const result = solve(
      createState({
        capacity: 2, colorCount: 2,
        lanes: [[0, 1], [0, 1]],
        hidden: [0, 0],
        anchored: [true, true],
      }),
      { maxNodes: 50_000 },
    );
    expect(result.solved).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run src/engine/solver.test.ts -t "solving anchored boards"`
Expected: PASS if Tasks 1-3 are correct. **If either test fails, stop** — it means anchors are not reaching the solver's working state (Task 1, step 3, third edit) or the key fix is wrong. Do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add src/engine/solver.test.ts
git commit -m "Prove the solver respects anchors and still finds the optimum"
```

---

### Task 5: Announce anchors to screen readers

**Files:**
- Modify: `src/game/describe.ts` (`describeLane`)
- Test: `src/game/describe.test.ts`

**Interfaces:**
- Consumes: `LaneState.anchored`
- Produces: `describeLane` output gains an anchor clause

- [ ] **Step 1: Write the failing test**

```ts
it('announces an anchored lane so its destiny is audible', () => {
  const lane = { tokens: [1, 0], hidden: 0, anchored: true };
  expect(describeLane(lane, 3, 4)).toContain('Sky anchored at the base');
});

it('says nothing about anchors on an ordinary lane', () => {
  const lane = { tokens: [1, 0], hidden: 0, anchored: false };
  expect(describeLane(lane, 3, 4)).not.toContain('anchored');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/describe.test.ts -t "anchored"`
Expected: FAIL — no anchor clause exists.

- [ ] **Step 3: Write minimal implementation**

In `describeLane`, after the complete-lane branch and before the return that describes the top, append the clause to the string the function is about to return. The anchor colour is `lane.tokens[0]`:

```ts
  const anchor = lane.anchored ? `, ${colorName(lane.tokens[0]!)} anchored at the base` : '';
```

and add `${anchor}` to the end of the description returned for a non-empty, incomplete lane. A complete lane needs no clause — it is already announced as "complete, all <colour>".

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/describe.ts src/game/describe.test.ts
git commit -m "Announce an anchored lane to screen readers"
```

---

### Task 6: Generate anchored boards

**Files:**
- Modify: `src/engine/generator.ts` (`GenerationSpec`, `reverseBoard`, `tryCandidate`)
- Test: `src/engine/generator.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3
- Produces: `GenerationSpec.anchors?: number`; `reverseBoard`/`dealBoard` return `LevelConfig` including `anchored`

- [ ] **Step 1: Write the failing test**

```ts
describe('anchored generation', () => {
  const spec = {
    capacity: 4, colorCount: 5, emptyLanes: 2,
    hiddenMin: 0, hiddenMax: 0,
    strategy: 'reverse' as const, reverseSteps: 30,
    anchors: 2,
  };

  it('anchors exactly the requested number of lanes', () => {
    const config = reverseBoard(1234, spec);
    expect((config.anchored ?? []).filter(Boolean)).toHaveLength(2);
  });

  it('never anchors two lanes to the same colour', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const config = reverseBoard(seed, spec);
      const colors = config.lanes
        .map((lane, i) => (config.anchored?.[i] ? lane[0] : null))
        .filter((c): c is number => c !== null);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it('produces boards that are actually solvable', () => {
    const candidate = tryCandidate(99, spec, 200_000);
    expect(candidate).not.toBeNull();
    expect(candidate!.optimal).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/generator.test.ts -t "anchored generation"`
Expected: FAIL — `anchors` is not a field of `GenerationSpec`.

- [ ] **Step 3: Write minimal implementation**

Add to `GenerationSpec`:

```ts
  /**
   * How many lanes carry an immovable base token.
   *
   * Reverse-play only. The backward walk starts from the finished board, where each
   * colour already occupies its own lane, so anchoring bases there satisfies the
   * one-anchor-per-colour invariant by construction rather than by check.
   */
  anchors?: number;
```

In `reverseBoard`, immediately after the solved `lanes` array is built and before the backward walk, choose which colours to anchor. Because lane `c` holds colour `c` at that moment, anchoring lane indices is the same as anchoring distinct colours:

```ts
  const anchorCount = Math.min(spec.anchors ?? 0, spec.colorCount);
  const anchorColors = new Set<number>();
  {
    const order = Array.from({ length: spec.colorCount }, (_, c) => c);
    shuffle(rng, order);
    for (let i = 0; i < anchorCount; i++) anchorColors.add(order[i]!);
  }
```

The backward walk relocates tokens, so track each anchor by colour and mark the final lane whose **base** is that colour. After the walk, when the chosen arrangement is known, build the parallel array:

```ts
  const anchored = chosen.map(
    (lane) => lane.length > 0 && anchorColors.has(lane[0]!),
  );
```

The walk must also never lift a lane down to nothing if that lane's base is an anchor colour — otherwise the anchor would be relocated. Add to the reverse-move option filter, alongside the existing single-token rule:

```ts
      // An anchor never moves, so the backward walk must never take one off its lane.
      if (source.length === 1 && anchorColors.has(source[0]!)) continue;
```

Return `{ ...config, anchored }` from `reverseBoard`. In `tryCandidate`, no change is needed beyond passing the config through, because `createState` already reads `anchored` (Task 1) — but verify the candidate's recorded solution still solves the board, which `tryCandidate` already does.

- [ ] **Step 4: Run the tests**

Run: `npm run typecheck && npm test`
Expected: all pass. If "solvable" fails intermittently, raise `reverseSteps`, never lower the assertion.

- [ ] **Step 5: Commit**

```bash
git add src/engine/generator.ts src/engine/generator.test.ts
git commit -m "Generate boards with anchored bases"
```

---

### Task 7: Render the anchor without relying on colour

The palette is deliberately colourblind-safe, so the anchor must be legible as a shape.

**Files:**
- Modify: `src/components/Token.tsx`
- Modify: `src/components/Lane.tsx`
- Modify: `src/components/Board.tsx` (pass the flag down)
- Test: manual, plus `npm run e2e`

**Interfaces:**
- Consumes: `LaneState.anchored`
- Produces: `Token` gains an `anchored?: boolean` prop

- [ ] **Step 1: Add the prop and the treatment**

In `Token.tsx`, accept `anchored?: boolean` and, when true, render a keyed base: a flat bottom edge on the disc plus a short inset bar in `palette.shade`, drawn from the existing token palette. Do **not** use opacity or a tint alone — both vanish for a colourblind player and in high contrast mode.

In `Lane.tsx`, pass `anchored={lane.anchored && index === 0}` so only the base token is keyed.

- [ ] **Step 2: Verify on device**

Run: `npm run ios` (or `npm run e2e`)
Expected: the anchored token reads as fixed at a glance, and the board still reads correctly in the reduced-motion path.

- [ ] **Step 3: Commit**

```bash
git add src/components/Token.tsx src/components/Lane.tsx src/components/Board.tsx
git commit -m "Key the anchored token so it reads as fixed"
```

---

### Task 8: Author chapters 6-10

**Files:**
- Modify: `scripts/level-plan.ts`

**Interfaces:**
- Consumes: `GenerationSpec.anchors` from Task 6
- Produces: `CHAPTERS` grows to ten entries; `TOTAL_LEVELS` becomes 100

Chapters 1-5 descend through water. Chapters 6-10 descend through stone, so the fiction marks the change of rule. Difficulty stays a sawtooth, and chapter 6 deliberately sits below chapter 5 because a new mechanic is always taught on an easy board.

- [ ] **Step 1: Add chapter 6, Bedrock**

Append to `CHAPTERS`:

```ts
  {
    n: 6,
    name: 'Bedrock',
    color: 5,
    levels: [
      { n: 1, beat: 'teach', intensity: 0.05, note: 'One anchor. That lane can only ever finish in its colour.',
        spec: { capacity: 4, colorCount: 4, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 18, anchors: 1 } },
      { n: 2, beat: 'teach', intensity: 0.10, note: 'The same idea with one more colour to place around it.',
        spec: { capacity: 4, colorCount: 5, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 22, anchors: 1 } },
      { n: 3, beat: 'build', intensity: 0.20, note: 'Two anchors. Two lanes are now spoken for before a move is made.',
        spec: { capacity: 4, colorCount: 5, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 26, anchors: 2 } },
      { n: 4, beat: 'build', intensity: 0.28, note: 'Deeper lanes, so a wrong token buries more beneath it.',
        spec: { capacity: 5, colorCount: 5, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 30, anchors: 2 } },
      { n: 5, beat: 'rest', intensity: 0.15, note: 'Short and shallow. A breath before the squeeze.',
        spec: { capacity: 3, colorCount: 5, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 20, anchors: 2 } },
      { n: 6, beat: 'build', intensity: 0.35, note: 'Six colours against two anchors.',
        spec: { capacity: 4, colorCount: 6, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 34, anchors: 2 } },
      { n: 7, beat: 'build', intensity: 0.42, note: 'Three anchors: half the board is committed.',
        spec: { capacity: 5, colorCount: 6, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 38, anchors: 3 } },
      { n: 8, beat: 'tight', intensity: 0.30, pick: 0.95, note: 'One free lane and two anchors. Short, and there is almost nowhere to put anything.',
        spec: { capacity: 4, colorCount: 5, emptyLanes: 1, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 26, anchors: 2 } },
      { n: 9, beat: 'build', intensity: 0.50, note: 'Seven colours, three anchors.',
        spec: { capacity: 5, colorCount: 7, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 42, anchors: 3 } },
      { n: 10, beat: 'climax', intensity: 0.60, note: 'Four anchors. More of this board is decided than is free.',
        spec: { capacity: 5, colorCount: 7, emptyLanes: 2, hiddenMin: 0, hiddenMax: 0, strategy: 'reverse', reverseSteps: 48, anchors: 4 } },
    ],
  },
```

- [ ] **Step 2: Add chapters 7-10**

Author these exactly as chapter 6 above — same object shape, one entry per level. Every value is specified; nothing here is left to judgement. `strategy` is `'reverse'` throughout, since anchors constrain a board at least as hard as a missing free lane and a dealt board would frequently be unsolvable.

**Chapter 7, `Trench`, color 6** — anchors crowd out free space; no hidden tokens.

| n | beat | intensity | pick | cap | colours | empty | anchors | steps | note |
|---|------|-----------|------|-----|---------|-------|---------|-------|------|
| 1 | rest | 0.30 | | 4 | 6 | 2 | 2 | 30 | Settling in: the anchors are familiar now. |
| 2 | build | 0.42 | | 4 | 6 | 2 | 3 | 36 | Three anchors and room to work. |
| 3 | build | 0.50 | | 5 | 6 | 2 | 3 | 40 | The same shape, one token deeper. |
| 4 | build | 0.55 | | 5 | 7 | 2 | 4 | 44 | Four anchors: the free lanes are the whole game now. |
| 5 | rest | 0.32 | | 3 | 6 | 2 | 3 | 24 | Shallow again, briefly. |
| 6 | build | 0.60 | | 4 | 7 | 2 | 4 | 46 | Seven colours and four fixed destinations. |
| 7 | tight | 0.45 | 0.95 | 4 | 6 | 1 | 3 | 32 | One free lane, three anchors. |
| 8 | build | 0.66 | | 5 | 7 | 2 | 5 | 50 | Five anchors. Most of the board is already spoken for. |
| 9 | tight | 0.50 | 0.95 | 5 | 6 | 1 | 4 | 36 | The tightest board yet, and four of its lanes cannot move. |
| 10 | climax | 0.72 | | 5 | 8 | 2 | 5 | 56 | Eight colours, five anchors, two free lanes. |

**Chapter 8, `Mantle`, color 7** — anchors and hidden tokens together for the first time.

| n | beat | intensity | pick | cap | colours | empty | hiddenMin | hiddenMax | anchors | steps | note |
|---|------|-----------|------|-----|---------|-------|-----------|-----------|---------|-------|------|
| 1 | teach | 0.40 | | 4 | 6 | 2 | 1 | 1 | 2 | 32 | One face-down token per lane, and the anchors you already know. |
| 2 | build | 0.50 | | 4 | 6 | 2 | 1 | 2 | 3 | 38 | The anchor says what the lane must become; the hidden tokens hide what is in the way. |
| 3 | build | 0.58 | | 5 | 6 | 2 | 1 | 2 | 3 | 42 | Deeper, and less of it visible. |
| 4 | rest | 0.38 | | 3 | 6 | 2 | 1 | 1 | 2 | 26 | A short board to re-read the mechanic on. |
| 5 | build | 0.64 | | 5 | 7 | 2 | 2 | 3 | 4 | 48 | Four anchors under three face-down tokens each. |
| 6 | build | 0.70 | | 5 | 7 | 2 | 2 | 3 | 4 | 52 | The same, tangled further. |
| 7 | tight | 0.55 | 0.95 | 4 | 6 | 1 | 1 | 2 | 3 | 34 | One free lane, and you cannot see what is coming. |
| 8 | build | 0.75 | | 5 | 8 | 2 | 2 | 3 | 5 | 56 | Eight colours, five of them already assigned. |
| 9 | build | 0.78 | | 5 | 8 | 2 | 3 | 4 | 5 | 60 | Almost nothing on this board is visible. |
| 10 | climax | 0.84 | | 5 | 8 | 2 | 3 | 4 | 6 | 64 | Six anchors. The board is mostly decided and mostly unseen. |

**Chapter 9, `Fault`, color 8** — many anchors, heavy hidden.

| n | beat | intensity | pick | cap | colours | empty | hiddenMin | hiddenMax | anchors | steps | note |
|---|------|-----------|------|-----|---------|-------|-----------|-----------|---------|-------|------|
| 1 | rest | 0.55 | | 4 | 7 | 2 | 1 | 2 | 3 | 36 | A gentler opening after the Mantle's last board. |
| 2 | build | 0.68 | | 5 | 7 | 2 | 2 | 3 | 4 | 48 | Back to depth. |
| 3 | build | 0.74 | | 5 | 8 | 2 | 2 | 3 | 5 | 54 | Eight colours, five anchors. |
| 4 | build | 0.80 | | 5 | 8 | 2 | 3 | 4 | 5 | 58 | Deeper into the dark. |
| 5 | rest | 0.50 | | 3 | 7 | 2 | 1 | 2 | 4 | 28 | Shallow, and over quickly. |
| 6 | build | 0.84 | | 5 | 9 | 2 | 3 | 4 | 6 | 62 | Nine colours. Six lanes cannot move. |
| 7 | tight | 0.66 | 0.95 | 5 | 7 | 1 | 2 | 3 | 5 | 40 | One free lane against five anchors. |
| 8 | build | 0.88 | | 5 | 9 | 2 | 3 | 4 | 6 | 66 | The hardest ordinary board in the game so far. |
| 9 | tight | 0.70 | 0.95 | 5 | 8 | 1 | 3 | 4 | 6 | 44 | Tight, deep, anchored and blind at once. |
| 10 | climax | 0.92 | | 5 | 9 | 2 | 4 | 4 | 7 | 70 | Seven anchors under four face-down tokens each. |

**Chapter 10, `Core`, color 0** — hidden anchors. `hiddenMin` of 1 or more places a face-down token at index 0 of an anchored lane, so the anchor's colour is unknown until the lane is excavated down to it. This needs no new machinery: the existing top-is-revealed invariant flips it face-up at exactly the right moment.

| n | beat | intensity | pick | cap | colours | empty | hiddenMin | hiddenMax | anchors | steps | note |
|---|------|-----------|------|-----|---------|-------|-----------|-----------|---------|-------|------|
| 1 | teach | 0.62 | | 4 | 6 | 2 | 1 | 2 | 2 | 34 | An anchor you cannot see. You know the lane has a destiny; you must dig to learn it. |
| 2 | build | 0.72 | | 4 | 7 | 2 | 2 | 2 | 3 | 42 | Two hidden destinies. |
| 3 | build | 0.80 | | 5 | 7 | 2 | 2 | 3 | 4 | 50 | Deeper, and the anchors stay buried longer. |
| 4 | rest | 0.58 | | 3 | 6 | 2 | 1 | 2 | 3 | 30 | Short enough to see the whole idea at once. |
| 5 | build | 0.86 | | 5 | 8 | 2 | 3 | 4 | 5 | 58 | Five anchors, none of them visible at the start. |
| 6 | build | 0.90 | | 5 | 8 | 2 | 3 | 4 | 6 | 64 | Six. |
| 7 | tight | 0.74 | 0.95 | 5 | 7 | 1 | 2 | 3 | 5 | 46 | One free lane, and every destination is a guess. |
| 8 | build | 0.94 | | 5 | 9 | 2 | 4 | 4 | 6 | 70 | Nine colours, six buried anchors. |
| 9 | tight | 0.80 | 0.95 | 5 | 8 | 1 | 3 | 4 | 6 | 50 | The last tight board. |
| 10 | climax | 1.00 | | 5 | 9 | 2 | 4 | 4 | 7 | 76 | The floor of the world. Nine colours, seven anchors, none of them visible. |

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. `TOTAL_LEVELS` now evaluates to 100.

- [ ] **Step 4: Commit**

```bash
git add scripts/level-plan.ts
git commit -m "Author chapters 6-10, the stone chapters"
```

---

### Task 9: Generate the packs and register them

**Files:**
- Modify: `src/data/levels.ts`
- Modify: `scripts/levels.test.ts`
- Generated: `assets/levels/chapter-6..10.json`, `assets/levels/manifest.json`

**Interfaces:**
- Consumes: Task 8's `CHAPTERS`
- Produces: ten packs on disk; `totalLevels === 100`

- [ ] **Step 1: Generate**

Run: `npm run levels`
Expected: a table of 100 levels. Every level must report a solved board; the script throws if a recorded solution does not solve its board. If a slot reports an empty candidate pool, raise that level's `reverseSteps` — never lower its `anchors`, which would change the designed shape.

- [ ] **Step 2: Confirm chapters 1-5 did not move**

Run: `git diff --stat assets/levels/chapter-1.json assets/levels/chapter-2.json assets/levels/chapter-3.json assets/levels/chapter-4.json assets/levels/chapter-5.json`
Expected: **no output.** Any diff means the engine change altered existing pars and must be investigated before going further — the most likely cause is `canonicalKey` changing for unanchored lanes.

- [ ] **Step 3: Register the new packs**

In `src/data/levels.ts`, extend the `packs` array:

```ts
  require('../../assets/levels/chapter-6.json'),
  require('../../assets/levels/chapter-7.json'),
  require('../../assets/levels/chapter-8.json'),
  require('../../assets/levels/chapter-9.json'),
  require('../../assets/levels/chapter-10.json'),
```

In `scripts/levels.test.ts`, widen the pack list and the count assertion:

```ts
const packs: Pack[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
  (n) => JSON.parse(readFileSync(join(levelsDir, `chapter-${n}.json`), 'utf8')) as Pack,
);
```

and update the `ships five chapters of ten levels` test to assert ten chapters of ten.

- [ ] **Step 4: Add pack invariants for anchors**

Add to `scripts/levels.test.ts`:

```ts
it('never anchors two lanes to the same colour', () => {
  for (const level of allLevels) {
    const anchored = level.config.anchored ?? [];
    const colors = level.config.lanes
      .map((lane, i) => (anchored[i] ? lane[0] : null))
      .filter((c): c is number => c !== null && c !== undefined);
    expect(new Set(colors).size).toBe(colors.length);
  }
});

it('leaves chapters 1 to 5 free of anchors', () => {
  for (const level of allLevels.filter((l) => l.chapter <= 5)) {
    expect((level.config.anchored ?? []).some(Boolean)).toBe(false);
  }
});
```

- [ ] **Step 5: Run everything**

Run: `npm run typecheck && npm test`
Expected: all pass, including the existing pack validations replaying every recorded solution.

- [ ] **Step 6: Commit**

```bash
git add src/data/levels.ts scripts/levels.test.ts assets/levels
git commit -m "Ship chapters 6-10"
```

---

### Task 10: Play it

**Files:** none

- [ ] **Step 1: Run the app**

Run: `npm run ios`
Play level 51 (chapter 6, level 1) and confirm the anchor reads as immovable without instruction, then level 91 (chapter 10, level 1) and confirm a hidden anchor reveals itself when excavated.

- [ ] **Step 2: Run the on-device UI tests**

Run: `npm run e2e`
Expected: pass.

- [ ] **Step 3: Report**

Report the par of level 51 against level 50. Level 51 **should** be markedly easier — that is the design. If it is not, the intensity curve in Task 8 needs revisiting before this ships.
