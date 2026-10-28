import { BOARD_HEIGHT, BOARD_WIDTH, SHAPES, type PieceType, type Rotation } from '@tetra/engine';

/** Rows as 10-bit masks (bit x = column x), y-up. Cheap to copy and test. */
export type Field = Uint16Array;

export const FULL_ROW = (1 << BOARD_WIDTH) - 1;
export const ROWS = BOARD_HEIGHT;

export function emptyField(): Field {
  return new Uint16Array(ROWS);
}

/** Builds a field from anything with `get(x, y)` (the engine board). */
export function fieldFrom(board: { get(x: number, y: number): number }): Field {
  const f = emptyField();
  for (let y = 0; y < ROWS; y++) {
    let row = 0;
    for (let x = 0; x < BOARD_WIDTH; x++) if (board.get(x, y) !== 0) row |= 1 << x;
    f[y] = row;
  }
  return f;
}

/** Piece cells per rotation, precomputed. */
export const CELLS: Record<PieceType, readonly (readonly (readonly [number, number])[])[]> = SHAPES;

export function fits(f: Field, type: PieceType, rot: Rotation, x: number, y: number): boolean {
  for (const [cx, cy] of CELLS[type][rot]) {
    const gx = x + cx;
    const gy = y + cy;
    if (gx < 0 || gx >= BOARD_WIDTH || gy < 0) return false;
    if (gy < ROWS && f[gy] & (1 << gx)) return false;
  }
  return true;
}

export function filled(f: Field, x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_WIDTH || y < 0) return true;
  if (y >= ROWS) return false;
  return (f[y] & (1 << x)) !== 0;
}

/** Places a piece and clears lines in place. Returns the number of lines cleared. */
export function place(f: Field, type: PieceType, rot: Rotation, x: number, y: number): number {
  for (const [cx, cy] of CELLS[type][rot]) {
    const gy = y + cy;
    if (gy < ROWS) f[gy] |= 1 << (x + cx);
  }
  let write = 0;
  let cleared = 0;
  for (let r = 0; r < ROWS; r++) {
    if (f[r] === FULL_ROW) {
      cleared++;
      continue;
    }
    f[write++] = f[r];
  }
  for (; write < ROWS; write++) f[write] = 0;
  return cleared;
}

/** Adds `count` garbage rows at the bottom with a hole at `hole`. */
export function addGarbage(f: Field, count: number, hole: number): void {
  f.copyWithin(count, 0, ROWS - count);
  for (let y = 0; y < count; y++) f[y] = FULL_ROW & ~(1 << hole);
}
