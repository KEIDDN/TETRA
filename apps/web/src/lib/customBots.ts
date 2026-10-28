import { BOTS, type BotProfile, type Weights } from '@tetra/bot';
import { useSyncExternalStore } from 'react';
import { load, save } from './storage';

/** What the editor stores; the playable profile is derived from it. */
export interface CustomBotSpec {
  id: string;
  name: string;
  color: string;
  /** The ladder bot it starts from. */
  base: string;
  pps: number;
  /** 0–1: how much it values sending over staying safe. */
  aggression: number;
  /** 0–1: how often it errs, relative to the extremes of the ladder. */
  mistakes: number;
  advanced: {
    depth: number;
    beam: number;
    spins: boolean;
    useHold: boolean;
    reaction: number;
    tap: number;
    das: number;
    arr: number;
    weights: Pick<Weights, 'tslot' | 'well' | 'burn' | 'b2b' | 'holes'>;
  };
}

export const CUSTOM_COLORS = ['#5ad8c8', '#5ac8f5', '#6a9cff', '#a774ff', '#ef6bd8', '#ff6b9a', '#ff7a5a', '#ffb84a', '#c8e04a', '#e8e8ee'];

export function newSpec(base: BotProfile = BOTS[4]): CustomBotSpec {
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: 'My bot',
    color: CUSTOM_COLORS[Math.floor(Math.random() * CUSTOM_COLORS.length)],
    base: base.id,
    pps: base.pps,
    aggression: 0.5,
    mistakes: base.mistakes / 0.14,
    advanced: {
      depth: base.depth,
      beam: base.beam,
      spins: base.spins,
      useHold: base.useHold,
      reaction: base.reaction,
      tap: base.tap,
      das: base.das,
      arr: base.arr,
      weights: { tslot: base.weights.tslot, well: base.weights.well, burn: base.weights.burn, b2b: base.weights.b2b, holes: base.weights.holes },
    },
  };
}

export function toProfile(spec: CustomBotSpec): BotProfile {
  const base = BOTS.find((b) => b.id === spec.base) ?? BOTS[0];
  const a = spec.advanced;
  const m = spec.mistakes;
  const attackScale = 0.6 + spec.aggression * 0.8;
  return {
    ...base,
    id: spec.id,
    name: spec.name.trim() || 'Custom',
    style: `Custom · based on ${base.name}`,
    color: spec.color,
    pps: spec.pps,
    tap: a.tap,
    das: a.das,
    arr: a.arr,
    reaction: a.reaction,
    mistakes: 0.14 * m,
    misdrop: 0.05 * m,
    overshoot: 0.18 * m,
    fumble: 0.14 * m,
    hesitation: 0.18 * m,
    softDrops: 0.2 * m,
    spins: a.spins,
    useHold: a.useHold,
    depth: a.depth,
    beam: a.beam,
    weights: { ...base.weights, ...a.weights, attack: base.weights.attack * attackScale, danger: base.weights.danger * (1.4 - spec.aggression * 0.8) },
    traits: {
      speed: Math.min(1, spec.pps / 3.5),
      attack: Math.min(1, base.traits.attack * attackScale),
      spins: a.spins ? Math.min(1, 0.3 + a.weights.tslot / 12) : 0.05,
      defense: Math.min(1, Math.max(0.05, 1 - m * 0.8)),
    },
  };
}

let specs: CustomBotSpec[] = load<CustomBotSpec[]>('customBots', []);
const listeners = new Set<() => void>();

function commit(next: CustomBotSpec[]): void {
  specs = next;
  save('customBots', specs);
  listeners.forEach((l) => l());
}

export function getCustomBots(): CustomBotSpec[] {
  return specs;
}

export function useCustomBots(): CustomBotSpec[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getCustomBots,
  );
}

export function saveCustomBot(spec: CustomBotSpec): void {
  commit(specs.some((s) => s.id === spec.id) ? specs.map((s) => (s.id === spec.id ? spec : s)) : [...specs, spec]);
}

export function deleteCustomBot(id: string): void {
  commit(specs.filter((s) => s.id !== id));
}

/** Any bot by id: ladder or custom. */
export function findBot(id: string): BotProfile | undefined {
  const spec = specs.find((s) => s.id === id);
  return spec ? toProfile(spec) : BOTS.find((b) => b.id === id);
}
