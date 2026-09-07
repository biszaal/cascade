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

/** Lanes wrap into at most two rows; more than that and the board reads as a spreadsheet. */
export function rowsFor(laneCount: number): { rows: number; perRow: number } {
  if (laneCount <= 5) return { rows: 1, perRow: laneCount };
  const perRow = Math.ceil(laneCount / 2);
  return { rows: 2, perRow };
}

export function computeGeometry(
  laneCount: number,
  capacity: number,
  availableWidth: number,
  availableHeight: number,
): Geometry {
  const { rows, perRow } = rowsFor(laneCount);

  const slotGap = 3;
  const lanePadding = 6;
  const columnGap = 10;
  const rowGap = 20;

  // Widest token that lets a row fit side by side.
  const widthBudget = (availableWidth - columnGap * (perRow - 1)) / perRow - lanePadding * 2;

  // Tallest token that lets every row stack vertically.
  const heightBudget =
    (availableHeight - rowGap * (rows - 1)) / rows / capacity - slotGap - (lanePadding * 2) / capacity;

  const tokenSize = Math.max(MIN_TOKEN, Math.min(MAX_TOKEN, Math.floor(Math.min(widthBudget, heightBudget))));

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
