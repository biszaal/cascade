/**
 * Board geometry. Pure arithmetic, no React - so the awkward part (making a nine-lane
 * board fit a small phone without scrolling) is unit-testable.
 *
 * The board NEVER scrolls. Everything is sized down until it fits.
 */

export interface Geometry {
  tokenSize: number;
  laneWidth: number;
  laneHeight: number;
  lanePadding: number;
  slotGap: number;
  rowGap: number;
  columnGap: number;
  perRow: number;
  rows: number;
  boardWidth: number;
  boardHeight: number;
}

export interface Slot {
  x: number;
  y: number;
}

/** Below this a token stops being comfortably tappable. */
export const MIN_TOKEN = 22;
/** Above this the board stops reading as a board and starts reading as buttons. */
export const MAX_TOKEN = 54;

/** How lanes wrap for a given number of rows. At most two - more reads as a spreadsheet. */
export function rowsFor(laneCount: number, rows = laneCount <= 5 ? 1 : 2): { rows: number; perRow: number } {
  if (rows <= 1) return { rows: 1, perRow: laneCount };
  return { rows: 2, perRow: Math.ceil(laneCount / 2) };
}

/**
 * Pick the arrangement that draws the biggest tokens.
 *
 * Wrapping to two rows is right on a portrait phone, where width is scarce, and wrong in
 * landscape on a tablet, where height is scarce and a single row of eleven lanes fits
 * comfortably. Rather than branching on orientation, lay the board out both ways and keep
 * whichever wins - the geometry then adapts to any window, including an iPad split view,
 * with no special cases to get wrong.
 */
export function computeGeometry(
  laneCount: number,
  capacity: number,
  availableWidth: number,
  availableHeight: number,
  /** Largest a token may be drawn. Tablets pass a bigger cap than phones. */
  maxToken: number = MAX_TOKEN,
): Geometry {
  const options = laneCount <= 5 ? [1] : [1, 2];
  const candidates = options.map((rowCount) =>
    arrange(laneCount, capacity, availableWidth, availableHeight, maxToken, rowCount),
  );

  const fits = (g: Geometry) => g.boardWidth <= availableWidth && g.boardHeight <= availableHeight;

  // Prefer the biggest tokens among arrangements that actually fit. Both can hit the
  // minimum token size in a very small window - a narrow split view, say - and there the
  // larger-token test cannot separate them, so an arrangement that overflows must never
  // win on a tie.
  const usable = candidates.filter(fits);
  if (usable.length > 0) {
    return usable.reduce((best, g) => (g.tokenSize > best.tokenSize ? g : best));
  }

  // Nothing fits: take the narrowest, which clips least.
  return candidates.reduce((best, g) => (g.boardWidth < best.boardWidth ? g : best));
}

function arrange(
  laneCount: number,
  capacity: number,
  availableWidth: number,
  availableHeight: number,
  maxToken: number,
  rowCount: number,
): Geometry {
  const { rows, perRow } = rowsFor(laneCount, rowCount);

  // Spacing grows with the token, so a big board does not look like a small one zoomed.
  // The gaps depend on the token size and the token size depends on the gaps, so solve it
  // twice: once with the cap as a guess, then again using what actually fit. Deriving the
  // gaps from the CAP alone would pad a cramped board as generously as a roomy one.
  const gapsFor = (token: number) => {
    const scale = Math.max(1, token / MAX_TOKEN);
    return {
      slotGap: Math.round(3 * scale),
      lanePadding: Math.round(6 * scale),
      columnGap: Math.round(10 * scale),
      rowGap: Math.round(20 * scale),
    };
  };

  const solve = (gaps: ReturnType<typeof gapsFor>) => {
    // Widest token that lets a row fit side by side.
    const widthBudget =
      (availableWidth - gaps.columnGap * (perRow - 1)) / perRow - gaps.lanePadding * 2;
    // Tallest token that lets every row stack vertically.
    const heightBudget =
      (availableHeight - gaps.rowGap * (rows - 1)) / rows / capacity -
      gaps.slotGap -
      (gaps.lanePadding * 2) / capacity;
    return Math.max(MIN_TOKEN, Math.min(maxToken, Math.floor(Math.min(widthBudget, heightBudget))));
  };

  const provisional = solve(gapsFor(maxToken));
  const { slotGap, lanePadding, columnGap, rowGap } = gapsFor(provisional);
  const tokenSize = solve({ slotGap, lanePadding, columnGap, rowGap });

  const laneWidth = tokenSize + lanePadding * 2;
  const laneHeight = capacity * tokenSize + (capacity - 1) * slotGap + lanePadding * 2;

  return {
    tokenSize,
    laneWidth,
    laneHeight,
    lanePadding,
    slotGap,
    rowGap,
    columnGap,
    perRow,
    rows,
    boardWidth: perRow * laneWidth + (perRow - 1) * columnGap,
    boardHeight: rows * laneHeight + (rows - 1) * rowGap,
  };
}

/** Top-left corner of a lane, relative to the board. */
export function lanePosition(geometry: Geometry, laneIndex: number, laneCount: number): Slot {
  const row = Math.floor(laneIndex / geometry.perRow);
  const column = laneIndex % geometry.perRow;

  // Centre a short final row rather than leaving it hanging to the left.
  const lanesInRow = Math.min(geometry.perRow, laneCount - row * geometry.perRow);
  const rowWidth = lanesInRow * geometry.laneWidth + (lanesInRow - 1) * geometry.columnGap;
  const inset = (geometry.boardWidth - rowWidth) / 2;

  return {
    x: inset + column * (geometry.laneWidth + geometry.columnGap),
    y: row * (geometry.laneHeight + geometry.rowGap),
  };
}

/**
 * Where a token sits, relative to the board.
 *
 * `slot` counts from the BOTTOM, matching the engine's array order, so slot 0 is drawn
 * lowest on screen.
 */
export function slotPosition(
  geometry: Geometry,
  laneIndex: number,
  slot: number,
  capacity: number,
  laneCount: number,
): Slot {
  const lane = lanePosition(geometry, laneIndex, laneCount);
  const fromTop = capacity - 1 - slot;
  return {
    x: lane.x + geometry.lanePadding,
    y: lane.y + geometry.lanePadding + fromTop * (geometry.tokenSize + geometry.slotGap),
  };
}
