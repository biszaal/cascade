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

## Phones and tablets

Layout is chosen from the **window**, not the device, so an iPad in a narrow split view
correctly gets the compact layout. The threshold is 600pt on the shorter edge.

The board is laid out both one-row and two-row, and whichever draws bigger tokens wins,
with overflowing arrangements rejected. That single rule gives two rows on a portrait
phone and one wide row on a tablet in landscape, and handles split views and rotation with
no orientation branching anywhere.

iPhone stays portrait; iPad rotates freely. That is set per-idiom in the Info.plist rather
than at runtime.

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
npm run sounds      # regenerate the sound set
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

## Sound and feel

Sound effects are synthesised by `scripts/generate-sounds.mjs` rather than sourced: short
struck-wood knocks, licence-free and about 130KB in total. Haptics and sound fire from one
call per game event so they cannot drift apart. The audio session respects the ringer
switch and mixes with other audio rather than interrupting it.

## Accessibility

Colour is the entire mechanic, which a screen reader cannot convey, so every lane
describes what it holds and what a tap would do. Those descriptions live in
`src/game/describe.ts` as pure functions and are unit tested. Reduced motion is honoured:
the pour still travels, it just stops being lobbed.

The nine token colours come from the Okabe-Ito colourblind-safe set. Sky and Cyan, the
closest pair, are separated by lightness rather than hue, because a lightness gap survives
a colour vision deficiency and a hue gap does not.

## Tests

```
npm test            # 126 tests
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

### Known blocker on Xcode 27 (not on Xcode 26)

Apple is retiring the single-window `UIApplicationDelegate` life cycle. Expo prebuild still
emits an AppDelegate-with-window template and declares no `UIApplicationSceneManifest`, so:

- **Xcode 26 / iOS 26 SDK — fine.** Missing UIScene adoption is a *warning*; the app
  launches normally. This is what `eas.json` pins, so shipping is unaffected today.
- **Xcode 27 / iOS 27 SDK — the app will not launch.** UIKit turns the warning into an
  assert that fires before any AppDelegate method:
  `Application failed to launch: UIScene life cycle is required for apps built with this SDK`.

This was reproduced here on an iOS 27 simulator. It is an upstream Expo issue
([expo#46663](https://github.com/expo/expo/issues/46663),
[expo#46664](https://github.com/expo/expo/issues/46664)) affecting the prebuild template,
not anything in this app's code.

**Do not paper over it** by adding a bare `UIApplicationSceneManifest` to `app.json`. That
satisfies the assert but leaves the React Native window unattached to any scene, so the app
launches to a blank screen - worse than the clean failure. The real fix needs a
`UIWindowSceneDelegate` that hosts the RN root view, which belongs upstream in Expo's
template or in a config plugin once the upstream approach settles.

Until then, build and test locally against an iOS 26 or earlier simulator runtime.

## Deferred

Light theme · colourblind glyph mode · wild tokens · locked lanes · drag-to-pour · ads and
IAP · friends and social · server-side score validation · upgrading an anonymous account ·
a landscape-specific play layout that puts the HUD beside the board.
