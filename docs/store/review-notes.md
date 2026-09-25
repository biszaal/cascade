# Notes for Review — Cascade 1.0.1

Paste the block below into App Store Connect → App Review Information → Notes. It describes
the **1.0.1** binary (build 7), not the current tree: 1.0.1 ships no notifications, no
in-app data deletion, and 100 levels across two worlds. Re-check every line against the
build actually under review before pasting.

Sign-In required: **No**. Leave the demo account fields empty.

---

Cascade is a single-player colour-sorting puzzle game. Every lane should end up holding one
colour, and you move one token at a time.

NO ACCOUNT, NO DEMO NEEDED
There is no sign-up, sign-in, or account creation anywhere in the app. Nothing is gated.
Launch it and level 1 is playable immediately. No demo credentials are required.

WHAT IS NEW IN 1.0.1
- An out-of-moves prompt offering undo (5 per level) or restart.
- A new visual theme with rounded lettering.
- Sound effects and a soundtrack, both switchable off in Settings.
- Locked tokens now show a padlock.
- The daily challenge fits on one screen.

HOW TO SEE EVERYTHING
- Levels unlock in sequence. The first level of each chapter is always open, so you do not
  need to finish a chapter to see the next one: tap Chapters on the home screen.
- The daily challenge is on the home screen. Its leaderboard appears once the board is
  solved.
- The out-of-moves prompt appears when a board has no legal move left; tap Undo or Restart
  to carry on.

PERMISSIONS
The app requests no permissions at all. No notifications, location, camera, microphone,
contacts, photos, or tracking. There is no App Tracking Transparency prompt because nothing
is tracked.

NETWORK AND DATA
The game is fully playable offline; every level and the daily board are generated on the
device. The network is used only for optional cloud save of your own results and for the
daily leaderboard. On first launch the app opens an anonymous session with our backend
(Supabase). No personal data is collected, no credentials exist, and the player never sees
an account. The only data stored is level results: level number, moves, stars and
completion time, against a random identifier.

NO USER-GENERATED CONTENT
There is no way to enter text anywhere in the app. The daily leaderboard shows rank, moves
and time only; every entry is labelled "Anonymous", as there is no display-name feature.
No chat, no comments, no profiles, no sharing.

NO MONETISATION
No in-app purchases, no subscriptions, no advertising, no third-party analytics or
advertising SDKs of any kind.

ENCRYPTION
The app uses only standard HTTPS for the optional backend calls, which is why
ITSAppUsesNonExemptEncryption is set to false.

ACCESSIBILITY
Full VoiceOver support, a colourblind-friendly palette with shape cues, and reduced-motion
support.

Thank you for reviewing.
