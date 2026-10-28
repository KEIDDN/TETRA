import type { ClearInfo } from './game';

/**
 * Versus rules, after TETR.IO's defaults: the base attack table, the
 * "multiplier" combo table, back-to-back charging with surge, and margin
 * time. Values the TETR.IO wiki doesn't pin down are configurable.
 */
export interface AttackRules {
  /** Lines added on top of an all clear's own attack. */
  allClear: number;
  /** B2B streak at which surge starts charging. */
  surgeStart: number;
  /** Surge size when it starts charging; +1 per further B2B. */
  surgeInitial: number;
  /** ms incoming garbage waits before it can enter the board. */
  garbageDelay: number;
  /** Max garbage lines entering per placed piece. */
  garbageCap: number;
  /** 0–1: chance the hole column changes between separate attacks. */
  messiness: number;
  /** ms before outgoing attack starts growing; null = never. */
  marginTime: number | null;
  /** Extra multiplier per second after margin time. */
  marginRate: number;
}

export const DEFAULT_ATTACK: AttackRules = {
  allClear: 5,
  surgeStart: 4,
  surgeInitial: 4,
  garbageDelay: 20 * (1000 / 60),
  garbageCap: 8,
  messiness: 1,
  marginTime: 180_000,
  marginRate: 0.01,
};

const NORMAL = [0, 0, 1, 2, 4];
const SPIN = [0, 2, 4, 6, 10];
const MINI = [0, 0, 1, 2, 4];

/** Lines a clear sends before cancelling, margin time and surge. */
export function attackFor(info: ClearInfo, rules: AttackRules): number {
  if (info.lines === 0) return 0;
  const table = info.spin === 'full' ? SPIN : info.spin === 'mini' ? MINI : NORMAL;
  let attack = table[Math.min(info.lines, 4)];
  const difficult = info.lines === 4 || info.spin !== 'none';
  // Back-to-back charging: every difficult clear continuing a chain adds a line.
  if (difficult && info.b2b >= 1) attack += 1;
  if (info.combo > 0) {
    if (attack > 0) attack *= 1 + 0.25 * info.combo;
    else if (info.combo >= 2) attack = Math.log1p(1.25 * info.combo);
  }
  attack = Math.floor(attack);
  if (info.perfectClear) attack += rules.allClear;
  return attack;
}

/** Surge lines released when a B2B streak of `streak` breaks, split into three segments. */
export function surgeFor(streak: number, rules: AttackRules): number[] {
  if (streak < rules.surgeStart) return [];
  const total = rules.surgeInitial + (streak - rules.surgeStart);
  const base = Math.floor(total / 3);
  const rest = total - base * 3;
  return [base + (rest > 0 ? 1 : 0), base + (rest > 1 ? 1 : 0), base].filter((n) => n > 0);
}

/** Outgoing multiplier at time `t` ms. */
export function marginMultiplier(t: number, rules: AttackRules): number {
  if (rules.marginTime === null || t <= rules.marginTime) return 1;
  return 1 + ((t - rules.marginTime) / 1000) * rules.marginRate;
}
