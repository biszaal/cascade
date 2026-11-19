# Notes for Review — Cascade 1.1.0

Paste the block below into App Store Connect → the 1.1.0 version → App Review Information →
Notes. It describes the **1.1.0** binary. Re-check every line against the build actually under
review before pasting.

Sign-In required: **No**. Leave the demo account fields empty.

**Before submitting:** the Supabase backend must be reachable, and the build must be 11 or later
(builds 9 and 10 point at Cascade's old, deleted project). Without a backend, Settings › Delete my
data answers "Couldn't delete your data", the daily leaderboard never appears, and App Review
will test both. Since 1.1.0 Cascade lives in the cave-helicopter project; check it with
`curl -s -o /dev/null -w '%{http_code}' https://dqiwnvfqmexpuzbwjhha.supabase.co/auth/v1/health`
(anything but `000` means the host answers).

---

Cascade is a single-player colour-sorting puzzle game. Every lane should end up holding one
colour, and you move one token at a time.

NO ACCOUNT, NO DEMO NEEDED
There is no sign-up, sign-in, or account creation anywhere in the app. Nothing is gated.
Launch it and level 1 is playable immediately. No demo credentials are required.

WHAT IS NEW IN 1.1.0
- 100 new levels: two new worlds, Forge and Light, take the game to 200 levels in twenty
  chapters.
- A daily streak for solving the daily board on consecutive days.
- Records: seventeen milestones, shown from the home screen (tap the Solved / Stars row).
- An optional daily reminder, off by default (see Permissions).
- Settings › Delete my data (see Data deletion).

HOW TO SEE EVERYTHING
- Levels unlock in sequence. The first level of each chapter is always open, so you do not
  need to finish a chapter to see the next one: tap Chapters on the home screen.
- The daily challenge is on the home screen. Its leaderboard appears once the board is solved.
- Records: tap the Solved / Stars row on the home screen.

PERMISSIONS
The only permission the app can ask for is notifications, and only when the player turns on
Settings › Daily › Reminder. It is never requested at launch. The reminder is a local
notification scheduled on the device: there is no push server and no push token. Declining
leaves the switch off and the game unaffected. No location, camera, microphone, contacts,
photos, or tracking, and no App Tracking Transparency prompt because nothing is tracked.

DATA DELETION (Guideline 5.1.1(v))
The app creates an anonymous account automatically (see Network and Data). Settings › Your
data › Delete my data deletes that account, its level and daily results, its leaderboard
entries, and the progress stored on the device, after a confirmation. It needs a connection; if
the server cannot be reached nothing is deleted and the player is told so.

NETWORK AND DATA
The game is fully playable offline; every level and the daily board are generated on the
device. The network is used only for cloud backup of your own results and for the daily
leaderboard. On first launch the app opens an anonymous session with our backend (Supabase).
No personal data is collected, no credentials exist, and the player never sees an account.
The only data stored is level results (level, moves, stars, time) and daily results (moves,
time), against a random identifier and a generated player name such as "Player 1234".

NO USER-GENERATED CONTENT
There is no way to enter text anywhere in the app. The daily leaderboard shows the generated
player name, moves and time only. No chat, no comments, no profiles, no sharing.

NO MONETISATION
No in-app purchases, no subscriptions, no advertising, no third-party analytics or
advertising SDKs of any kind.

ENCRYPTION
The app uses only standard HTTPS for the backend calls, which is why
ITSAppUsesNonExemptEncryption is set to false.

ACCESSIBILITY
Full VoiceOver support, a colourblind-friendly palette with shape cues, and reduced-motion
support.

Thank you for reviewing.
