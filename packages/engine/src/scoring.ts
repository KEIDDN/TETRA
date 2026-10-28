import type { ClearInfo } from './game';

const CLEAR = [0, 100, 300, 500, 800];
const SPIN = [400, 800, 1200, 1600, 2600];
const MINI = [100, 200, 400, 800, 1600];
const ALL_CLEAR = 3500;
const B2B_MULTIPLIER = 1.5;
const COMBO_BONUS = 50;

/** Points for a clear (TETR.IO BLITZ table), multiplied by the level the clear lands in. */
export function clearScore(info: ClearInfo, level: number): number {
  const table = info.spin === 'full' ? SPIN : info.spin === 'mini' ? MINI : CLEAR;
  let base = table[Math.min(info.lines, 4)];
  // b2b >= 1 means this difficult clear continues a chain.
  if (info.lines > 0 && info.b2b >= 1) base *= B2B_MULTIPLIER;
  const combo = info.combo > 0 ? COMBO_BONUS * info.combo : 0;
  const allClear = info.perfectClear ? ALL_CLEAR : 0;
  return Math.floor((base + combo + allClear) * level);
}

export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
