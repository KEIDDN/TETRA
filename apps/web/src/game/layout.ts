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
