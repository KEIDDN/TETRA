import { FRAME_MS, type Rules } from './game';

export type ModeId = 'sprint' | 'blitz' | 'marathon' | 'endless';

export interface ModeDefinition {
  id: ModeId;
  name: string;
  rules: Partial<Rules>;
}

/** 40 Lines: clear 40 lines as fast as possible. Same settings as TETR.IO. */
export const SPRINT: ModeDefinition = {
  id: 'sprint',
  name: '40 Lines',
  rules: { gravity: 0.02, lineGoal: 40 },
};

/** Blitz: two minutes of scoring, with TETR.IO's BLITZ level table. */
export const BLITZ: ModeDefinition = {
  id: 'blitz',
  name: 'Blitz',
  rules: { timeLimit: 120_000, levelCurve: 'blitz' },
};

/** Marathon: 150 lines over 15 guideline levels. */
export const MARATHON: ModeDefinition = {
  id: 'marathon',
  name: 'Marathon',
  rules: { lineGoal: 150, levelCurve: 'guideline' },
};

/** Endless: the Marathon curve with no line goal, up to 20G. */
export const ENDLESS: ModeDefinition = {
  id: 'endless',
  name: 'Endless',
  rules: { levelCurve: 'guideline' },
};

export const MODES: Record<ModeId, ModeDefinition> = { sprint: SPRINT, blitz: BLITZ, marathon: MARATHON, endless: ENDLESS };

/** Converts frames (TETR.IO's handling unit) to ms. */
export function frames(n: number): number {
  return n * FRAME_MS;
}
