/**
 * Size classes and layout metrics.
 *
 * Pure arithmetic so the awkward cases - an iPad in a one-third split view, a phone in
 * landscape - are unit-testable rather than something you discover on a device.
 *
 * The class is decided by the WINDOW, never the screen. An iPad running this app in a
 * narrow split view genuinely is a compact layout, and treating it as a tablet because
 * of the hardware it happens to be on is how apps end up with a two-column grid crammed
 * into 320 points.
 */

export type SizeClass = 'compact' | 'regular';

export interface Metrics {
  sizeClass: SizeClass;
  isTablet: boolean;
  isLandscape: boolean;
  /** Horizontal page padding. */
  gutter: number;
  /** Max width for lists, forms and buttons - text and controls should not stretch. */
  contentWidth: number;
  /** Max width the board may occupy. */
  boardWidth: number;
  /** Largest a token may be drawn. */
  maxToken: number;
  /** Nodes per row on the level trail. */
  trailColumns: number;
  /** Multiplier for display type only. Body text does not scale - iOS does not either. */
  displayScale: number;
}

/**
 * 600pt on the shorter edge is the usual tablet threshold: an iPad mini is 744pt wide in
 * portrait, while the largest iPhone is 440pt.
 */
export const TABLET_MIN_EDGE = 600;

export function sizeClassFor(width: number, height: number): SizeClass {
  return Math.min(width, height) >= TABLET_MIN_EDGE ? 'regular' : 'compact';
}

export function metricsFor(width: number, height: number): Metrics {
  const sizeClass = sizeClassFor(width, height);
  const isLandscape = width > height;

  if (sizeClass === 'compact') {
    const gutter = 16;
    return {
      sizeClass,
      isTablet: false,
      isLandscape,
      gutter,
      contentWidth: width - gutter * 2,
      boardWidth: Math.min(width - gutter * 2, 480),
      maxToken: 54,
      trailColumns: 3,
      displayScale: 1,
    };
  }

  const gutter = 32;
  return {
    sizeClass,
    isTablet: true,
    isLandscape,
    gutter,
    // Controls stay a comfortable reading and reaching width instead of spanning the
    // whole slab - a 1000pt-wide button is a worse target, not a better one.
    contentWidth: Math.min(width - gutter * 2, 620),
    // Landscape gets the full width: with every lane on one row the board is the whole
    // screen's job, and capping it just shrinks the tokens for no reason.
    boardWidth: Math.min(width - gutter * 2, isLandscape ? 1200 : 760),
    maxToken: 84,
    trailColumns: 5,
    displayScale: 1.2,
  };
}
