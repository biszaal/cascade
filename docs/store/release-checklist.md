# Release checklist — Cascade: Colour Sorting 1.0 (iOS)

What is automated, what is not, and the exact answers for the parts App Store Connect only
accepts by hand. Work top to bottom.

## Automated

| Step | Command | Notes |
|---|---|---|
| Production build + TestFlight upload | `npx eas-cli build -p ios --profile production --auto-submit` | Builds from the current branch - run it on `master`. Build number auto-increments. |
| Store listing text, category, age rating | `npx eas-cli metadata:push` | Reads `store.config.json`. Needs the privacy and support pages live first. |

## Before submitting

- [ ] **Privacy and support pages are live** at
      <https://www.biszaaltech.com/games/cascade/privacy> and
      <https://www.biszaaltech.com/games/cascade>. App Review opens both.
- [ ] **The build under review is the latest TestFlight build** and has been played on a real
      device: a level from each world, the daily puzzle, Settings.
- [ ] **No online features are visible.** The daily screen shows no leaderboard, and Settings
      shows no Cloud/Sync section. The `testG_storeTour` UI test asserts both.

## App Store Connect — by hand

EAS Metadata does not cover these.

### App Privacy

- **Data collection:** *No, we do not collect data from this app.*
- This is accurate for 1.0 only because no backend is configured: nothing leaves the device.
  **If Supabase is ever enabled, this answer and the privacy page must change before that build
  ships.** Anonymous sign-in creates a user identifier, and the leaderboard stores gameplay data.

### Screenshots

Upload from `e2e/shots` (exported by `testG_storeTour`):

| Display | Required size | Source simulator |
|---|---|---|
| iPhone 6.9" | 1320 × 2868 | `AppStore-6.9` (iOS 18.5) |
| iPad 13" | 2064 × 2752 | `AppStore-iPad13` (iOS 18.5) |

Order: home, sorting, face-down tokens, anchors, anchors and fog, chapters. The
`verify-*` images are test evidence, not store screenshots — do not upload them.

### Pricing and availability

- **Price:** Free. The app has no in-app purchases.
- **Availability:** all territories, unless you decide otherwise.

### Version information

- **Build:** select the latest production build uploaded by EAS.
- **Sign-in required:** No.
- **App Review contact:** name, phone and email are required, and are not stored in this repo.
- **Review notes:** in `docs/store/listing.md` ("App Review notes").
- **Release:** manual. `store.config.json` sets `automaticRelease: false`, so an approved build
  waits for you to release it.

## Known limits of 1.0

- Online leaderboard and cloud sync are off. They need the new Supabase account, and the
  privacy answers above change when they ship.
- Chapters 1-5 contain three duplicate board pairs (levels 1/2, 23/26, 35/38), kept because
  removing them would reprice levels already scored against.
- Chapters 11-20 are specced (`docs/superpowers/specs/2026-09-13-chapters-11-20-design.md`)
  but not built. They ship as a content update.
