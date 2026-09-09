# Design System: Cascade

> Tokens fall one at a time from lane to lane. This game is a board, not a chemistry set.
> Every decision below follows from that.

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

The board is dark. §1 asks for a low lamp, and a saturated disc carries further on
charcoal than it does on paper — which matters when colour *is* the mechanic.

- **Board** (`#17161A`) — deep charcoal felt, the app's default background. Never `#000`:
  pure black reads as a hole, not a surface
- **Chalk** (`#201F25`) — sheets, cards and controls, one step up so panels lift off the felt
- **Ink** (`#F0EDE6`) — primary text and drawn lines, warm off-white to match the felt
- **Graphite** (`#98938B`) — secondary text, metadata, inactive states
- **Hairline** (`rgba(240,237,230,0.13)`) — 1px structural rules and lane borders
- **Recess** (`rgba(0,0,0,0.26)`) — the inside of an empty lane. A well cut *into* the felt,
  so it goes darker, not lighter
- **Baseline** (`rgba(240,237,230,0.20)`) — the printed rule along a lane's base
- **Saffron** (`#E0952B`) — the single accent: primary CTA, focus ring, active state.
  Lifted in luminance from the token saffron so it carries on a dark ground

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

## 4. The Mark

Three lanes on a descending stagger: Emerald filled to the brim, Vermilion two deep, Sky
holding one. Colour being gathered lane by lane — the whole game in one glyph, reading as a
diagonal from the top left, the direction an eye already travels.

The mark is built from the board's own parts. A lane is the same recessed capsule with the
same hairline edge; a disc is the same flat fill with the same inset rim. Nothing in the
icon is drawn only for the icon.

- **Proportions** are multiples of a lane's width, so one number sets the mark at any size:
  lane padding `0.075`, disc `0.85`, slot gap `0.09`, lane gap `0.24`, rim `0.037` of a
  disc. Depth 3 gives a lane height of `2.88` and a mark aspect of `1.208` wide to tall.
- **Three hues, not two.** An earlier pass — a full green lane beside a single amber disc —
  read unmistakably as a traffic light. Spreading the palette across the wheel and breaking
  the symmetry removes the association.
- **The discs carry it alone at small sizes.** Lane edges fall below a pixel by 58pt, which
  is fine: the stagger is legible in monochrome and with the lanes gone entirely.
- **Android monochrome** keeps the discs solid and drops the lanes to 40% — the same
  silhouette, no colour required.

`src/components/Logo.tsx` draws it in the app and `scripts/generate-icons.mjs` draws every
launcher asset, from the same constants. Change one and change the other; `npm run icons`
redraws the PNGs.

## 5. Component Stylings

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

## 6. Layout Principles

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

## 7. Motion & Interaction

- **Spring physics everywhere:** `damping 20, stiffness 100`. No linear easing.
- **The fall is an arc, not a tween.** Lift the token clear of its lane, travel along a
  quadratic bezier whose control point sits above both lanes, then drop with a brief squash
  on landing. A straight-line slide is the single biggest tell of a cheap sorting game.
- **One token lifts, because one token moves.** Raising a whole same-coloured run would
  promise a pour the rules do not deliver.
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

## 8. Anti-Patterns (Banned)

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
