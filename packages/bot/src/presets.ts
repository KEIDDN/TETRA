import { BALANCED, type Weights } from './evaluate';

/** Everything that makes one bot play differently from another. */
export interface BotProfile {
  id: string;
  name: string;
  level: number;
  /** One line about how it plays. */
  style: string;
  /** Signature color (emblem, accents). */
  color: string;
  /** Target pieces per second. */
  pps: number;
  /** ms between taps when executing a move. */
  tap: number;
  /** Its own handling: long slides use DAS like a person's. */
  das: number;
  arr: number;
  /** ms before it notices incoming garbage. */
  reaction: number;
  /** Chance of playing a worse move than its best. */
  mistakes: number;
  /** Chance of landing one column off. */
  misdrop: number;
  /** Chance of releasing DAS a column late and correcting. */
  overshoot: number;
  /** Chance of rotating the long way round (three turns instead of one). */
  fumble: number;
  /** Chance of pausing mid-move. */
  hesitation: number;
  /** Chance of soft dropping instead of hard dropping. */
  softDrops: number;
  /** How much worse it plays when its stack is high (0–1). */
  panic: number;
  /** Uses tucks and spins. */
  spins: boolean;
  useHold: boolean;
  depth: number;
  beam: number;
  weights: Weights;
  /** 0–1 ratings for the opponent card. */
  traits: { speed: number; attack: number; spins: number; defense: number };
}

/** Tuned weights for strong play: tetris well on the right, B2B, T-spins (see test/tune.test.ts). */
export const STRONG: Weights = { ...BALANCED, well: 4, wellColumn: 9, height: -0.25, burn: -9, wastedClear: -3.3, b2bBreak: -7.2 };

/** How a beginner thinks: keep it flat, clear whenever possible. */
const CASUAL: Weights = { ...BALANCED, burn: 0, wastedClear: 0, well: 0, tslot: 0, b2b: 0, b2bBreak: 0, holes: -3, attack: 2 };

/** Blends beginner and strong weights, so strategy grows a little with every level. */
function blend(t: number, overrides: Partial<Weights> = {}): Weights {
  const out = { ...STRONG };
  for (const k of Object.keys(STRONG) as (keyof Weights)[]) out[k] = CASUAL[k] + (STRONG[k] - CASUAL[k]) * t;
  out.wellColumn = t > 0.25 ? 9 : -1;
  return { ...out, ...overrides };
}

interface Spec {
  id: string;
  name: string;
  style: string;
  color: string;
  pps: number;
  skill: number;
  spins: boolean;
  overrides?: Partial<Weights>;
}

// Speed and skill rise together but gently; spins arrive at level 6.
const SPECS: Spec[] = [
  { id: 'pebble', name: 'Pebble', style: 'Just learning. Fast hands, loose choices.', color: '#5ad8c8', pps: 0.75, skill: 0, spins: false },
  { id: 'drift', name: 'Drift', style: 'Keeps it flat, never holds.', color: '#5ac8f5', pps: 0.95, skill: 0.08, spins: false },
  { id: 'stack', name: 'Stack', style: 'Builds a well and waits for the long bar.', color: '#6a9cff', pps: 1.1, skill: 0.2, spins: false },
  { id: 'tempo', name: 'Tempo', style: 'Even rhythm, basic combos.', color: '#8a86ff', pps: 1.25, skill: 0.32, spins: false },
  { id: 'pivot', name: 'Pivot', style: 'Clean stacker, steady quads.', color: '#a774ff', pps: 1.4, skill: 0.44, spins: false },
  { id: 'rift', name: 'Rift', style: 'First T-spins. Sends early.', color: '#c86bff', pps: 1.65, skill: 0.56, spins: true, overrides: { attack: 6 } },
  { id: 'vector', name: 'Vector', style: 'Fast and clean. Lives on back-to-back.', color: '#ef6bd8', pps: 2.0, skill: 0.68, spins: true, overrides: { b2b: 2.5 } },
  { id: 'prism', name: 'Prism', style: 'T-spins and openers.', color: '#ff6b9a', pps: 2.4, skill: 0.8, spins: true, overrides: { tslot: 8, b2b: 2.5 } },
  { id: 'apex', name: 'Apex', style: 'Near flawless. Strong downstacker.', color: '#ff7a5a', pps: 2.9, skill: 0.9, spins: true, overrides: { holes: -9 } },
  { id: 'zenith', name: 'Zenith', style: 'Top level. No easy openings.', color: '#ffb84a', pps: 3.5, skill: 1, spins: true, overrides: { tslot: 7 } },
];

function profile(spec: Spec, i: number): BotProfile {
  const s = spec.skill;
  const lerp = (a: number, b: number) => a + (b - a) * s;
  return {
    id: spec.id,
    name: spec.name,
    level: i + 1,
    style: spec.style,
    color: spec.color,
    pps: spec.pps,
    tap: Math.round(lerp(95, 38)),
    das: Math.round(lerp(190, 115)),
    arr: Math.round(lerp(50, 0)),
    reaction: Math.round(lerp(1300, 250)),
    mistakes: lerp(0.38, 0.012),
    misdrop: lerp(0.09, 0.003),
    overshoot: lerp(0.25, 0.01),
    fumble: lerp(0.22, 0),
    hesitation: lerp(0.3, 0.02),
    softDrops: lerp(0.35, 0),
    panic: lerp(0.4, 0.05),
    spins: spec.spins,
    useHold: i >= 2,
    depth: s < 0.3 ? 1 : 2,
    beam: Math.round(lerp(2, 18)),
    weights: blend(s, spec.overrides),
    traits: {
      speed: spec.pps / 3.5,
      attack: 0.1 + 0.9 * s,
      spins: spec.spins ? 0.4 + 0.6 * s : 0.05,
      defense: 0.2 + 0.8 * s,
    },
  };
}

export const BOTS: BotProfile[] = SPECS.map(profile);
