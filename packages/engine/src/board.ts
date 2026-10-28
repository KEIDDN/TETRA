export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 40;
export const VISIBLE_HEIGHT = 20;

const LINKS_TOWARD_UP = 1 | 16 | 128; // up, up-right, up-left
const LINKS_TOWARD_DOWN = 4 | 32 | 64; // down, down-right, down-left

/** Row-major cell grid, y-up. Out-of-bounds cells count as filled, except above the top. */
export class Board {
  readonly cells = new Uint8Array(BOARD_WIDTH * BOARD_HEIGHT);
  /** Per-cell connectivity masks (see links.ts); purely visual. */
  readonly links = new Uint8Array(BOARD_WIDTH * BOARD_HEIGHT);

  get(x: number, y: number): number {
    return this.cells[y * BOARD_WIDTH + x];
  }

  set(x: number, y: number, code: number, links = 0): void {
    this.cells[y * BOARD_WIDTH + x] = code;
    this.links[y * BOARD_WIDTH + x] = links;
  }

  getLinks(x: number, y: number): number {
    return this.links[y * BOARD_WIDTH + x];
  }

  isFilled(x: number, y: number): boolean {
    if (x < 0 || x >= BOARD_WIDTH || y < 0) return true;
    if (y >= BOARD_HEIGHT) return false;
    return this.get(x, y) !== 0;
  }

  /** Indices of full rows, bottom to top. */
  fullRows(): number[] {
    const rows: number[] = [];
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (this.cells.subarray(y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH).every((c) => c !== 0)) rows.push(y);
    }
    return rows;
  }

  row(y: number): number[] {
    return Array.from(this.cells.subarray(y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH));
  }

  /** Removes full rows and returns how many were cleared. */
  clearLines(): number {
    const full = this.fullRows();
    // Pieces split by a clear lose their links across the removed row.
    for (const y of full) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (y > 0) this.links[(y - 1) * BOARD_WIDTH + x] &= ~LINKS_TOWARD_UP;
        if (y < BOARD_HEIGHT - 1) this.links[(y + 1) * BOARD_WIDTH + x] &= ~LINKS_TOWARD_DOWN;
      }
    }
    let write = 0;
    let cleared = 0;
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      if (full[cleared] === y) {
        cleared++;
        continue;
      }
      if (write !== y) {
        this.cells.copyWithin(write * BOARD_WIDTH, y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH);
        this.links.copyWithin(write * BOARD_WIDTH, y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH);
      }
      write++;
    }
    this.cells.fill(0, write * BOARD_WIDTH);
    this.links.fill(0, write * BOARD_WIDTH);
    return cleared;
  }

  /** Pushes everything up by `count` rows. Returns false if blocks were pushed off the top. */
  raise(count: number): boolean {
    const shift = count * BOARD_WIDTH;
    const overflow = this.cells.subarray(this.cells.length - shift).some((c) => c !== 0);
    this.cells.copyWithin(shift, 0, this.cells.length - shift);
    this.links.copyWithin(shift, 0, this.links.length - shift);
    this.cells.fill(0, 0, shift);
    this.links.fill(0, 0, shift);
    return !overflow;
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
