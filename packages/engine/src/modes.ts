import type { Rules } from './game';

export type ModeId = 'sprint';

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
