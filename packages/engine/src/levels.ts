/**
 * Level systems. `blitz` follows TETR.IO's BLITZ table (rising line goals,
 * fixed gravity per level); `guideline` is the classic Marathon curve
 * (10 lines per level, (0.8 - (L-1)·0.007)^(L-1) seconds per row).
 */
export type LevelCurve = 'blitz' | 'guideline';

/** Rows per frame (G) for BLITZ levels 1–14; 20G afterwards. */
const BLITZ_GRAVITY = [0.0167, 0.0259, 0.0412, 0.067, 0.111, 0.189, 0.33, 0.588, 1.08, 2.01, 3.87, 7.62, 15.4, 20];

export function linesToLevelUp(curve: LevelCurve, level: number): number {
  if (curve === 'guideline') return 10;
  return level <= 10 ? 2 * level + 1 : 2 * level + 2;
}

export function levelForLines(curve: LevelCurve, lines: number): number {
  let level = 1;
  let needed = linesToLevelUp(curve, 1);
  while (lines >= needed) {
    level++;
    needed += linesToLevelUp(curve, level);
  }
  return level;
}

export function levelGravity(curve: LevelCurve, level: number): number {
  if (curve === 'blitz') return BLITZ_GRAVITY[Math.min(level, BLITZ_GRAVITY.length) - 1];
  const base = 0.8 - (level - 1) * 0.007;
  if (base <= 0) return 20;
  const secondsPerRow = base ** (level - 1);
  return Math.min(20, 1 / (secondsPerRow * 60));
}
