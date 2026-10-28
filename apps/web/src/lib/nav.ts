import { useEffect, useRef } from 'react';
import { gamepads } from '../game/gamepad';
import { STICK_DOWN, STICK_LEFT, STICK_RIGHT, STICK_UP } from './settings';

const UP = new Set([12, STICK_UP]);
const DOWN = new Set([13, STICK_DOWN]);
const LEFT = new Set([14, STICK_LEFT]);
const RIGHT = new Set([15, STICK_RIGHT]);
const CONFIRM = 0;
const BACK = 1;

function focusables(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-nav]')].filter(
    (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
  );
}

function moveFocus(step: 1 | -1): void {
  const items = focusables();
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = index === -1 ? (step === 1 ? 0 : items.length - 1) : (index + step + items.length) % items.length;
  items[next].focus({ focusVisible: true } as FocusOptions);
  items[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
  else moveFocus(direction);
}

/**
 * Menu navigation for elements marked `data-nav`: d-pad / stick / arrow keys
 * move focus, A confirms, B goes back.
 */
export function useMenuNav(onBack?: () => void, enabled = true): void {
  const backRef = useRef(onBack);
  backRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = gamepads.subscribe((e) => {
      if (!e.pressed) return;
      if (UP.has(e.button)) moveFocus(-1);
      else if (DOWN.has(e.button)) moveFocus(1);
      else if (LEFT.has(e.button)) horizontal(-1);
      else if (RIGHT.has(e.button)) horizontal(1);
      else if (e.button === CONFIRM) {
        const el = document.activeElement as HTMLElement | null;
        if (el?.hasAttribute('data-nav')) el.click();
        else moveFocus(1);
      } else if (e.button === BACK) backRef.current?.();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
        e.preventDefault();
        moveFocus(e.code === 'ArrowDown' ? 1 : -1);
      } else if (e.code === 'Escape' && backRef.current) {
        e.preventDefault();
        backRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKey);
    };
  }, [enabled]);
}
