# Goti

A colour-sort puzzle game for iOS and Android. A *goti* is the piece you move around a
Ludo board, which is what this game is made of: flat carrom-style discs on dark felt,
not glossy spheres in glass test tubes.

## What makes it not a clone

- **Par scoring instead of lives.** A search solves every level before it ships, and its
  optimal move count becomes that level's par. Three stars means you matched the solver.
  There are no timers, no lives, no energy meters, no ads, and no coins.
- **A pure TypeScript engine.** All the rules live in `src/engine` with zero React Native
  imports, so the same code runs in three places: the build-time level generator, the
  in-app hint, and later a server-side score validator.
- **Face-down tokens** as a difficulty lever from chapter four onward.

## Rules

Pour the top of one lane onto a matching top, or into an empty lane. A lane is finished
when it holds one colour and is full.

**A pour moves every consecutive same-coloured token at once and counts as one move.**
This is the rule everything else depends on - the solver models pours identically, and if
it ever stopped doing so every par in the game would be wrong.

Face-down tokens are one line, in `applyMoveInPlace`:

```ts
hidden = Math.min(hidden, tokens.length - 1)
```

The top of a lane can never be face-down, so removing a token necessarily flips the next
one up. A lane that becomes full and single-coloured reveals itself, so a player can never
complete a lane blind and not be told.

## Layout

```
app/                    expo-router screens
src/engine/             PURE TS - rules, IDA* solver, seeded generator. Unit tested.
src/game/               layout geometry, scoring, haptics
src/components/         Board, Lane, Token, HUD, WinSheet
src/state/              session (one playthrough) and progress (persisted)
src/data/               level packs, Supabase sync, daily challenge
scripts/                build-time level generation + pack validation
assets/levels/          the 180 generated levels, committed
supabase/migrations/    schema and row level security
```

## Levels

180 levels across six chapters, generated offline and committed. Never generated at
runtime, so par is exact and a level is identical on every device forever.

```
npm run levels      # regenerate every pack (~5 minutes)
```

Generation deals a shuffled board, solves it with IDA*, and scores difficulty mostly from
**nodes expanded** - search effort predicts human difficulty far better than solution
length, because a long forced solution is easy while a short one with many plausible wrong
turns is not. Candidates are ranked in a pool and picked by percentile, so the ramp inside
a chapter calibrates itself instead of anyone guessing absolute scores.

One measured constraint shaped the whole curve: **with only one free lane, a randomly
dealt board is genuinely unsolvable about 92% of the time** - not slow to solve, actually
impossible. So every chapter deals with two free lanes, and difficulty comes from colour
count, lane capacity and face-down tokens. `reverseBoard` (walk backwards from the finished
position, solvable by construction) exists for tighter boards.

## Tests

```
npm test            # 91 tests
npm run typecheck
```

The most valuable one is `scripts/levels.test.ts`. The packs are generated once and
committed, so a later change to the pour rules or the solver would fail no unit test - it
would silently invalidate the par of all 180 levels. That test re-solves every shipped
level against the current rules and catches it.

## Supabase (optional)

The game is fully playable with no network and no credentials. Local storage is the source
of truth; sync only ever mirrors it.

```
cp .env.example .env      # then fill in the two values
```

Players sign in **anonymously** on first launch, so there is no signup wall. Every table is
locked by row level security to its owning user; the daily leaderboard is served by a
`SECURITY DEFINER` function, which is deliberately the only path that returns another
player's row.

Apply `supabase/migrations/0001_init.sql` to your project.

### Known gap

Daily scores are client-reported and therefore forgeable. The fix is designed for but not
built: because the engine has no React Native imports, it drops into an edge function that
replays a submitted move list and rejects anything that does not reach a solved board.

## iOS builds

`eas.json` pins `macos-sequoia-15.6-xcode-26.0` on **every** iOS profile. Apple rejects
uploads not built with the iOS 26 SDK (`ITMS-90725`), and without an explicit image EAS
picks one from the Expo SDK version that ships an older Xcode.

## Deferred

Light theme · colourblind glyph mode · wild tokens · locked lanes · drag-to-pour · ads and
IAP · friends and social · server-side score validation · upgrading an anonymous account.
