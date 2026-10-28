import { BALANCED, type Weights } from './evaluate';

/** Everything that makes one bot play differently from another. */
export interface BotProfile {
  id: string;
  name: string;
  level: number;
  /** One line about how it plays. */
  style: string;
  /** Target pieces per second. */
  pps: number;
  /** ms between taps when executing a move. */
  tap: number;
  /** ms before it notices incoming garbage. */
  reaction: number;
  /** Chance of playing a worse move than its best. */
  mistakes: number;
  /** Chance of landing one column off. */
  misdrop: number;
  /** How much worse it plays when its stack is high (0–1). */
  panic: number;
  /** Uses tucks and spins. */
  spins: boolean;
  useHold: boolean;
  depth: number;
  beam: number;
  weights: Weights;
}

/** Tuned weights for strong play: tetris well on the right, B2B, T-spins (see test/tune.test.ts). */
export const STRONG: Weights = { ...BALANCED, well: 4, wellColumn: 9, height: -0.25, burn: -9, wastedClear: -3.3, b2bBreak: -7.2 };

const casual: Weights = { ...BALANCED, burn: -1, well: 0.5, tslot: 0, b2b: 0, b2bBreak: 0 };

export const BOTS: BotProfile[] = [
  {
    id: 'pebble',
    name: 'Pebble',
    level: 1,
    style: 'Slow and loose. Places pieces almost anywhere.',
    pps: 0.5,
    tap: 140,
    reaction: 1500,
    mistakes: 0.45,
    misdrop: 0.12,
    panic: 0.4,
    spins: false,
    useHold: false,
    depth: 1,
    beam: 1,
    weights: { ...casual, holes: -3, bumpiness: -0.3 },
  },
  {
    id: 'drift',
    name: 'Drift',
    level: 2,
    style: 'Steady but never holds a piece.',
    pps: 0.8,
    tap: 120,
    reaction: 1200,
    mistakes: 0.3,
    misdrop: 0.08,
    panic: 0.35,
    spins: false,
    useHold: false,
    depth: 1,
    beam: 1,
    weights: casual,
  },
  {
    id: 'stack',
    name: 'Stack',
    level: 3,
    style: 'Builds a well and waits for the long bar.',
    pps: 1.05,
    tap: 105,
    reaction: 1000,
    mistakes: 0.2,
    misdrop: 0.05,
    panic: 0.3,
    spins: false,
    useHold: true,
    depth: 1,
    beam: 1,
    weights: { ...STRONG, tslot: 0 },
  },
  {
    id: 'tempo',
    name: 'Tempo',
    level: 4,
    style: 'Even rhythm, basic combos.',
    pps: 1.35,
    tap: 90,
    reaction: 850,
    mistakes: 0.14,
    misdrop: 0.04,
    panic: 0.25,
    spins: false,
    useHold: true,
    depth: 2,
    beam: 6,
    weights: { ...STRONG, burn: -4, tslot: 1 },
  },
  {
    id: 'pivot',
    name: 'Pivot',
    level: 5,
    style: 'Starting to spin. Simple T-spins.',
    pps: 1.65,
    tap: 80,
    reaction: 700,
    mistakes: 0.1,
    misdrop: 0.03,
    panic: 0.22,
    spins: true,
    useHold: true,
    depth: 2,
    beam: 8,
    weights: { ...STRONG, tslot: 7 },
  },
  {
    id: 'rift',
    name: 'Rift',
    level: 6,
    style: 'Aggressive. Sends early and often.',
    pps: 1.95,
    tap: 70,
    reaction: 600,
    mistakes: 0.08,
    misdrop: 0.025,
    panic: 0.2,
    spins: true,
    useHold: true,
    depth: 2,
    beam: 10,
    weights: { ...STRONG, attack: 7, burn: -5, well: 2.5 },
  },
  {
    id: 'vector',
    name: 'Vector',
    level: 7,
    style: 'Fast and clean. Lives on back-to-back.',
    pps: 2.3,
    tap: 60,
    reaction: 480,
    mistakes: 0.055,
    misdrop: 0.015,
    panic: 0.15,
    spins: true,
    useHold: true,
    depth: 2,
    beam: 12,
    weights: { ...STRONG, b2b: 2.5, b2bBreak: -9 },
  },
  {
    id: 'prism',
    name: 'Prism',
    level: 8,
    style: 'T-spins and openers.',
    pps: 2.7,
    tap: 52,
    reaction: 400,
    mistakes: 0.035,
    misdrop: 0.01,
    panic: 0.12,
    spins: true,
    useHold: true,
    depth: 2,
    beam: 14,
    weights: { ...STRONG, tslot: 8, b2b: 2.5, well: 3 },
  },
  {
    id: 'apex',
    name: 'Apex',
    level: 9,
    style: 'Near flawless. Strong downstacker.',
    pps: 3.1,
    tap: 45,
    reaction: 320,
    mistakes: 0.02,
    misdrop: 0.006,
    panic: 0.08,
    spins: true,
    useHold: true,
    depth: 2,
    beam: 16,
    weights: { ...STRONG, tslot: 7, holes: -9 },
  },
  {
    id: 'zenith',
    name: 'Zenith',
    level: 10,
    style: 'Top human level. No easy openings.',
    pps: 3.5,
    tap: 40,
    reaction: 250,
    mistakes: 0.01,
    misdrop: 0.003,
    panic: 0.05,
    spins: true,
    useHold: true,
    depth: 2,
    beam: 18,
    weights: { ...STRONG, tslot: 7 },
  },
];
