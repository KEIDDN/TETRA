import type { Command } from '../lib/settings';

/** Sends a command as a press (and, for taps, its release) from a touch. */
export interface TouchSink {
  (command: Command, pressed: boolean, time: number): void;
}

/**
 * Touch controls the way the mobile classics do it, all on the board:
 * drag sideways and the piece follows your finger, cell by cell; tap to
 * rotate (two fingers rotate the other way); drag down to soft drop; flick
 * down to hard drop; flick up to hold.
 */
export class TouchControls {
  private id: number | null = null;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private stepped = 0;
  private moved = false;
  private softing = false;
  private samples: { y: number; t: number }[] = [];
  private secondFinger = false;

  constructor(
    private el: HTMLElement,
    private send: TouchSink,
    /** One board cell in CSS pixels: a finger moving one cell moves the piece one cell. */
    private cell: () => number,
  ) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.cancel);
    el.style.touchAction = 'none';
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.down);
    this.el.removeEventListener('pointermove', this.move);
    this.el.removeEventListener('pointerup', this.up);
    this.el.removeEventListener('pointercancel', this.cancel);
  }

  private tap(command: Command, t: number): void {
    this.send(command, true, t);
    this.send(command, false, t);
  }

  private down = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    if (this.id !== null) {
      // A second finger while the first rests: a two-finger tap.
      this.secondFinger = true;
      return;
    }
    this.id = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startT = e.timeStamp;
    this.stepped = 0;
    this.moved = false;
    this.softing = false;
    this.secondFinger = false;
    this.samples = [{ y: e.clientY, t: e.timeStamp }];
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Not every pointer can be captured (synthetic ones); the moves still arrive.
    }
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return;
    const cell = Math.max(12, this.cell());
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    this.samples.push({ y: e.clientY, t: e.timeStamp });
    while (this.samples.length > 2 && e.timeStamp - this.samples[0].t > 90) this.samples.shift();

    // Sideways: one cell of finger travel is one cell of piece travel.
    if (!this.softing) {
      const cells = Math.trunc(dx / cell);
      while (this.stepped < cells) {
        this.tap('moveRight', e.timeStamp);
        this.stepped++;
        this.moved = true;
      }
      while (this.stepped > cells) {
        this.tap('moveLeft', e.timeStamp);
        this.stepped--;
        this.moved = true;
      }
    }

    // Down, mostly straight down: soft drop while the finger stays down there.
    const downward = dy > cell * 1.2 && Math.abs(dy) > Math.abs(dx) * 1.4;
    if (downward && !this.softing) {
      this.softing = true;
      this.moved = true;
      this.send('softDrop', true, e.timeStamp);
    } else if (this.softing && dy < cell * 0.6) {
      this.softing = false;
      this.send('softDrop', false, e.timeStamp);
    }
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return;
    this.id = null;
    const cell = Math.max(12, this.cell());
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const first = this.samples[0];
    const speed = first ? (e.clientY - first.y) / Math.max(1, e.timeStamp - first.t) : 0; // px per ms, + is down

    if (this.softing) this.send('softDrop', false, e.timeStamp);
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.2;
    // A flick: fast at the end, or the whole gesture over in a moment.
    const quick = e.timeStamp - this.startT < 260;
    if (vertical && dy > cell * 2 && (speed > 0.7 || quick)) this.tap('hardDrop', e.timeStamp);
    else if (vertical && dy < -cell * 2 && (speed < -0.45 || quick)) this.tap('hold', e.timeStamp);
    else if (!this.moved && Math.hypot(dx, dy) < cell * 0.6 && e.timeStamp - this.startT < 350) {
      this.tap(this.secondFinger ? 'rotateCCW' : 'rotateCW', e.timeStamp);
    }
    this.softing = false;
  };

  private cancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.id) return;
    if (this.softing) this.send('softDrop', false, e.timeStamp);
    this.id = null;
    this.softing = false;
  };
}

/** A phone or tablet: the board takes touch, and the layout goes portrait. */
export const touchDevice = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
