export interface Layout {
  width: number;
  height: number;
  cell: number;
  /** Top-left corner of the visible 10×20 field. */
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  /** Side panels (hold on the left, queue on the right). */
  sideW: number;
  holdX: number;
  nextX: number;
  previewCell: number;
}

export function computeLayout(width: number, height: number): Layout {
  // A phone held upright: the board as wide as it can be, hold and queue slimmed down beside it.
  if (height > width && width < 720) {
    const cell = Math.max(10, Math.floor(Math.min((height - 150) / 21.5, (width - 16) / 15.4)));
    const boardW = cell * 10;
    const boardH = cell * 20;
    const sideW = cell * 2.4;
    const gap = cell * 0.3;
    const boardX = Math.round((width - boardW) / 2);
    return {
      width,
      height,
      cell,
      boardX,
      boardY: Math.round((height - boardH) / 2 + cell * 0.6),
      boardW,
      boardH,
      sideW,
      holdX: boardX - gap - sideW,
      nextX: boardX + boardW + gap,
      previewCell: Math.round(cell * 0.5),
    };
  }
  // 20 visible rows + ~2 spawn rows above, clear of the 64px header.
  const cell = Math.max(12, Math.min(40, Math.floor(Math.min((height - 128) / 22, (width - 32) / 22))));
  const boardW = cell * 10;
  const boardH = cell * 20;
  const boardX = Math.round((width - boardW) / 2);
  const boardY = Math.round((height - boardH) / 2 + cell);
  const sideW = cell * 4.5;
  const gap = cell * 0.75;
  return {
    width,
    height,
    cell,
    boardX,
    boardY,
    boardW,
    boardH,
    sideW,
    holdX: boardX - gap - sideW,
    nextX: boardX + boardW + gap,
    previewCell: Math.round(cell * 0.8),
  };
}

/** Board plus a three-piece queue, filling a showcase tile (no hold, no stats). */
export function computeDemoLayout(width: number, height: number): Layout {
  const pad = 28;
  // 20 rows plus room above for the spawning piece and below for the captions.
  const cell = Math.max(8, Math.floor(Math.min((height - pad * 2) / 22.5, (width - pad * 2) / 15)));
  const boardW = cell * 10;
  const boardH = cell * 20;
  const previewCell = Math.round(cell * 0.7);
  const sideW = cell * 3.6;
  const total = boardW + cell * 0.8 + sideW;
  const boardX = Math.round((width - total) / 2);
  const boardY = Math.round((height - boardH) / 2 + cell * 0.6);
  return {
    width,
    height,
    cell,
    boardX,
    boardY,
    boardW,
    boardH,
    sideW,
    holdX: -10_000,
    nextX: boardX + boardW + cell * 0.8,
    previewCell,
  };
}
