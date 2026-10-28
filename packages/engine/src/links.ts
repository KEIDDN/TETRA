import type { Cell } from './pieces';

/**
 * Connectivity bits: which neighbours of a cell belong to the same piece.
 * Renderers use them to draw a piece as one shape instead of four tiles.
 */
export const LINK_UP = 1;
export const LINK_RIGHT = 2;
export const LINK_DOWN = 4;
export const LINK_LEFT = 8;
export const LINK_UP_RIGHT = 16;
export const LINK_DOWN_RIGHT = 32;
export const LINK_DOWN_LEFT = 64;
export const LINK_UP_LEFT = 128;

const NEIGHBOURS: readonly [dx: number, dy: number, bit: number][] = [
  [0, 1, LINK_UP],
  [1, 0, LINK_RIGHT],
  [0, -1, LINK_DOWN],
  [-1, 0, LINK_LEFT],
  [1, 1, LINK_UP_RIGHT],
  [1, -1, LINK_DOWN_RIGHT],
  [-1, -1, LINK_DOWN_LEFT],
  [-1, 1, LINK_UP_LEFT],
];

/** Link mask for every cell of a shape (y-up), in the same order. */
export function linkMasks(cells: readonly Cell[]): number[] {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  return cells.map(([x, y]) => {
    let mask = 0;
    for (const [dx, dy, bit] of NEIGHBOURS) if (set.has(`${x + dx},${y + dy}`)) mask |= bit;
    return mask;
  });
}
