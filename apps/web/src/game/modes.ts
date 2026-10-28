import { MODES, type ModeDefinition, type ModeId } from '@tetra/engine';
import { formatTime } from '../lib/format';
import type { RunRecord } from '../lib/storage';

export type StatKey = 'lines' | 'pieces' | 'pps' | 'score' | 'level';

export interface ModeConfig {
  def: ModeDefinition;
  description: string;
  /** Live stats shown next to the board, top to bottom. */
  stats: StatKey[];
  clock: 'up' | 'down';
  /** Only completed runs count as records (40 Lines needs all 40 lines). */
  recordNeedsFinish: boolean;
  isBetter(a: RunRecord, b: RunRecord): boolean;
  formatRecord(r: RunRecord): string;
}

const byTime = (a: RunRecord, b: RunRecord) => a.time < b.time;
const byScore = (a: RunRecord, b: RunRecord) => a.score > b.score;
const score = (r: RunRecord) => r.score.toLocaleString('en-US');

export const MODE_CONFIGS: Record<ModeId, ModeConfig> = {
  sprint: {
    def: MODES.sprint,
    description: 'Clear forty lines as fast as you can.',
    stats: ['lines', 'pieces', 'pps'],
    clock: 'up',
    recordNeedsFinish: true,
    isBetter: byTime,
    formatRecord: (r) => formatTime(r.time),
  },
  blitz: {
    def: MODES.blitz,
    description: 'Two minutes. Score as much as you can.',
    stats: ['score', 'level', 'lines', 'pps'],
    clock: 'down',
    recordNeedsFinish: false,
    isBetter: byScore,
    formatRecord: score,
  },
  marathon: {
    def: MODES.marathon,
    description: 'One hundred fifty lines across fifteen levels.',
    stats: ['score', 'level', 'lines', 'pps'],
    clock: 'up',
    recordNeedsFinish: false,
    isBetter: byScore,
    formatRecord: score,
  },
  endless: {
    def: MODES.endless,
    description: 'The Marathon curve, without an end. Up to 20G.',
    stats: ['score', 'level', 'lines', 'pps'],
    clock: 'up',
    recordNeedsFinish: false,
    isBetter: byScore,
    formatRecord: score,
  },
};

export const MODE_ORDER: ModeId[] = ['sprint', 'blitz', 'marathon', 'endless'];
