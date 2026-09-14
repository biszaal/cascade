import type { TextStyle } from 'react-native';

/**
 * Code mirror of DESIGN.md. That document is the source of truth; if you change a
 * value here, change it there too.
 */

export const surface = {
  /** Deep charcoal felt. Never pure black - #000 reads as a hole, not a surface. */
  board: '#17161A',
  /** Sheets, cards and controls: one step up from the board so panels lift off it. */
  chalk: '#201F25',
  /** Primary text and drawn lines - warm off-white, to match the board's warmth. */
  ink: '#F0EDE6',
  graphite: '#98938B',
  hairline: 'rgba(240,237,230,0.13)',
  /** The inside of an empty lane: a well cut INTO the felt, so it goes darker. */
  recess: 'rgba(0,0,0,0.26)',
  /** The printed rule along a lane's base. */
  baseline: 'rgba(240,237,230,0.20)',
  scrim: 'rgba(0,0,0,0.62)',
  /** Single accent, lifted slightly in luminance so it carries on a dark ground. */
  accent: '#E0952B',
  accentSoft: 'rgba(224,149,43,0.16)',
  /** Unearned stars, empty progress tracks and skeleton blocks. */
  inactive: 'rgba(240,237,230,0.16)',
  track: 'rgba(240,237,230,0.09)',
  skeleton: 'rgba(240,237,230,0.06)',
  danger: '#E8703A',
} as const;

/**
 * Gameplay palette, drawn from the Okabe-Ito colourblind-safe set.
 *
 * `fill` is the disc, `shade` is its inset rim, `ink` is readable text on top of it.
 * Used on pieces only - never on chrome.
 */
export interface TokenColor {
  readonly name: string;
  readonly fill: string;
  readonly shade: string;
  readonly ink: string;
}

export const tokenColors: readonly TokenColor[] = [
  { name: 'Vermilion', fill: '#D55E00', shade: '#A34700', ink: '#FFF6F0' },
  { name: 'Sky', fill: '#1A6FB5', shade: '#0E4E84', ink: '#F0F7FC' },
  { name: 'Emerald', fill: '#009E73', shade: '#007355', ink: '#F0FBF7' },
  { name: 'Saffron', fill: '#E69F00', shade: '#B07A00', ink: '#241800' },
  { name: 'Magenta', fill: '#CC79A7', shade: '#9E5480', ink: '#2B1220' },
  { name: 'Indigo', fill: '#5A57C4', shade: '#403DA0', ink: '#F1F1FA' },
  { name: 'Cyan', fill: '#8FD4F5', shade: '#5AA8CE', ink: '#08222E' },
  { name: 'Clay', fill: '#A97046', shade: '#7E5232', ink: '#FBF3EC' },
  { name: 'Slate', fill: '#8A9099', shade: '#666C75', ink: '#15171A' },
] as const;

/** Face-down pieces read as flat and uninteresting on purpose - the eye should skip them. */
export const hiddenToken = {
  fill: 'rgba(240,237,230,0.07)',
  shade: 'rgba(240,237,230,0.17)',
  ink: '#98938B',
  /** The question mark on a face-down piece. Legible, but never louder than a colour. */
  mark: 'rgba(240,237,230,0.42)',
} as const;

/**
 * Chapter accents, used on the level trail and chapter cards.
 *
 * Every consumer looks these up by `chapter.color % chapterColors.length`, so running out
 * fails silently rather than loudly - a chapter beyond the end of this list does not
 * error, it just quietly wears an earlier chapter's accent. Keep this at least as long as
 * the number of chapters that exist.
 */
export const chapterColors = [
  '#E69F00',
  '#009E73',
  '#D55E00',
  '#5A57C4',
  '#CC79A7',
  '#8A9099',
  '#F0E442', // Okabe-Ito yellow
  '#56B4E9', // Okabe-Ito sky blue
  '#8C5A3C', // umber
  '#7D4E8C', // plum
] as const;

/** 4pt base scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  sheet: 28,
  pill: 999,
} as const;

/** One rounded, friendly family for the whole game - titles, body and numbers alike. */
export const font = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  body: 'Fredoka_400Regular',
  bodyMedium: 'Fredoka_500Medium',
  /** Every numeral in the app. Kept as its own role so numbers can be restyled in one place. */
  mono: 'Fredoka_600SemiBold',
  monoBold: 'Fredoka_700Bold',
} as const;

/** Tabular figures stop counters jittering as they tick, wherever the platform supports them. */
const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

// A rounded face crowds when it is tracked tight, so display sizes sit at natural spacing.
export const type = {
  hero: { fontFamily: font.displayBold, fontSize: 44, lineHeight: 50, letterSpacing: 0 },
  title: { fontFamily: font.display, fontSize: 28, lineHeight: 34, letterSpacing: 0 },
  heading: { fontFamily: font.display, fontSize: 20, lineHeight: 26, letterSpacing: 0 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  numeral: { fontFamily: font.mono, fontSize: 16, lineHeight: 20, fontVariant: tabular },
  numeralLarge: { fontFamily: font.monoBold, fontSize: 32, lineHeight: 36, fontVariant: tabular },
} as const;

/** Premium, weighty. Never linear easing. */
export const spring = {
  default: { damping: 24, stiffness: 160, mass: 0.9 },
  snappy: { damping: 25, stiffness: 320, mass: 0.6 },
  soft: { damping: 30, stiffness: 120, mass: 1 },
} as const;

/**
 * Every animated timing in the app, in milliseconds. Components import from here rather
 * than carrying literals, so the game's whole sense of pace is one block to read and one
 * block to change.
 */
export const duration = {
  /** One leg of a pour arc. */
  pour: 170,
  /** The same travel with the lob removed, for reduced motion. */
  pourCalm: 100,
  /** A token's hop across the solved board. */
  hop: 90,
  /** Between tokens in a celebration, and between rows of a list. */
  stagger: 28,
  /** One leg of a lane's refusal shake. */
  shake: 45,
  /** The win sheet, and a star that is not being awarded. */
  sheet: 140,
  /** A screen's first paint. */
  enter: 240,
  /** Between blocks staggered into that first paint. */
  enterStagger: 35,
  /** Before the first star stamps, and between each stamp after it. */
  stampLead: 120,
  stampGap: 100,
  /** Before the out-of-moves sheet covers the board, so the last pour visibly lands. */
  stuckDelay: 450,
  /** One swing of the glum token's wobble on that sheet. */
  stuckWobble: 900,
} as const;

/** One soft shadow, tinted to the paper hue. Never a dark halo. */
export const elevation = {
  resting: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lifted: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;
