import type { PieceType, Rotation } from './pieces';

/**
 * SRS+ kick tables as used by TETR.IO (y-up offsets, first test is always (0,0)).
 * JLSTZ use standard SRS, I uses the symmetric SRS+ table, and 180° rotations
 * use TETR.IO's 180 table for every piece.
 */
type Table = Record<string, readonly (readonly [number, number])[]>;

const JLSTZ: Table = {
  '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

const I: Table = {
  '01': [[0, 0], [1, 0], [-2, 0], [-2, -1], [1, 2]],
  '10': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '21': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '32': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '03': [[0, 0], [-1, 0], [2, 0], [2, -1], [-1, 2]],
};

const R180: Table = {
  '02': [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]],
  '13': [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]],
  '20': [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]],
  '31': [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]],
};

const NONE = [[0, 0]] as const;

export function getKicks(type: PieceType, from: Rotation, to: Rotation): readonly (readonly [number, number])[] {
  if (type === 'O') return NONE;
  const key = `${from}${to}`;
  if ((from + 2) % 4 === to) return R180[key];
  return (type === 'I' ? I : JLSTZ)[key];
}
