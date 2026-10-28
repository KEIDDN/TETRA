import type { ClearInfo } from '@tetra/engine';

const LINE_NAMES = ['', 'Single', 'Double', 'Triple', 'Quad'];
const HOLD_MS = 1500;

/**
 * Imperative DOM overlay for clear callouts. Plain DOM (not React state) so a
 * burst of clears never re-renders the game screen.
 */
export class ActionText {
  private current: HTMLElement | null = null;
  private combo: HTMLElement | null = null;
  private timers = new Set<number>();

  constructor(
    /** Column left of the board, right-aligned. */
    private side: HTMLElement,
    /** Box over the board, for centered callouts. */
    private center: HTMLElement,
  ) {}

  clear(info: ClearInfo, color: string): void {
    if (info.perfectClear) this.banner('All clear', 'allclear');

    const el = document.createElement('div');
    el.className = 'action';
    if (info.lines > 0 && info.b2b >= 1) el.append(this.span('action-b2b', `B2B ×${info.b2b}`));
    if (info.spin !== 'none') {
      const spin = this.span('action-spin', info.piece === 'T' ? 'T-spin' : `${info.piece}-spin`);
      spin.style.color = color;
      if (info.spin === 'mini') spin.append(this.span('action-mini', 'mini'));
      el.append(spin);
    }
    if (info.lines > 0) el.append(this.span(`action-lines action-lines-${info.lines}`, LINE_NAMES[Math.min(info.lines, 4)]));
    this.replace('current', el);

    if (info.combo >= 1) {
      const combo = document.createElement('div');
      combo.className = 'action action-combo';
      combo.innerHTML = `<span class="tabular">${info.combo}</span> combo`;
      this.replace('combo', combo);
    }
  }

  levelUp(level: number): void {
    this.banner(`Level ${level}`, 'levelup');
  }

  reset(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.side.replaceChildren();
    this.center.replaceChildren();
    this.current = this.combo = null;
  }

  private span(className: string, text: string): HTMLSpanElement {
    const s = document.createElement('span');
    s.className = className;
    s.textContent = text;
    return s;
  }

  private replace(slot: 'current' | 'combo', el: HTMLElement): void {
    const old = this[slot];
    if (old) this.fadeOut(old);
    this[slot] = el;
    this.side.append(el);
    this.later(() => {
      if (this[slot] === el) {
        this.fadeOut(el);
        this[slot] = null;
      }
    }, HOLD_MS);
  }

  private banner(text: string, kind: string): void {
    const el = document.createElement('div');
    el.className = `banner banner-${kind}`;
    el.textContent = text;
    this.center.append(el);
    this.later(() => el.remove(), 1800);
  }

  private fadeOut(el: HTMLElement): void {
    el.classList.add('action-out');
    this.later(() => el.remove(), 320);
  }

  private later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }
}
