import { BOARD_WIDTH } from '@tetra/engine';
import { filled, ROWS, type Field } from './field';

/** How a bot values a board. Each bot's personality is a set of these. */
export interface Weights {
  /** Per cell of average height. */
  height: number;
  /** Extra penalty per row above the danger line (quadratic). */
  danger: number;
  holes: number;
  /** Per filled cell sitting above a hole. */
  covered: number;
  bumpiness: number;
  bumpinessSq: number;
  rowTransitions: number;
  /** Reward per row of a clean well (up to 4), for quads. */
  well: number;
  /** Which column the well should be in; -1 = any edge-ish. */
  wellColumn: number;
  /** Reward for each ready T-spin double slot. */
  tslot: number;
  /** Reward per line of attack sent. */
  attack: number;
  /** Penalty for clears that send nothing (burning lines). */
  wastedClear: number;
  /** Penalty for any clear that isn't a quad or a spin (it breaks B2B and wastes setup). */
  burn: number;
  /** Reward per level of a live B2B streak. */
  b2b: number;
  /** Penalty for breaking a B2B streak. */
  b2bBreak: number;
  perfectClear: number;
}

export const BALANCED: Weights = {
  height: -0.35,
  danger: -1.2,
  holes: -7,
  covered: -1,
  bumpiness: -0.5,
  bumpinessSq: -0.08,
  rowTransitions: -0.45,
  well: 0.9,
  wellColumn: -1,
  tslot: 4,
  attack: 5,
  wastedClear: -2.5,
  burn: -7,
  b2b: 1.5,
  b2bBreak: -6,
  perfectClear: 40,
};

const DANGER_LINE = 12;

export interface Features {
  heights: number[];
  maxHeight: number;
  holes: number;
  covered: number;
  bumpiness: number;
  bumpinessSq: number;
  rowTransitions: number;
  wellDepth: number;
  wellAt: number;
  /** Rows above the well's floor that are full except the well column: quad readiness. */
  wellReady: number;
  tslots: number;
}

export function features(f: Field): Features {
  const heights = new Array<number>(BOARD_WIDTH).fill(0);
  for (let x = 0; x < BOARD_WIDTH; x++) {
    for (let y = ROWS - 1; y >= 0; y--) {
      if (f[y] & (1 << x)) {
        heights[x] = y + 1;
        break;
      }
    }
  }
  const maxHeight = Math.max(...heights);
  let holes = 0;
  let covered = 0;
  for (let x = 0; x < BOARD_WIDTH; x++) {
    let above = 0;
    for (let y = heights[x] - 1; y >= 0; y--) {
      if (f[y] & (1 << x)) above++;
      else {
        holes++;
        covered += Math.min(above, 4);
      }
    }
  }
  // The well is the lowest column; it doesn't count toward bumpiness.
  let wellAt = 0;
  for (let x = 1; x < BOARD_WIDTH; x++) if (heights[x] < heights[wellAt]) wellAt = x;
  const left = wellAt > 0 ? heights[wellAt - 1] : Infinity;
  const right = wellAt < BOARD_WIDTH - 1 ? heights[wellAt + 1] : Infinity;
  const wellDepth = Math.max(0, Math.min(left, right) - heights[wellAt]);
  let bumpiness = 0;
  let bumpinessSq = 0;
  for (let x = 0; x < BOARD_WIDTH - 1; x++) {
    if (x === wellAt || x + 1 === wellAt) continue;
    const d = Math.abs(heights[x] - heights[x + 1]);
    bumpiness += d;
    bumpinessSq += d * d;
  }
  let rowTransitions = 0;
  for (let y = 0; y < maxHeight; y++) {
    let prev = true;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const c = (f[y] & (1 << x)) !== 0;
      if (c !== prev) rowTransitions++;
      prev = c;
    }
    if (!prev) rowTransitions++;
  }
  let wellReady = 0;
  const wellRow = ((1 << BOARD_WIDTH) - 1) & ~(1 << wellAt);
  for (let y = heights[wellAt]; y < ROWS && f[y] === wellRow; y++) wellReady++;
  return { heights, maxHeight, holes, covered, bumpiness, bumpinessSq, rowTransitions, wellDepth, wellAt, wellReady, tslots: tslots(f, heights) };
}

/**
 * Counts T-spin double slots: a T-shaped hole pointing down, both bottom
 * corners filled, an overhang on one side, open from above on the other,
 * and both rows ready to clear once the T is in.
 */
function tslots(f: Field, heights: number[]): number {
  let count = 0;
  for (let c = 1; c < BOARD_WIDTH - 1; c++) {
    const r = heights[c];
    if (r < 1 || r >= ROWS - 2) continue;
    // T flat row is r (cells c-1..c+1), stem at (c, r-1).
    if (filled(f, c, r - 1) || filled(f, c - 1, r) || filled(f, c, r) || filled(f, c + 1, r)) continue;
    if (!filled(f, c - 1, r - 1) || !filled(f, c + 1, r - 1)) continue;
    const overLeft = filled(f, c - 1, r + 1);
    const overRight = filled(f, c + 1, r + 1);
    if (overLeft === overRight) continue;
    const bottom = f[r - 1] | (1 << c);
    const top = f[r] | (7 << (c - 1));
    const full = (1 << BOARD_WIDTH) - 1;
    if (bottom === full && top === full) count += 1;
    else if (bottom === full || top === full) count += 0.4;
  }
  return count;
}

export function evaluate(f: Field, w: Weights, incoming = 0): number {
  const ft = features(f);
  const avg = ft.heights.reduce((a, b) => a + b, 0) / BOARD_WIDTH;
  const effective = ft.maxHeight + incoming;
  const over = Math.max(0, effective - DANGER_LINE);
  let score =
    w.height * avg +
    w.danger * over * over +
    w.holes * ft.holes +
    w.covered * ft.covered +
    w.bumpiness * ft.bumpiness +
    w.bumpinessSq * ft.bumpinessSq +
    w.rowTransitions * ft.rowTransitions +
    w.tslot * ft.tslots;
  if (w.wellColumn < 0 || ft.wellAt === w.wellColumn) score += w.well * Math.min(ft.wellReady, 4);
  return score;
}
