import type { ModeId } from '@tetra/engine';

const PREFIX = 'tetra.';

/**
 * Stats (level, records, history, trophies) belong to an account. Guests play
 * with them in memory only, so nothing they do is kept; everything else
 * (settings, controls, your own bots) stays on the device either way.
 */
const STAT_KEY = /^(profile|best\.|history\.|versus\.|tournament|celebrated\.|achievements|lifetime)/;
const memory = new Map<string, string>();
let policy: { persistStats: boolean; onWrite?: (key: string) => void } = { persistStats: true };

export function setStoragePolicy(next: typeof policy): void {
  policy = next;
}

export function isStatKey(key: string): boolean {
  return STAT_KEY.test(key);
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = memory.get(key) ?? localStorage.getItem(PREFIX + key);
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  if (!policy.persistStats && isStatKey(key)) {
    memory.set(key, raw);
    return;
  }
  try {
    localStorage.setItem(PREFIX + key, raw);
    policy.onWrite?.(key);
  } catch {
    // Storage unavailable (private mode, quota): data just won't persist.
  }
}

/** Everything TETRA keeps on this device, for cloud sync. */
export function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const full = localStorage.key(i)!;
    if (!full.startsWith(PREFIX)) continue;
    const key = full.slice(PREFIX.length);
    if (LOCAL_ONLY.has(key)) continue;
    try {
      out[key] = JSON.parse(localStorage.getItem(full)!);
    } catch {
      // Not ours, or corrupt: leave it out.
    }
  }
  return out;
}

/** Replaces this device's data with an account's (local-only keys survive). */
export function restore(data: Record<string, unknown>): void {
  clearData();
  for (const [key, value] of Object.entries(data)) if (!LOCAL_ONLY.has(key)) localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

/** Forgets every stat and setting on this device (local-only keys survive). */
export function clearData(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const full = localStorage.key(i)!;
    if (full.startsWith(PREFIX) && !LOCAL_ONLY.has(full.slice(PREFIX.length))) keys.push(full);
  }
  keys.forEach((k) => localStorage.removeItem(k));
  memory.clear();
}

/** Keys about this device, never synced. */
const LOCAL_ONLY = new Set(['account', 'sync', 'onboarded']);

export interface RunRecord {
  time: number;
  score: number;
  lines: number;
  level: number;
  pieces: number;
  inputs: number;
  date: number;
}

export function loadBest(mode: ModeId): RunRecord | null {
  const best = load<RunRecord | null>(`best.${mode}`, null);
  if (best || mode !== 'sprint') return best;
  // v0.1 stored 40 Lines records without score/lines/level.
  const legacy = load<Omit<RunRecord, 'score' | 'lines' | 'level'> | null>('best.sprint', null);
  return legacy && { score: 0, lines: 40, level: 1, ...legacy };
}

/** The last runs of a mode, oldest first, for the profile's charts. */
export function loadHistory(mode: ModeId): RunRecord[] {
  return load<RunRecord[]>(`history.${mode}`, []);
}

export function recordRun(mode: ModeId, record: RunRecord): void {
  save(`history.${mode}`, [...loadHistory(mode), record].slice(-40));
}

/** Saves the run if it beats the current best. Returns true on a new personal best. */
export function submitBest(mode: ModeId, record: RunRecord, isBetter: (a: RunRecord, b: RunRecord) => boolean): boolean {
  const best = loadBest(mode);
  if (best && !isBetter(record, best)) return false;
  save(`best.${mode}`, record);
  return true;
}
