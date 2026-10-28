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
    // Storage unavailable (private mode, quota): records just won't persist.
  }
}

export interface SprintRecord {
  time: number;
  pieces: number;
  inputs: number;
  date: number;
}

export function loadSprintBest(): SprintRecord | null {
  return load<SprintRecord | null>('best.sprint', null);
}

/** Saves the run if it beats the current best. Returns true on a new personal best. */
export function submitSprint(record: SprintRecord): boolean {
  const best = loadSprintBest();
  if (best && best.time <= record.time) return false;
  save('best.sprint', record);
  return true;
}
