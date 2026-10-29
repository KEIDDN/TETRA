import type { ModeId } from '@tetra/engine';

const PREFIX = 'tetra.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota): data just won't persist.
  }
}

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
