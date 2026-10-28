/** Coordinates are y-up: y = 0 is the bottom row of the board. */
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Rotation = 0 | 1 | 2 | 3;
export type Cell = readonly [x: number, y: number];

export const PIECE_TYPES: readonly PieceType[] = ['Z', 'L', 'O', 'S', 'I', 'J', 'T'];

/** Board cell codes. 0 is empty. */
export const PIECE_CODE: Record<PieceType, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
export const GARBAGE_CODE = 8;
export const CODE_PIECE: readonly (PieceType | null)[] = [null, 'I', 'O', 'T', 'S', 'Z', 'J', 'L', null];

const BASE: Record<PieceType, { size: number; cells: Cell[] }> = {
  I: { size: 4, cells: [[0, 2], [1, 2], [2, 2], [3, 2]] },
  O: { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { size: 3, cells: [[0, 1], [1, 1], [2, 1], [1, 2]] },
  S: { size: 3, cells: [[0, 1], [1, 1], [1, 2], [2, 2]] },
  Z: { size: 3, cells: [[0, 2], [1, 2], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 2], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 2], [0, 1], [1, 1], [2, 1]] },
};

function rotateCW(cells: readonly Cell[], size: number): Cell[] {
  return cells.map(([x, y]) => [y, size - 1 - x] as const);
}

/** SHAPES[type][rotation] = cells relative to the piece's bounding box origin (bottom-left). */
export const SHAPES: Record<PieceType, readonly (readonly Cell[])[]> = Object.fromEntries(
  PIECE_TYPES.map((type) => {
    const { size, cells } = BASE[type];
    const states: Cell[][] = [cells];
    for (let r = 1; r < 4; r++) states.push(rotateCW(states[r - 1], size));
    return [type, states];
  }),
) as Record<PieceType, Cell[][]>;

export function boxSize(type: PieceType): number {
  return BASE[type].size;
}

/** Spawn box origin: pieces appear in rows 20-21, just above the visible field. */
export function spawnPosition(type: PieceType): { x: number; y: number } {
  if (type === 'O') return { x: 4, y: 20 };
  if (type === 'I') return { x: 3, y: 18 };
  return { x: 3, y: 19 };
}
