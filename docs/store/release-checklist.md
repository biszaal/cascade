# Release checklist — Cascade: Colour Sorting 1.0 (iOS)

What is automated, what is not, and the exact answers for the parts App Store Connect only
accepts by hand. Work top to bottom.

## Automated

| Step | Command | Notes |
|---|---|---|
| Production build + TestFlight upload | `npx eas-cli build -p ios --profile production --auto-submit` | Builds from the current branch - run it on `master`. Build number auto-increments. |
| Store listing text, category, age rating | `npx eas-cli metadata:push` | Reads `store.config.json`; run `npx eas-cli metadata:lint` first. **Pushed 13 Sep 2026** — listing, version 1.0.0, category, age rating and manual release are synced. |

## Before submitting

- [x] **Privacy and support pages are live** at
      <https://www.biszaaltech.com/games/cascade/privacy> and
      <https://www.biszaaltech.com/games/cascade>. App Review opens both. Deployed 13 Sep 2026.
- [ ] **The build under review is the latest TestFlight build** and has been played on a real
      device: a level from each world, the daily puzzle, Settings.
- [ ] **Online features work against the real backend:** a fresh install signs in anonymously,
      a solved level appears in `level_results`, a daily result appears on the leaderboard, and
      Settings shows the Cloud section.
- [ ] **Anonymous sign-ins are enabled** in Supabase (Authentication → Sign In / Providers).
      Without it every online feature silently does nothing.

## App Store Connect — by hand

EAS Metadata does not cover these.

### App Privacy

1.0 ships with the Supabase backend, so **data is collected**. Answer:

- **Do you or your third-party partners collect data from this app?** Yes.
- **Identifiers → User ID** — the anonymous Supabase account id.
  Purpose: *App Functionality*. Linked to the user: **Yes** (it is an account id). Used for
  tracking: **No**.
- **User Content → Gameplay Content** — best moves, stars and times per level, and daily moves
  and time. Purpose: *App Functionality*. Linked to the user: **Yes**. Used for tracking: **No**.
- Nothing else: no name, email, location, contacts, purchases, diagnostics or advertising data.

The privacy page at <https://www.biszaaltech.com/games/cascade/privacy> describes exactly this.
If what the app sends changes, update the page and these answers before that build ships.

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

## Known limits of 1.1

- Daily leaderboard scores are client-reported and can be forged. The planned fix is an edge
  function that replays a submitted move list against the engine before accepting it.
- Chapters 1-5 contain three duplicate board pairs (levels 1/2, 23/26, 35/38), kept because
  removing them would reprice levels already scored against.
- One Undertow level (39) was repriced from par 16 to 15 in 1.1.0, when a lane dealt already
  finished stopped counting as fog. Stored stars are unaffected; only a replay is rescored.
