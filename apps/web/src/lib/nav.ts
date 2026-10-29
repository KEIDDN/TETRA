import { useEffect, useRef } from 'react';
import { sfx } from '../audio/sfx';
import { gamepads } from '../game/gamepad';
import { STICK_DOWN, STICK_LEFT, STICK_RIGHT, STICK_UP } from './settings';

const UP = new Set([12, STICK_UP]);
const DOWN = new Set([13, STICK_DOWN]);
const LEFT = new Set([14, STICK_LEFT]);
const RIGHT = new Set([15, STICK_RIGHT]);
const CONFIRM = 0;
const BACK = 1;

type Direction = 'up' | 'down' | 'left' | 'right';

function focusables(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-nav]')].filter(
    (el) =>
      !(el as HTMLButtonElement).disabled &&
      el.offsetParent !== null &&
      el.tabIndex !== -1 &&
      getComputedStyle(el).visibility !== 'hidden' &&
      // Inherited: true for controls inside a panel that is faded out and switched off.
      getComputedStyle(el).pointerEvents !== 'none',
  );
}

function land(el: HTMLElement): void {
  if (el !== document.activeElement) sfx.ui('move');
  el.focus({ focusVisible: true } as FocusOptions);
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Moves focus the way the stick points: to the nearest control in that
 * direction on screen. Inside a list marked `data-nav-group` (like the mode
 * wheel), up and down step through the list in order first; entering a list
 * lands on its current item.
 */
function moveFocus(direction: Direction): void {
  const items = focusables();
  if (items.length === 0) return;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !items.includes(current)) return land(items[0]);

  const group = current.closest<HTMLElement>('[data-nav-group]');
  const vertical = direction === 'up' || direction === 'down';
  if (group && vertical) {
    const members = items.filter((el) => group.contains(el));
    const next = members[members.indexOf(current) + (direction === 'down' ? 1 : -1)];
    if (next) return land(next);
  }

  const from = current.getBoundingClientRect();
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === current || (group && group.contains(el))) continue;
    const r = el.getBoundingClientRect();
    // Gap along the direction (edge to edge), and drift across it (centre to centre).
    const gap =
      direction === 'down' ? r.top - from.bottom : direction === 'up' ? from.top - r.bottom : direction === 'right' ? r.left - from.right : from.left - r.right;
    const ahead =
      direction === 'down'
        ? r.top + r.height / 2 > cy + 2
        : direction === 'up'
          ? r.top + r.height / 2 < cy - 2
          : direction === 'right'
            ? r.left + r.width / 2 > cx + 2
            : r.left + r.width / 2 < cx - 2;
    if (!ahead) continue;
    const drift = vertical ? Math.abs(r.left + r.width / 2 - cx) : Math.abs(r.top + r.height / 2 - cy);
    const score = Math.max(0, gap) + drift * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (!best) return;
  const target = best.closest<HTMLElement>('[data-nav-group]')?.querySelector<HTMLElement>('[data-nav-current]') ?? best;
  land(items.includes(target) ? target : best);
}

/** Nudges a focused range input and lets React see the change. */
function stepRange(el: HTMLInputElement, direction: 1 | -1): void {
  if (direction === 1) el.stepUp();
  else el.stepDown();
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function horizontal(direction: 1 | -1): void {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement && el.type === 'range') stepRange(el, direction);
  else moveFocus(direction === 1 ? 'right' : 'left');
}

/** Holding a direction repeats it, like a held arrow key. */
const REPEAT_DELAY = 360;
const REPEAT_EVERY = 95;

/**
 * Menu navigation for elements marked `data-nav`: d-pad / stick / arrow keys
 * move focus, A confirms, B goes back.
 */
export function useMenuNav(onBack?: () => void, enabled = true, onHorizontal?: (direction: 1 | -1) => void): void {
  const backRef = useRef(onBack);
  backRef.current = onBack;
  const horizontalRef = useRef(onHorizontal);
  horizontalRef.current = onHorizontal;
  const sideways = (direction: 1 | -1) => (horizontalRef.current ? horizontalRef.current(direction) : horizontal(direction));

  useEffect(() => {
    if (!enabled) return;
    let held: { button: number; timer: number } | null = null;
    const release = () => {
      if (held) clearTimeout(held.timer);
      held = null;
    };
    const unsubscribe = gamepads.subscribe((e) => {
      const step = UP.has(e.button)
        ? () => moveFocus('up')
        : DOWN.has(e.button)
          ? () => moveFocus('down')
          : LEFT.has(e.button)
            ? () => sideways(-1)
            : RIGHT.has(e.button)
              ? () => sideways(1)
              : null;
      if (!e.pressed) {
        if (held?.button === e.button) release();
        return;
      }
      if (step) {
        release();
        step();
        const again = () => {
          step();
          if (held) held.timer = window.setTimeout(again, REPEAT_EVERY);
        };
        held = { button: e.button, timer: window.setTimeout(again, REPEAT_DELAY) };
      } else if (e.button === CONFIRM) {
        const el = document.activeElement as HTMLElement | null;
        if (el?.hasAttribute('data-nav')) el.click();
        else moveFocus('down');
      } else if (e.button === BACK && backRef.current) {
        sfx.ui('back');
        backRef.current();
      }
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault();
        moveFocus(e.code === 'ArrowDown' ? 'down' : 'up');
      } else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && horizontalRef.current) {
        e.preventDefault();
        horizontalRef.current(e.code === 'ArrowRight' ? 1 : -1);
      } else if (e.code === 'Escape' && backRef.current) {
        e.preventDefault();
        sfx.ui('back');
        backRef.current();
      }
    };
    // Every activated menu control clicks, whether by mouse, keyboard or controller.
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-nav]')) sfx.ui('select');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, true);
    return () => {
      release();
      unsubscribe();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick, true);
    };
  }, [enabled]);
}
