import { DEFAULT_HANDLING, type Action, type Handling } from '@tetra/engine';
import { useSyncExternalStore } from 'react';
import type { FxLevel } from '../game/fx';
import { SKINS, type SkinId, type SoundPackId } from '../game/skins';
import { load, save } from './storage';

export type Command = Action | 'retry' | 'pause';
export type Device = 'keyboard' | 'gamepad';

export const COMMANDS: readonly { id: Command; label: string }[] = [
  { id: 'moveLeft', label: 'Move left' },
  { id: 'moveRight', label: 'Move right' },
  { id: 'softDrop', label: 'Soft drop' },
  { id: 'hardDrop', label: 'Hard drop' },
  { id: 'rotateCW', label: 'Rotate right' },
  { id: 'rotateCCW', label: 'Rotate left' },
  { id: 'rotate180', label: 'Rotate 180' },
  { id: 'hold', label: 'Hold' },
  { id: 'retry', label: 'Retry' },
  { id: 'pause', label: 'Pause' },
];

/** Virtual gamepad buttons produced by the left stick. */
export const STICK_LEFT = 100;
export const STICK_RIGHT = 101;
export const STICK_DOWN = 102;
export const STICK_UP = 103;

export interface DeviceSettings<K> {
  handling: Handling;
  bindings: Record<Command, K[]>;
}

export interface AppearanceSettings {
  skin: SkinId;
  fx: FxLevel;
  /** Interpolate the falling piece between rows instead of stepping. */
  smoothFall: boolean;
  ghost: boolean;
  /** 'auto' lets each skin choose. */
  grid: GridMode;
  /** The skin's scene behind the board (and the lattice in menus). */
  ambient: boolean;
  /** How strong the in-game scene is. */
  background: 'calm' | 'full';
  /** "T-SPIN DOUBLE", "B2B ×3"… next to the board. */
  actionText: boolean;
}

export type GridMode = 'auto' | 'lines' | 'dots' | 'off';

export interface AudioSettings {
  enabled: boolean;
  /** 0–1 */
  volume: number;
  /** 0–1, scales move and rotate sounds on top of `volume`. */
  movement: number;
  /** 'match' follows the skin's own sound pack. */
  pack: 'match' | SoundPackId;
  /** 0–1, music on its own fader. */
  music: number;
  /** Skin: each skin's track. Shuffle: any unlocked track. */
  musicMode: 'skin' | 'shuffle' | 'off';
}

export interface Settings {
  /** Unlocks every bot, cup and skin. Toggled by tapping the version five times. */
  developer: boolean;
  appearance: AppearanceSettings;
  audio: AudioSettings;
  keyboard: DeviceSettings<string>;
  gamepad: DeviceSettings<number> & {
    /** Use the left stick as a d-pad. */
    stick: boolean;
    /** 0–1, how far the stick must travel to count as pressed. */
    deadzone: number;
  };
}

export const MAX_BINDINGS = 2;

export const DEFAULT_SETTINGS: Settings = {
  developer: false,
  appearance: { skin: 'studio', fx: 'subtle', smoothFall: false, ghost: true, grid: 'auto', ambient: true, background: 'full', actionText: true },
  audio: { enabled: true, volume: 0.7, movement: 0.8, pack: 'match', music: 0.5, musicMode: 'skin' },
  keyboard: {
    handling: DEFAULT_HANDLING,
    bindings: {
      moveLeft: ['ArrowLeft'],
      moveRight: ['ArrowRight'],
      softDrop: ['ArrowDown'],
      hardDrop: ['Space'],
      rotateCW: ['KeyX', 'ArrowUp'],
      rotateCCW: ['KeyZ'],
      rotate180: ['KeyA'],
      hold: ['KeyC', 'ShiftLeft'],
      retry: ['KeyR'],
      pause: ['Escape'],
    },
  },
  gamepad: {
    handling: DEFAULT_HANDLING,
    bindings: {
      moveLeft: [14, STICK_LEFT],
      moveRight: [15, STICK_RIGHT],
      softDrop: [13, STICK_DOWN],
      hardDrop: [12],
      rotateCW: [0],
      rotateCCW: [1],
      rotate180: [3],
      hold: [4, 5],
      retry: [8],
      pause: [9],
    },
    stick: false,
    deadzone: 0.5,
  },
};

function merge(saved: Partial<Settings> | null): Settings {
  const d = DEFAULT_SETTINGS;
  if (!saved) return d;
  const appearance = { ...d.appearance, ...saved.appearance };
  const audio = { ...d.audio, ...saved.audio };
  // Skins and packs get renamed between versions; fall back instead of crashing.
  if (!(appearance.skin in SKINS)) appearance.skin = d.appearance.skin;
  // v0.3 stored the grid as a boolean.
  const grid = appearance.grid as GridMode | boolean;
  if (typeof grid === 'boolean') appearance.grid = grid ? 'auto' : 'off';
  if (audio.pack !== 'match' && !['studio', 'glass', 'wood', 'pure'].includes(audio.pack)) audio.pack = 'match';
  return {
    developer: saved.developer ?? false,
    appearance,
    audio,
    keyboard: {
      handling: { ...d.keyboard.handling, ...saved.keyboard?.handling },
      bindings: { ...d.keyboard.bindings, ...saved.keyboard?.bindings },
    },
    gamepad: {
      ...d.gamepad,
      ...saved.gamepad,
      handling: { ...d.gamepad.handling, ...saved.gamepad?.handling },
      bindings: { ...d.gamepad.bindings, ...saved.gamepad?.bindings },
    },
  };
}

// JSON can't hold Infinity (instant soft drop), so it is stored as null.
function encode(s: Settings) {
  const fix = (h: Handling) => ({ ...h, sdf: Number.isFinite(h.sdf) ? h.sdf : null });
  return { ...s, keyboard: { ...s.keyboard, handling: fix(s.keyboard.handling) }, gamepad: { ...s.gamepad, handling: fix(s.gamepad.handling) } };
}

function decode(raw: ReturnType<typeof encode> | null): Partial<Settings> | null {
  if (!raw) return null;
  const fix = (h?: Omit<Partial<Handling>, 'sdf'> & { sdf?: number | null }) => (h ? { ...h, sdf: h.sdf ?? Infinity } : undefined);
  return {
    ...raw,
    keyboard: raw.keyboard && { ...raw.keyboard, handling: fix(raw.keyboard.handling) as Handling },
    gamepad: raw.gamepad && { ...raw.gamepad, handling: fix(raw.gamepad.handling) as Handling },
  };
}

let current: Settings = merge(decode(load('settings', null)));
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(change: (s: Settings) => Settings): void {
  current = change(current);
  save('settings', encode(current));
  listeners.forEach((l) => l());
}

/** Outside React (audio, renderers): called after every change. */
export function subscribeSettings(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function resetSettings(): void {
  updateSettings(() => DEFAULT_SETTINGS);
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSettings,
  );
}

/** Binds `key` to `command` in `slot`, removing it from any other command first. */
export function bind<K>(bindings: Record<Command, K[]>, command: Command, slot: number, key: K | null): Record<Command, K[]> {
  const next = Object.fromEntries(
    Object.entries(bindings).map(([c, keys]) => [c, (keys as K[]).filter((k) => k !== key)]),
  ) as Record<Command, K[]>;
  const keys = [...bindings[command]].filter((k) => k !== key);
  if (key === null) keys.splice(slot, 1);
  else keys[Math.min(slot, keys.length)] = key;
  next[command] = keys.slice(0, MAX_BINDINGS);
  return next;
}
