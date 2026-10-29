import { useSyncExternalStore } from 'react';
import { gamepads } from '../game/gamepad';

/** What the player last touched: the hints follow it. Xbox glyphs stand in for any controller that isn't a PlayStation one. */
export type InputDevice = 'keyboard' | 'xbox' | 'playstation';

let device: InputDevice = 'keyboard';
const listeners = new Set<() => void>();

function set(next: InputDevice): void {
  if (next === device) return;
  device = next;
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => set('keyboard'), true);
  window.addEventListener('pointerdown', () => set('keyboard'), true);
  gamepads.subscribe((e) => {
    if (e.pressed) set(e.kind === 'playstation' ? 'playstation' : 'xbox');
  });
}

export function useInputDevice(): InputDevice {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => device,
  );
}
