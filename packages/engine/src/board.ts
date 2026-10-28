export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 40;
export const VISIBLE_HEIGHT = 20;

/** Row-major cell grid, y-up. Out-of-bounds cells count as filled, except above the top. */
export class Board {
  readonly cells = new Uint8Array(BOARD_WIDTH * BOARD_HEIGHT);

  get(x: number, y: number): number {
    return this.cells[y * BOARD_WIDTH + x];
  }

  set(x: number, y: number, code: number): void {
    this.cells[y * BOARD_WIDTH + x] = code;
  }

  isFilled(x: number, y: number): boolean {
    if (x < 0 || x >= BOARD_WIDTH || y < 0) return true;
    if (y >= BOARD_HEIGHT) return false;
    return this.get(x, y) !== 0;
  }

  /** Removes full rows and returns how many were cleared. */
  clearLines(): number {
    let write = 0;
    let cleared = 0;
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      const row = this.cells.subarray(y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH);
      if (row.every((c) => c !== 0)) {
        cleared++;
        continue;
      }
      if (write !== y) this.cells.copyWithin(write * BOARD_WIDTH, y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH);
      write++;
    }
    this.cells.fill(0, write * BOARD_WIDTH);
    return cleared;
  }

  isEmpty(): boolean {
    return this.cells.every((c) => c === 0);
  }

  /** Fills rows from a picture, top row first. '#'/'X' = garbage, '.' = empty, piece letters = that piece. */
  static fromRows(rows: string[]): Board {
    const board = new Board();
    const codes: Record<string, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7, '#': 8, X: 8 };
    rows.forEach((row, i) => {
      const y = rows.length - 1 - i;
      [...row].forEach((ch, x) => board.set(x, y, codes[ch] ?? 0));
    });
    return board;
  }
}
