# App Store listing — Cascade: Colour Sorting (1.0)

Source of truth for the store copy. `store.config.json` pushes the same text through
`eas metadata:push`. Screenshots and App Privacy answers are not supported by EAS Metadata and
must be set in App Store Connect by hand (see the release checklist).

| Field | Limit | Value |
|---|---|---|
| Name | 30 | Cascade: Colour Sorting |
| Subtitle | 30 | Calm colour-sorting puzzles |
| Category | — | Games → Puzzle |
| Age rating | — | 4+ (no objectionable content, no web access, no gambling) |
| Copyright | — | 2026 Biszaal Tech Ltd. |
| Support email | — | biszaalgames@gmail.com |

## Promotional text (170)

100 hand-built levels across two worlds. Sort colours one token at a time, dig through face-down tokens, and plan around anchors that never move.

## Keywords (100 characters total)

sort,color,puzzle,ball sort,water sort,logic,brain,relax,offline,tube,daily,calm,strategy

Words already in the name (cascade, colour, sorting) are left out; Apple indexes the name
separately, so repeating them wastes the limit.

## Description

Cascade is a calm, thoughtful colour-sorting puzzle. Every lane should end up holding a single colour — but you move only one token at a time, and every move counts.

100 HAND-BUILT LEVELS
Ten chapters across two worlds, each introducing a new idea on a gentle board before testing it on a hard one.

• Water — learn to sort, then dig through face-down tokens you can't see until you reach them.
• Stone — plan around anchored tokens that never move, so their lanes can only ever finish in one colour.

EVERY MOVE COUNTS
Solve a level in fewer moves to earn more stars. Take back a few moves, restart any time, and use a hint when you're truly stuck.

A NEW PUZZLE EVERY DAY
The daily challenge gives everyone the same board each day, with a leaderboard for the fewest moves.

MADE TO FEEL GOOD
Bouncy animations, playful sound effects, a calm soundtrack and gentle haptics — never a timer, never a rush.

FOR EVERYONE
• Plays fully offline
• No ads, no in-app purchases, no sign-up
• Colourblind-friendly palette with shape cues
• Full VoiceOver support
• Designed for iPhone and iPad

## What's new (1.0)

Welcome to Cascade.

## App Review notes

Paste the block below into both the Resolution Center reply and **App Review Information →
Notes** (4,000-character limit). Fill in the bracketed recording details first.

```text
1. SCREEN RECORDING
Attached. Recorded on an [iPhone model] running iOS [version], using build [1.0.x (n)] installed from TestFlight. It starts at launch and shows playing and solving levels, the daily challenge and its leaderboard, and Settings, including deleting the account.

2. PURPOSE AND AUDIENCE
Cascade: Colour Sorting is a single-player logic puzzle for a general audience (rated 4+), aimed at teens and adults who enjoy calm, thoughtful puzzles. Each board has lanes of coloured tokens, and the goal is to finish with one colour per lane while moving only one token at a time. The value is a relaxing, no-pressure puzzle for short sessions: no timers, lives, ads or purchases. A solver checks that every level can be solved before release, and the solver's move count sets the par for the star rating.

3. SETUP AND ACCESS
No login, credentials, sample files or setup are needed.
- Launch the app. The home screen shows Start playing (Continue after the first level), Chapters, Daily challenge and Settings.
- Tap Start playing. Tap a lane to lift its top token, then tap another lane to place it on a matching colour or in an empty lane. Undo, Restart and Hint sit below the board. Solving a level awards up to three stars.
- Chapters and levels unlock in order. Chapters 4-5 add face-down tokens, and chapters 6-10 (the Stone world) add anchored tokens that never move.
- Daily challenge: every player gets the same board each day. Once it is solved, that day's leaderboard (fewest moves) appears.
- Settings: switches for haptics, sound and music, plus Sync now and Delete my data.
Everything except the leaderboard and sync works offline.

Accounts, user content and payments:
- There is no registration or login. When the app first opens with a connection, it quietly creates an anonymous account so results can be backed up and entered on the daily leaderboard. The account holds no email, name or phone number.
- Players never type anything. Leaderboard names are generated (for example "Player 1234") and can't be changed, so the app has no user-generated content.
- There is no paid content: no in-app purchases, subscriptions or ads.
- Account deletion is in the app: Settings > Delete my data > Delete. It deletes the anonymous account and all of its results from our server, then clears progress on the device. The recording shows it.

4. EXTERNAL SERVICES
- Supabase (supabase.com): anonymous authentication and a Postgres database hosted in Ireland (AWS eu-west-1). It is used only to back up level results and serve the daily leaderboard.
- No other runtime services: no analytics, advertising, tracking, crash reporting, payment or AI services.

5. REGIONAL DIFFERENCES
None. The app works the same in every region. The daily board changes at 00:00 UTC for all players worldwide, and there is one global leaderboard. The app is in English.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. Cascade is a puzzle game outside any regulated industry. All levels, artwork, sound effects and music are original to Biszaal Tech Ltd., and the audio is synthesised by our own code. The only third-party asset is the Fredoka font, used under the SIL Open Font License.
```
