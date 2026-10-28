import type { Action } from '@tetra/engine';

export type Command = Action | 'retry' | 'exit';

export const DEFAULT_BINDINGS: Readonly<Record<string, Command>> = {
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
  ArrowDown: 'softDrop',
  Space: 'hardDrop',
  ArrowUp: 'rotateCW',
  KeyX: 'rotateCW',
  KeyZ: 'rotateCCW',
  KeyA: 'rotate180',
  KeyC: 'hold',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
  KeyR: 'retry',
  Escape: 'exit',
};

export interface KeyboardHandlers {
  /** `time` is a performance.now() timestamp taken from the DOM event. */
  onAction(action: Action, pressed: boolean, time: number): void;
  onCommand(command: 'retry' | 'exit'): void;
}

/**
 * Event-driven keyboard reader. Several keys may share an action: the action is
 * pressed when the first of them goes down and released when the last goes up.
 */
export class Keyboard {
  private down = new Set<string>();
  private counts = new Map<Action, number>();
  private since = new Map<Action, number>();

  constructor(
    private bindings: Readonly<Record<string, Command>>,
    private handlers: KeyboardHandlers,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
  }

  /** Actions currently held, with the time each was first pressed. */
  held(): { action: Action; since: number }[] {
    return [...this.since].map(([action, since]) => ({ action, since }));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const command = this.bindings[e.code];
    if (!command) return;
    e.preventDefault();
    if (e.repeat || this.down.has(e.code)) return;
    this.down.add(e.code);
    if (command === 'retry' || command === 'exit') {
      this.handlers.onCommand(command);
      return;
    }
    const count = (this.counts.get(command) ?? 0) + 1;
    this.counts.set(command, count);
    if (count === 1) {
      this.since.set(command, e.timeStamp);
      this.handlers.onAction(command, true, e.timeStamp);
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.down.delete(e.code)) return;
    const command = this.bindings[e.code];
    if (!command || command === 'retry' || command === 'exit') return;
    this.releaseAction(command, e.timeStamp);
  };

  private releaseAction(action: Action, time: number) {
    const count = (this.counts.get(action) ?? 0) - 1;
    if (count > 0) {
      this.counts.set(action, count);
      return;
    }
    this.counts.delete(action);
    this.since.delete(action);
    this.handlers.onAction(action, false, time);
  }

  private releaseAll = () => {
    const now = performance.now();
    for (const code of this.down) {
      const command = this.bindings[code];
      if (command && command !== 'retry' && command !== 'exit') this.releaseAction(command, now);
    }
    this.down.clear();
  };
}
