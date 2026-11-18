# Google Play release — Cascade: Colour Sorting (Android)

Package `com.biszaal.cascade`, in the same Play developer account as expenzez and iTrackHabit.
The first release goes to **Internal testing**, then is promoted to production once it has been
played on real phones. Work top to bottom.

## What is automated

| Step | Command | Notes |
|---|---|---|
| Production build (.aab) | `npx eas-cli build -p android --profile production` | Signed with the upload keystore EAS holds for the project. `versionCode` is kept on EAS and auto-increments. |
| Upload to Play | `npx eas-cli submit -p android --profile production --latest` | **Only after the first upload has been done by hand** (below). Sends to the `internal` track, per `eas.json`. Add `--auto-submit` to the build command to do both in one go. |

EAS Submit needs `google-service-account.json` in the repo root. It is gitignored: this repo is
public, so it must never be committed.

## First release — by hand in Play Console

Google's API cannot create an app or accept its first upload, so this part has to be done in
Play Console once.

1. **Create the app.** All apps → Create app.
   - App name: `Cascade: Colour Sorting`
   - Default language: English (United Kingdom) — the copy uses "colour".
   - App or game: **Game**. Free or paid: **Free**.
   - Accept the Developer Programme Policies and US export laws declarations.
2. **Upload the build to Internal testing.** Test and release → Testing → Internal testing →
   Create new release.
   - Play App Signing: accept the Google-generated app signing key. The EAS keystore becomes the
     upload key.
   - Upload the `.aab` from the EAS build page (Builds → the Android production build →
     Download).
   - Release notes: see [Release notes](#release-notes).
   - Save → Review release → Start rollout to Internal testing. Anything Play still needs before
     it will roll out is listed on that review page.
3. **Add testers.** Internal testing → Testers → create an email list with your own Google
   account and anyone else testing. Share the opt-in link; testers install from the Play Store.
4. **Give EAS Submit access.** Users and permissions → invite the service account that expenzez
   and iTrackHabit already use (its email is `client_email` in their key file) → App
   permissions → add Cascade with *Release to testing tracks*, *Manage testing tracks* and
   *Release apps to production*. Copy that key file into this repo as
   `google-service-account.json`. From here on, uploads can use EAS Submit.

## Before promoting to production

- [ ] **Played on a real Android phone** from the internal track: a level from each world, the
      daily board, Settings, and the reminder (turn it on, allow, and check one arrives).
- [ ] **Online features work.** A solved level leaves Settings › Cloud with nothing waiting to
      upload, and the daily leaderboard loads. This needs the Supabase project to be up.
- [ ] **Store listing, graphics and App content are complete** (sections below). Play Console's
      Dashboard shows what is still missing.
- [ ] If Play Console asks for **closed testing with 12 testers for 14 days** before production
      access, that is Google's rule for newer personal developer accounts; it shows on the
      Dashboard if it applies.

Then: Internal testing → the release → **Promote release → Production**, countries: all. A new
app's first production review usually takes a few days.

## Store listing

Grow users → Store presence → Main store listing.

**App name** (30 max)

```
Cascade: Colour Sorting
```

**Short description** (80 max)

```
Calm colour-sorting puzzles. 200 levels, a daily board, no ads, no timers.
```

**Full description** (4000 max)

```
Cascade is a calm, thoughtful colour-sorting puzzle. Every lane should end up holding a single colour — but you move only one token at a time, and every move counts.

200 HAND-BUILT LEVELS
Twenty chapters across four worlds, each introducing a new idea on a gentle board before testing it on a hard one.

• Water — learn to sort, then dig through face-down tokens you can't see until you reach them.
• Stone — plan around anchored tokens that never move, so their lanes can only ever finish in one colour.
• Forge — the same rules rearranged: boards that are wide and shallow, deep and narrow, or fogged unevenly so you plan outward from what you can already see.
• Light — the ten hardest chapters, ending on the hardest board in the game.

EVERY MOVE COUNTS
Solve a level in fewer moves to earn more stars. Take back a few moves, restart any time, and use a hint when you're truly stuck.

A NEW PUZZLE EVERY DAY
The daily challenge gives everyone the same board each day, with a leaderboard for the fewest moves and a streak for solving it day after day.

MADE TO FEEL GOOD
Bouncy animations, playful sound effects, a calm soundtrack and gentle haptics — never a timer, never a rush.

FOR EVERYONE
• Plays fully offline
• No ads, no in-app purchases, no sign-up
• Colourblind-friendly palette with shape cues
• Screen reader support with TalkBack
```

**Graphics** — all in `docs/store/play/`:

| Asset | File | Play's requirement |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 PNG |
| Feature graphic | `feature-graphic-1024x500.png` | 1024 × 500 |
| Phone screenshots | `screenshots/01-home.png` … `06-chapters.png` | 2–8, long side at most twice the short side |

The screenshots are the six iPhone App Store designs from the Claude Design project "Cascade
game App Store screenshots", each re-rendered 1434 wide instead of 1320: Play rejects anything
taller than 2:1, and the frames are fluid, so the phone re-centres rather than stretching.

**Fix their captions before the production release.** They date from 1.0 and Play's metadata
policy treats inaccurate claims as misleading: "100 hand-built levels" (200), "300 stars total"
and "300 stars to collect" (600), "Ten chapters" and "Spring to Mantle" (twenty, Spring to
Zenith), "Unlimited undo" (five per level — the same shot shows "Undo 5"), and "no ads
mid-level" (there are no ads at all). The App Store set carries the same captions. The phone
screens inside them are 1.0.1 captures, so the home screen reads `/100` and `/300`.

**Category:** Game → Puzzle. **Contact email:** biszaalgames@gmail.com. **Website:**
<https://www.biszaaltech.com/games/cascade>.

## App content

Policy and programmes → App content. These match the published privacy policy.

- **Privacy policy:** <https://www.biszaaltech.com/games/cascade/privacy>
- **App access:** All functionality is available without special access.
- **Ads:** No, the app does not contain ads.
- **Content rating** (IARC questionnaire): category *Game*. No violence, fear, sexuality,
  language, controlled substances, crude humour or gambling. Users cannot interact or exchange
  content with each other (the leaderboard shows generated names, moves and times only). No
  location sharing, no digital purchases.
- **Target audience:** 13–15, 16–17 and 18+. The privacy policy says Cascade is not directed to
  children under 13; selecting under-13 age groups would put the app under the Families policy.
- **News app:** No. **Government app:** No. **Financial features:** None. **Health:** None.
- **Advertising ID:** No. The merged manifest has no `AD_ID` permission.

### Data safety

- Does the app collect or share any of the required user data types? **Yes.**
- Is all user data encrypted in transit? **Yes** (HTTPS to Supabase).
- Can users request that their data is deleted? **Yes** — Settings › Delete my data in the app,
  or by email.
- Account creation: the app creates an **anonymous account** automatically; there is no username,
  password or sign-in. **Delete account URL:**
  <https://www.biszaaltech.com/games/cascade/privacy> (the "Keeping and deleting it" section
  explains both routes).

Data types — declare exactly these two, nothing else:

| Category → type | Collected | Shared | Required? | Purpose |
|---|---|---|---|---|
| Personal info → **User IDs** (the anonymous account id and its generated player name) | Yes | No | Required | App functionality |
| App activity → **Other actions** (level and daily results: moves, stars, times) | Yes | No | Required | App functionality |

Supabase hosts the data on our behalf, which Play does not count as sharing. Not collected:
name, email, location, contacts, photos, audio, files, calendar, financial or health data,
device or advertising IDs, diagnostics, crash logs. The daily reminder is scheduled on the
device and sends nothing anywhere.

## Release notes

Internal testing and the first production release (500 characters max):

```
Cascade's first release on Android: 200 hand-built colour-sorting levels across four worlds, a daily board with a leaderboard and a streak, Records to collect, and an optional daily reminder you can turn on in Settings.
```

## Android notes

- **Portrait on phones.** `plugins/withAndroidPortrait.js` locks the activity to portrait, like
  the iPhone. Apps targeting Android 16 have that lock ignored on screens 600dp and wider, so
  tablets and foldables still rotate, like the iPad.
- **Permissions.** The merged manifest asks for internet, vibration, audio settings,
  notifications and boot-completed (to restore scheduled reminders after a restart). The storage
  and draw-over-apps permissions the template adds are blocked in `app.json`.
- **Reminder permission.** Android 13+ shows its notification prompt only from the Settings
  switch, as on iOS. Verified on an Android 17 emulator: deny leaves the switch off, allow
  schedules a week of reminders on the `daily` channel.
