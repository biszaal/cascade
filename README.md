# Cascade

A colour-sort puzzle game for iOS and Android. Tokens fall one at a time from lane to
lane - flat carrom-style discs on dark felt, not glossy spheres in glass test tubes.

## What makes it not a clone

- **Par scoring instead of lives.** A search solves every level before it ships, and its
  optimal move count becomes that level's par. Three stars means you matched the solver.
  There are no timers, no lives, no energy meters, no ads, and no coins.
- **A pure TypeScript engine.** All the rules live in `src/engine` with zero React Native
  imports, so the same code runs in three places: the build-time level generator, the
  in-app hint, and later a server-side score validator.
- **Face-down tokens** as a difficulty lever from chapter four onward.

## Rules

Move the top token of one lane onto a matching top, or into an empty lane. A lane is
finished when it holds one colour and is full.

**Exactly one token moves per move.** A run of three same-coloured tokens costs three
moves to relocate, not one. This is the rule everything else depends on - the solver
models it identically, and if it ever stopped doing so every par in the game would be
wrong.

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
assets/levels/          the 200 generated levels, committed
supabase/migrations/    schema and row level security
```

## Levels

200 levels across twenty chapters, generated offline and committed. Never generated at
runtime, so par is exact and a level is identical on every device forever. More chapters
can be added by extending the plan; the pipeline does not change.

**The curve is authored by hand** in `scripts/level-plan.ts`, one spec per level. An
earlier version ramped a single spec across a whole chapter, and thirty levels ended up
feeling like one level thirty times - the boards differed but the shape of the problem
never did. Now difficulty is a sawtooth: it rises overall, drops into a rest every few
levels, and each new mechanic is taught on an easy board before it is tested on a hard
one. Lane depth (3, 4 or 5) varies alongside colour count, because depth changes how a
board feels more than another colour does.

One measured result shaped it: a board with **one free lane tops out around eight moves**
however hard it is tangled, because its reachable state space is genuinely shallow. Those
boards are therefore short and tight rather than hard, and the plan labels them `tight`
instead of pretending they are difficulty peaks.

```
npm run levels                # regenerate every pack, one process per chapter
npm run levels -- --from 16   # regenerate chapters 16 and above only
npm run browse                # render every level to level-browser.html for review
npm run sounds                # regenerate the sound set
```

Chapters 11-20 search far harder than 1-10 (8M nodes, pools of up to 48 candidates), so
generation is measured in minutes per chapter: on a 10-core laptop a forge chapter took up
to 7 minutes and a light chapter up to 14, with chapters running side by side. `--from`
writes exactly what a full run would, because every chapter's seeds and ids are fixed by the
plan.

`npm run browse` writes a single page showing all 200 boards with their pacing chart,
board shape and design note. It is how the curve gets reviewed: a table of numbers cannot
tell you whether two hundred levels feel different from one another, and the boards side
by side can.

Generation deals a shuffled board, solves it with IDA*, and scores difficulty mostly from
**nodes expanded** - search effort predicts human difficulty far better than solution
length, because a long forced solution is easy while a short one with many plausible wrong
turns is not. Each planned level gets its own pool of candidates, and the one matching its
intended intensity is shipped.

**With only one free lane, a randomly dealt board is unsolvable about 92% of the time** -
not slow to solve, actually impossible. Those boards are therefore built by `reverseBoard`,
which walks backwards from the finished position and is solvable by construction.

## The daily streak

Consecutive daily boards solved, counted in **UTC days** - the clock the board itself is
keyed on. Hints refill at the player's local midnight, which is right for a courtesy tied to
their own day, but the streak counts boards, and there is exactly one board per UTC day. On a
local clock the count would be wrong in both directions: east of Greenwich the board turns
over mid-evening, so one local day can hold two boards; west of it two local days can hold
solves of the same one. It also agrees with the server, which only accepts a daily result
dated UTC today or yesterday.

A run holds through the whole day after it was last extended, because that board has not been
missed yet. A stamp one day *ahead* holds it too - that is a device clock a few hours fast
across midnight, the same case `hintsFor` defends against - and anything further ahead ends
the run. Nothing can be farmed by winding a clock forward, because extending a run still needs
consecutive days.

`streakOn` never writes: a lapsed run simply reads zero and the next solve starts a new one,
so there is no midnight timer and no write path to get wrong. There are deliberately no
freezes and no repair; a thing you earn, hold and spend is a currency, and this game does not
have one.

The streak is **device-local and never synced**. There is no column for it, syncing it would
be new data collection, and a client-reported streak is forgeable anyway. It does not follow
the player to a second device.

## Records

`src/game/achievements.ts` is a list of records and a pure predicate each, over a snapshot of
what progress already stores. Nothing is written when one is earned, so a record cannot be
lost, desynced or missed because an event did not fire. The cost is that there is no unlock
date, and nothing earned before the screen shipped has an unlock *moment*.

The one thing written is `seenRecords`, which is a "have you been told" record rather than an
"is it earned" one - losing it costs an animation, never a record.

What is left out is as deliberate as what is in. Nothing is timed, because the store promises
"never a timer, never a rush". Nothing rewards finishing without hints or undos, because
rewarding abstinence turns a courtesy back into a currency. No session counts, tap counts or
days opened - fake round statistics, which `DESIGN.md` bans outright.

The set is tested by earning it: one case asserts an empty snapshot earns nothing and a
maximal one earns everything, which is what catches a record that can never be earned at all.

## Reminders

One optional local notification, off until the player turns it on in Settings › Daily. There is
no push server: the OS is asked for permission, the reminders are scheduled on the device, and
the game never learns whether one was opened.

**The permission is requested from the switch and nowhere else.** iOS grants exactly one system
prompt for the life of an install, so asking at launch - before the player has asked for
anything - is how the feature ends up denied forever. `remindersEnabled` is stored only after
the OS actually grants it, so the switch can never read on while the phone stays silent, and a
permission revoked in the OS turns it back off on the next foreground.

The schedule is a **rolling window of one-shot triggers**, not a repeating daily one. A
repeating trigger cannot be conditional, so it would fire on a day the player had already
solved. Rescheduling the whole window instead makes it idempotent, so it can safely re-run on
every foreground, after every daily solve, and whenever the time changes.

## Sound and feel

Sound effects and music are synthesised by `scripts/generate-sounds.mjs` rather than sourced:
cartoon bloops, boinks and bells, plus a 53-second music-box loop rendered circularly so it has
no seam. Licence-free, about 2.7MB in total, almost all of it the music. Haptics and sound fire
from one call per game event so they cannot drift apart. Music has its own switch in Settings
and pauses when the app leaves the foreground. Sound and music play even with the phone on
silent - only the game's own switches mute them - and mix with other audio rather than
interrupting it.

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
npm test            # 133 unit tests (engine, solver, generator, layout, a11y, curve)
npm run typecheck
npm run e2e         # 5 UI tests on a booted simulator
```

The most valuable one is `scripts/levels.test.ts`. The packs are generated once and
committed, so a later change to the pour rules or the solver would fail no unit test - it
would silently invalidate the par of every level. That test re-solves each shipped level
against the current rules and catches it. It also encodes the authored pacing - that each
chapter ends on its hardest board, that every rest is genuinely easier than what came
before, and that the game does not ship the same board fifty times.

`npm run e2e` runs XCUITests against a real simulator, covering the two things neither a
unit test nor a browser preview can reach: **taps on a device** and **rotation**. The
sharpest of them is `testE_orientationContract`, which asserts the opposite outcome per
idiom - an iPad must rotate to landscape, an iPhone must refuse - which is the only way to
prove the per-idiom `Info.plist` keys actually work. See `e2e/README.md`.

Those tests locate lanes through the accessibility labels the app already exposes, so the
automation and the accessibility work verify each other.

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

Apply the files in `supabase/migrations/` to your project, in order. `0003` adds
`delete_my_account`, which Settings › Delete my data calls: App Store guideline 5.1.1(v) requires
in-app deletion for any app that creates accounts, anonymous ones included.

### Known gap

Daily scores are client-reported and therefore forgeable. The fix is designed for but not
built: because the engine has no React Native imports, it drops into an edge function that
replays a submitted move list and rejects anything that does not reach a solved board.

## iOS builds

`eas.json` pins `macos-tahoe-26.5-xcode-26.6` on **every** iOS profile. Apple rejects
uploads not built with the iOS 26 SDK (`ITMS-90725`), and without an explicit image EAS
picks one from the Expo SDK version, which on older SDKs ships an Xcode too old to pass.

**Pin the image for this Expo SDK, not the lowest Xcode 26 image.** Expo tags one image per
SDK; SDK 57's is `macos-tahoe-26.5-xcode-26.6`, while `macos-sequoia-15.6-xcode-26.0` is
tagged `sdk-54`. Both ship the iOS 26 SDK, so both clear `ITMS-90725` - but the toolchain
still has to be new enough to compile Expo's own Swift. Building SDK 57 on the `sdk-54`
image fails in the compile step, because `expo-modules-core` and `expo-modules-jsi` declare
`weak let` (SE-0481, Swift 6.2+) and annotate `RuntimeScheduler` for C++ interop:

```
'weak' must be a mutable variable, because it may change at runtime
'RuntimeScheduler' cannot be annotated with either SWIFT_RETURNS_RETAINED or
  SWIFT_RETURNS_UNRETAINED because it is not returning a SWIFT_SHARED_REFERENCE type
```

So the pin has to move with each SDK upgrade. It is a floor that tracks the SDK, not a
ceiling that avoids new Xcodes.

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

**Status as of 2026-09-09 — still unfixed on SDK 57, and no longer tracked.** Verified by
`grep -c UIApplicationSceneManifest ios/Cascade/Info.plist` → `0`, and no Expo package in
`node_modules` declares one. expo#46663 was closed as *"incomplete issue: missing or
invalid repro"*, so nobody upstream is working on it. React Native is doing the groundwork
([react-native#53602](https://github.com/facebook/react-native/pull/53602) removes the
AppDelegate `window` assumptions that break under a `SceneDelegate`), but Expo's template
still has to adopt it.

The reproduction this project already has is exactly what that issue was closed for
lacking. Filing it as a fresh, reproducible report is the cheapest way to stop this
becoming a shipping emergency the day Apple raises the SDK floor to iOS 27.

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
