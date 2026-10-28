import { BOARD_WIDTH, SHAPES, spawnPosition, type Action, type Game, type PieceType, type Rotation } from '@tetra/engine';

/** Rows considered when evaluating; the demo never stacks higher. */
const ROWS = 24;

/** El-Tetris weights (Pierre Dellacherie's features, tuned by Islam El-Ashi). */
const W = {
  landingHeight: -4.5,
  rowsCleared: 3.42,
  rowTransitions: -3.22,
  columnTransitions: -9.35,
  holes: -7.9,
  wells: -3.39,
};

interface Placement {
  rotation: Rotation;
  x: number;
  score: number;
}

function fits(grid: Uint8Array, type: PieceType, rotation: Rotation, x: number, y: number): boolean {
  for (const [cx, cy] of SHAPES[type][rotation]) {
    const gx = x + cx;
    const gy = y + cy;
    if (gx < 0 || gx >= BOARD_WIDTH || gy < 0) return false;
    if (gy < ROWS && grid[gy * BOARD_WIDTH + gx]) return false;
  }
  return true;
}

function evaluate(grid: Uint8Array, landingHeight: number, cleared: number): number {
  const filled = (x: number, y: number) => x < 0 || x >= BOARD_WIDTH || y < 0 || grid[y * BOARD_WIDTH + x] !== 0;
  let rowTransitions = 0;
  let columnTransitions = 0;
  let holes = 0;
  let wells = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = -1; x < BOARD_WIDTH; x++) if (filled(x, y) !== filled(x + 1, y)) rowTransitions++;
  }
  for (let x = 0; x < BOARD_WIDTH; x++) {
    for (let y = -1; y < ROWS - 1; y++) if (filled(x, y) !== filled(x, y + 1)) columnTransitions++;
    let covered = false;
    let well = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (filled(x, y)) covered = true;
      else if (covered) holes++;
      if (!filled(x, y) && filled(x - 1, y) && filled(x + 1, y)) wells += ++well;
      else well = 0;
    }
  }
  return (
    W.landingHeight * landingHeight +
    W.rowsCleared * cleared +
    W.rowTransitions * rowTransitions +
    W.columnTransitions * columnTransitions +
    W.holes * holes +
    W.wells * wells
  );
}

/** Best spot for `type`: rotate at spawn, slide, hard drop (no tucks or spins). */
export function bestPlacement(board: { get(x: number, y: number): number }, type: PieceType): Placement | null {
  const grid = new Uint8Array(BOARD_WIDTH * ROWS);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < BOARD_WIDTH; x++) grid[y * BOARD_WIDTH + x] = board.get(x, y);
  const spawn = spawnPosition(type);
  let best: Placement | null = null;
  const rotations: Rotation[] = type === 'O' ? [0] : [0, 1, 2, 3];
  for (const rotation of rotations) {
    if (!fits(grid, type, rotation, spawn.x, spawn.y)) continue;
    for (const dir of [-1, 1]) {
      for (let x = spawn.x; fits(grid, type, rotation, x, spawn.y); x += dir) {
        if (dir === 1 && x === spawn.x) continue;
        let y = spawn.y;
        while (fits(grid, type, rotation, x, y - 1)) y--;
        const next = grid.slice();
        const cells = SHAPES[type][rotation];
        for (const [cx, cy] of cells) if (y + cy < ROWS) next[(y + cy) * BOARD_WIDTH + x + cx] = 1;
        let cleared = 0;
        for (let row = ROWS - 1; row >= 0; row--) {
          const line = next.subarray(row * BOARD_WIDTH, (row + 1) * BOARD_WIDTH);
          if (line.every((c) => c !== 0)) {
            cleared++;
            next.copyWithin(row * BOARD_WIDTH, (row + 1) * BOARD_WIDTH);
            next.fill(0, (ROWS - 1) * BOARD_WIDTH);
          }
        }
        const ys = cells.map(([, cy]) => y + cy);
        const landing = (Math.min(...ys) + Math.max(...ys)) / 2;
        const score = evaluate(next, landing, cleared);
        if (!best || score > best.score) best = { rotation, x, score };
      }
    }
  }
  return best;
}

const ROTATE: Record<number, Action | null> = { 0: null, 1: 'rotateCW', 2: 'rotate180', 3: 'rotateCCW' };

/**
 * Plays a game by pressing keys like a person would, so the piece visibly
 * travels. Used for the live board on the home screen.
 */
export class AutoPlayer {
  private plan: { at: number; action: Action }[] = [];
  private planned: unknown = null;

  constructor(
    private game: Game,
    private pace = { think: 220, tap: 75 },
  ) {}

  update(t: number): void {
    const game = this.game;
    const piece = game.piece;
    if (!piece || game.state !== 'playing') return;
    if (this.planned !== piece) {
      this.planned = piece;
      this.plan = [];
      const target = bestPlacement(game.board, piece.type);
      let at = t + this.pace.think * (0.7 + Math.random() * 0.6);
      if (target) {
        const rotate = ROTATE[target.rotation];
        if (rotate) this.plan.push({ at: (at += this.pace.tap), action: rotate });
        const dx = target.x - piece.x;
        for (let i = 0; i < Math.abs(dx); i++) this.plan.push({ at: (at += this.pace.tap), action: dx < 0 ? 'moveLeft' : 'moveRight' });
      }
      this.plan.push({ at: at + this.pace.tap * 1.4, action: 'hardDrop' });
    }
    while (this.plan.length && this.plan[0].at <= t) {
      const { at, action } = this.plan.shift()!;
      game.input(action, true, at);
      game.input(action, false, at + 1);
    }
  }
}
