import type { Action } from '@tetra/engine';
import { STICK_DOWN, STICK_LEFT, STICK_RIGHT, STICK_UP, type Command, type Device, type Settings } from '../lib/settings';
import { gamepads } from './gamepad';

export interface CommandHandler {
  /** `time` is a performance.now() timestamp. */
  (command: Command, pressed: boolean, time: number, device: Device): void;
}

const STICK = new Set([STICK_LEFT, STICK_RIGHT, STICK_DOWN, STICK_UP]);

/**
 * Turns keyboard and controller input into game commands. Several physical
 * inputs may share a command: it is pressed when the first goes down and
 * released when the last goes up.
 */
export class InputRouter {
  private down = new Map<string, { command: Command; device: Device }>();
  private counts = new Map<Command, number>();
  private since = new Map<Command, { time: number; device: Device }>();
  private keyMap = new Map<string, Command>();
  private padMap = new Map<number, Command>();
  private unsubscribePad: () => void;

  constructor(
    settings: Settings,
    private handler: CommandHandler,
  ) {
    this.configure(settings);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.unsubscribePad = gamepads.subscribe((e) => {
      const id = `pad${e.pad}:${e.button}`;
      if (e.pressed) {
        const command = this.padMap.get(e.button);
        if (command) this.press(id, command, e.time, 'gamepad');
      } else {
        this.release(id, e.time);
      }
    });
  }

  configure(settings: Settings): void {
    this.keyMap.clear();
    this.padMap.clear();
    for (const [command, codes] of Object.entries(settings.keyboard.bindings)) {
      for (const code of codes) this.keyMap.set(code, command as Command);
    }
    for (const [command, buttons] of Object.entries(settings.gamepad.bindings)) {
      for (const button of buttons) {
        if (STICK.has(button) && !settings.gamepad.stick) continue;
        this.padMap.set(button, command as Command);
      }
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.unsubscribePad();
  }

  /** Game actions currently held, with when (and on which device) each was first pressed. */
  heldActions(): { action: Action; since: number; device: Device }[] {
    return [...this.since]
      .filter(([command]) => command !== 'retry' && command !== 'pause')
      .map(([command, { time, device }]) => ({ action: command as Action, since: time, device }));
  }

  /** Forgets every held input without emitting releases (used when pausing). */
  clear(): void {
    this.down.clear();
    this.counts.clear();
    this.since.clear();
  }

  private press(id: string, command: Command, time: number, device: Device): void {
    if (this.down.has(id)) return;
    this.down.set(id, { command, device });
    const count = (this.counts.get(command) ?? 0) + 1;
    this.counts.set(command, count);
    if (count === 1) {
      this.since.set(command, { time, device });
      this.handler(command, true, time, device);
    }
  }

  private release(id: string, time: number): void {
    const entry = this.down.get(id);
    if (!entry) return;
    this.down.delete(id);
    const count = (this.counts.get(entry.command) ?? 0) - 1;
    if (count > 0) {
      this.counts.set(entry.command, count);
      return;
    }
    this.counts.delete(entry.command);
    this.since.delete(entry.command);
    this.handler(entry.command, false, time, entry.device);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const command = this.keyMap.get(e.code);
    if (!command) return;
    e.preventDefault();
    if (e.repeat) return;
    this.press(`key:${e.code}`, command, e.timeStamp, 'keyboard');
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.release(`key:${e.code}`, e.timeStamp);
  };

  private onBlur = (): void => {
    const now = performance.now();
    for (const id of [...this.down.keys()]) if (id.startsWith('key:')) this.release(id, now);
  };
}
