import { BOARD_WIDTH, getKicks, spawnPosition, type Action, type PieceType, type Rotation } from '@tetra/engine';
import { CELLS, filled, fits, type Field } from './field';

export type SpinKind = 'none' | 'mini' | 'full';

/** A reachable resting spot and the inputs that get the piece there. */
export interface Placement {
  type: PieceType;
  rot: Rotation;
  x: number;
  y: number;
  spin: SpinKind;
  /** Inputs from spawn; the last one is always hardDrop. */
  path: Action[];
}

/** The pilot's soft drop: falls all the way (instant soft drop). */
export const SONIC: Action = 'softDrop';

interface Node {
  x: number;
  y: number;
  rot: Rotation;
  /** Last successful move was a rotation, and with which kick test. */
  lastKick: number;
  last180: boolean;
  path: Action[];
}

const T_CORNERS: readonly [number, number][] = [[0, 0], [2, 0], [0, 2], [2, 2]];
const T_FRONT: readonly [number, number][] = [[2, 3], [1, 3], [0, 1], [0, 2]];

/** Same rules as the engine's spin detection (3 corners, front corners, TST kick). */
export function spinOf(f: Field, type: PieceType, n: { x: number; y: number; rot: Rotation; lastKick: number; last180: boolean }): SpinKind {
  if (type !== 'T' || n.lastKick < 0) return 'none';
  const corners = T_CORNERS.map(([cx, cy]) => filled(f, n.x + cx, n.y + cy));
  if (corners.filter(Boolean).length < 3) return 'none';
  const [a, b] = T_FRONT[n.rot];
  if (corners[a] && corners[b]) return 'full';
  if (n.lastKick === 4 && !n.last180) return 'full';
  return 'mini';
}

function drop(f: Field, type: PieceType, rot: Rotation, x: number, y: number): number {
  while (fits(f, type, rot, x, y - 1)) y--;
  return y;
}

/**
 * Every placement reachable from spawn with shifts, rotations (SRS+, 180)
 * and sonic drops: tucks and spins included. `twentyG` drops after every
 * input, as gravity would.
 */
export function placements(f: Field, type: PieceType, { twentyG = false, maxDepth = 14 } = {}): Placement[] {
  const spawn = spawnPosition(type);
  if (!fits(f, type, 0, spawn.x, spawn.y)) return [];
  const start: Node = { x: spawn.x, y: twentyG ? drop(f, type, 0, spawn.x, spawn.y) : spawn.y, rot: 0, lastKick: -1, last180: false, path: [] };
  const key = (n: Node) => `${n.x},${n.y},${n.rot},${n.lastKick >= 0 ? (n.lastKick === 4 && !n.last180 ? 2 : 1) : 0}`;
  const seen = new Set<string>([key(start)]);
  const queue: Node[] = [start];
  const results = new Map<string, Placement>();

  const visit = (n: Node) => {
    if (twentyG) {
      const y = drop(f, type, n.rot, n.x, n.y);
      if (y !== n.y) n = { ...n, y, lastKick: -1 };
    }
    const k = key(n);
    if (seen.has(k) || n.path.length > maxDepth) return;
    seen.add(k);
    queue.push(n);
  };

  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    // Every resting state is a candidate; keep the shortest path per final spot and spin.
    if (!fits(f, type, n.rot, n.x, n.y - 1)) {
      const spin = spinOf(f, type, n);
      const id = `${cellsKey(type, n.rot, n.x, n.y)}:${spin}`;
      if (!results.has(id)) results.set(id, { type, rot: n.rot, x: n.x, y: n.y, spin, path: [...n.path, 'hardDrop'] });
    } else {
      // Hard drop from here lands where sonic drop would, without a spin.
      const y = drop(f, type, n.rot, n.x, n.y);
      const id = `${cellsKey(type, n.rot, n.x, y)}:none`;
      if (!results.has(id)) results.set(id, { type, rot: n.rot, x: n.x, y, spin: 'none', path: [...n.path, 'hardDrop'] });
    }

    for (const d of [-1, 1] as const) {
      if (fits(f, type, n.rot, n.x + d, n.y)) visit({ ...n, x: n.x + d, lastKick: -1, last180: false, path: [...n.path, d < 0 ? 'moveLeft' : 'moveRight'] });
    }
    if (type !== 'O') {
      for (const [delta, action] of [[1, 'rotateCW'], [3, 'rotateCCW'], [2, 'rotate180']] as const) {
        const to = ((n.rot + delta) % 4) as Rotation;
        const kicks = getKicks(type, n.rot, to);
        for (let k = 0; k < kicks.length; k++) {
          const [dx, dy] = kicks[k];
          if (fits(f, type, to, n.x + dx, n.y + dy)) {
            visit({ x: n.x + dx, y: n.y + dy, rot: to, lastKick: k, last180: delta === 2, path: [...n.path, action] });
            break;
          }
        }
      }
    }
    const y = drop(f, type, n.rot, n.x, n.y);
    if (y !== n.y) visit({ ...n, y, lastKick: -1, last180: false, path: [...n.path, SONIC] });
  }
  return [...results.values()];
}

function cellsKey(type: PieceType, rot: Rotation, x: number, y: number): string {
  return CELLS[type][rot]
    .map(([cx, cy]) => (y + cy) * BOARD_WIDTH + x + cx)
    .sort((a, b) => a - b)
    .join('.');
}
