# Design System: Goti

> A *goti* is the piece you move around a Ludo board. This game is a board, not a
> chemistry set. Every decision below follows from that.

## 1. Visual Theme & Atmosphere

A printed board game under a low lamp. Deep charcoal felt, warm off-white rules, flat
carrom-style discs with a single inset ring. The chrome is restrained and nearly
colourless so that the pieces — the only thing that carries meaning — are the only
saturated objects on screen.

Nothing glows. Nothing is glossy. There is no glass, no neon, no drop-shadow theatre.
Depth comes from a single soft shadow tinted to the paper hue, never from a dark halo.

**Density 4** (daily-app balanced) · **Variance 6** (offset asymmetric) · **Motion 6**
(fluid, spring-driven).

## 2. Colour Palette & Roles

Surface palette. One accent. No purple, no neon, no pure black.

- **Board Linen** (`#F2EEE6`) — the board surface, the app's default background
- **Chalk** (`#FBF9F5`) — sheets, cards, raised panels
- **Ink** (`#1C1B19`) — primary text and the board's drawn lines
- **Graphite** (`#6E6A63`) — secondary text, metadata, inactive states
- **Hairline** (`rgba(28,27,25,0.10)`) — 1px structural rules and lane borders
- **Recess** (`rgba(28,27,25,0.045)`) — the inside of an empty lane, a printed depression
- **Saffron** (`#C8801F`) — the single accent: primary CTA, focus ring, active state

### Token palette

Nine gameplay colours, drawn from the **Okabe-Ito colourblind-safe set**. Colour *is* the
mechanic here, so these are deliberately the most saturated objects in the app — and
deliberately the only ones. They are used on pieces and never on chrome.

| Name | Value |
|---|---|
| Vermilion | `#D55E00` |
| Sky | `#1A6FB5` |
| Emerald | `#009E73` |
| Saffron | `#E69F00` |
| Magenta | `#CC79A7` |
| Indigo | `#5A57C4` |
| Cyan | `#8FD4F5` |
| Clay | `#A97046` |
| Slate | `#8A9099` |

Every token also carries a `shade` (a darkened rim) and an `ink` (the readable text colour
on top of it), so a disc is drawn as fill + inset ring with no per-colour guesswork.

Face-down tokens use **Ink at 8%** with a graphite rim — deliberately flat and unappealing,
so the eye skips them and reads the revealed pieces first.

## 3. Typography

- **Display — Outfit.** Geometric, slightly wide, sits correctly on a board. Track-tight
  at large sizes. Hierarchy comes from weight and colour, not from screaming size.
- **Body — Outfit.** Relaxed leading, 65-character maximum measure.
- **Numerals — JetBrains Mono.** Every number in the app: move count, par, timer,
  level numbers, leaderboard ranks. Tabular numerals are what make a scoreboard read as a
  scoreboard, and they stop the move counter from jittering as it ticks.

**Banned:** Inter. System-default font stacks for anything above body text. All serifs.

## 4. Component Stylings

- **Tokens** — a flat filled circle with a 2px inset rim in the colour's shade. No
  gradient, no specular highlight, no drop shadow. A carrom striker, not a marble.
- **Lanes** — a rounded capsule of Recess with a hairline border. The base has a slightly
  heavier ink rule, like a printed baseline. A completed lane fills faintly with its own
  colour and stamps a star at its head.
- **Buttons** — flat, generously rounded, no outer glow. Primary is Saffron fill with
  chalk text; secondary is a hairline outline over the board. Active state translates down
  1px — a tactile press, not an opacity fade.
- **Sheets** — Chalk over a dimmed board, corner radius 28, one soft paper-tinted shadow.
- **Loading** — skeleton blocks matching the real layout's dimensions. Never a spinner.
- **Empty states** — a composed illustration of the board's own vocabulary (an empty lane,
  a scattered token) with one clear action. Never the words "No data".

## 5. Layout Principles

- The board is the hero and is vertically centred in the remaining space after the HUD.
- Lanes wrap into at most two rows, sized to fit the narrowest supported viewport without
  scrolling. **The board never scrolls.**

### Size classes

Layout is decided by the **window**, never the device. An iPad handed a narrow split view
genuinely is a compact layout, and treating it as a tablet because of the hardware is how
a two-column grid ends up crammed into 320 points. The threshold is 600pt on the shorter
edge - an iPad mini is 744pt wide in portrait, the largest iPhone is 440pt.

- **Compact** (phone, narrow split view): content fills the width minus 16pt gutters.
  Tokens up to 54pt. Level trail three across.
- **Regular** (tablet): content is capped at 620pt and centred - a 1000pt-wide button is a
  worse target, not a better one. Tokens up to 84pt. Level trail five across. Display type
  scales by 1.2; **body text does not scale**, because iOS itself does not scale it either.

### Choosing the board arrangement

The board is laid out both ways - one row and two - and whichever draws the **bigger
tokens** wins, with any arrangement that overflows the window rejected outright. Two rows
is right on a portrait phone where width is scarce; one row is right on a tablet in
landscape where height is scarce. Deriving it from the measurement rather than branching
on orientation means split views and rotation are handled with no special cases.

### Orientation

iPhone is portrait only - a landscape phone board is cramped. iPad rotates freely, because
people prop tablets in stands and expect that to work. This is set per-idiom in the
Info.plist rather than at runtime.
- Level select is a **winding trail**, not a grid — nodes follow a serpentine path that
  echoes a Ludo track.
- Every interactive element is at least 44px. Lanes get an expanded hit area beyond their
  drawn bounds, because a near-miss tap on a puzzle board feels broken.
- **Every lane describes itself aloud.** The entire mechanic is colour, which a screen
  reader cannot show, so each lane states what it holds and what tapping it would do -
  "Lane 2, Emerald on top, 2 in a row, 3 of 4, 1 face down". Those strings are pure
  functions and they are tested.
- Safe-area insets respected on every screen; nothing sits under the notch or home bar.

## 6. Motion & Interaction

- **Spring physics everywhere:** `damping 20, stiffness 100`. No linear easing.
- **The pour is an arc, not a tween.** Lift the token clear of its lane, travel along a
  quadratic bezier whose control point sits above both lanes, then drop with a brief squash
  on landing. A straight-line slide is the single biggest tell of a cheap sorting game.
- **Completion** — tokens bounce in a bottom-up stagger, then a star stamps in over the
  lane head with a slight overshoot.
- **Perpetual micro-motion** — the lifted token holds a slow 2px float while it waits for a
  destination, so the board never looks frozen mid-decision.
- **Invalid move** — a short horizontal shake plus a warning haptic. Never a modal, never
  a toast.
- **Haptics** — selection on lift, light on place, success on lane completion, warning on
  invalid.
- Animate `transform` and `opacity` **only**. Never `width`, `height`, `top`, or `left`.

**Interaction model:** tap a lane to lift, tap a second lane to pour, tap the lifted lane
again to cancel. One-handed and unambiguous. Drag is out of scope.

## 7. Anti-Patterns (Banned)

- No emojis anywhere in the UI
- No Inter, no system font stacks, no serifs
- No pure black (`#000000`) - the darkest surface in the app is `#17161A`
- No neon, no outer glows, no glass, no gloss on tokens
- No gradient text
- No more than one accent colour in the chrome
- No timers, no lives, no energy meters
- No ads, no coin balance, no rewarded-video buttons
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No filler UI text: "Scroll to explore", bouncing chevrons, scroll arrows
- No generic placeholder names ("John Doe", "Player 1")
- No fake round statistics
- No spinners where a skeleton would do
- No overlapping elements — every element owns its spatial zone
