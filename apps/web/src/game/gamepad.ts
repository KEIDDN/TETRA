import { detectPadKind, type PadKind } from '../lib/labels';
import { getSettings, STICK_DOWN, STICK_LEFT, STICK_RIGHT, STICK_UP } from '../lib/settings';

export interface PadButtonEvent {
  /** Which connected pad (navigator.getGamepads() index). */
  pad: number;
  /** Standard-mapping button index, or a STICK_* virtual button. */
  button: number;
  pressed: boolean;
  time: number;
  kind: PadKind;
}

type Listener = (e: PadButtonEvent) => void;

/**
 * Polls the Gamepad API once per animation frame (the API has no button
 * events) and turns state changes into press/release events.
 */
class GamepadManager {
  private listeners = new Set<Listener>();
  private statusListeners = new Set<() => void>();
  private previous = new Map<number, Map<number, boolean>>();
  private frame = 0;
  private started = false;
  /** Kind of the most recently used pad, for button glyphs. */
  kind: PadKind | null = null;

  subscribe(listener: Listener): () => void {
    this.start();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: () => void): () => void {
    this.start();
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** All buttons currently down on any pad. */
  pressedButtons(): Set<number> {
    const result = new Set<number>();
    for (const state of this.previous.values()) for (const [b, down] of state) if (down) result.add(b);
    return result;
  }

  private start(): void {
    if (this.started || typeof window === 'undefined' || !('getGamepads' in navigator)) return;
    this.started = true;
    window.addEventListener('gamepadconnected', (e) => {
      this.kind = detectPadKind(e.gamepad.id);
      this.statusListeners.forEach((l) => l());
      this.loop();
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      this.previous.delete(e.gamepad.index);
      if (!this.anyConnected()) this.kind = null;
      this.statusListeners.forEach((l) => l());
    });
    if (this.anyConnected()) this.loop();
  }

  private anyConnected(): boolean {
    return navigator.getGamepads().some((p) => p?.connected);
  }

  private loop = (): void => {
    cancelAnimationFrame(this.frame);
    this.poll();
    if (this.anyConnected()) this.frame = requestAnimationFrame(this.loop);
  };

  private poll(): void {
    const now = performance.now();
    const { deadzone } = getSettings().gamepad;
    for (const pad of navigator.getGamepads()) {
      if (!pad?.connected) continue;
      const state = new Map<number, boolean>();
      pad.buttons.forEach((b, i) => state.set(i, b.pressed || b.value > 0.5));
      const [x = 0, y = 0] = pad.axes;
      state.set(STICK_LEFT, x < -deadzone);
      state.set(STICK_RIGHT, x > deadzone);
      state.set(STICK_UP, y < -deadzone);
      state.set(STICK_DOWN, y > deadzone);

      const before = this.previous.get(pad.index);
      this.previous.set(pad.index, state);
      if (!before) continue;
      const kind = detectPadKind(pad.id);
      for (const [button, pressed] of state) {
        if ((before.get(button) ?? false) === pressed) continue;
        if (pressed && this.kind !== kind) {
          this.kind = kind;
          this.statusListeners.forEach((l) => l());
        }
        const event = { pad: pad.index, button, pressed, time: now, kind };
        this.listeners.forEach((l) => l(event));
      }
    }
  }
}

export const gamepads = new GamepadManager();
