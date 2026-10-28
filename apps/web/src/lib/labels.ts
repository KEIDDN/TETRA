import { STICK_DOWN, STICK_LEFT, STICK_RIGHT, STICK_UP } from './settings';

const KEY_NAMES: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Space',
  ShiftLeft: 'L Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'L Alt',
  AltRight: 'R Alt',
  MetaLeft: 'L Cmd',
  MetaRight: 'R Cmd',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export type PadKind = 'xbox' | 'playstation' | 'switch' | 'generic';

export function detectPadKind(id: string): PadKind {
  // Xbox first: its pads also report themselves as "Wireless Controller".
  if (/xbox|xinput|045e/i.test(id)) return 'xbox';
  if (/playstation|dualsense|dualshock|054c|wireless controller/i.test(id)) return 'playstation';
  if (/nintendo|pro controller|joy-con|057e/i.test(id)) return 'switch';
  return 'generic';
}

export const PAD_NAMES: Record<PadKind, string> = {
  xbox: 'Xbox controller',
  playstation: 'PlayStation controller',
  switch: 'Switch controller',
  generic: 'Controller',
};

const SHARED: Record<number, string> = {
  12: 'D-pad ↑',
  13: 'D-pad ↓',
  14: 'D-pad ←',
  15: 'D-pad →',
  [STICK_LEFT]: 'Stick ←',
  [STICK_RIGHT]: 'Stick →',
  [STICK_DOWN]: 'Stick ↓',
  [STICK_UP]: 'Stick ↑',
};

const FACE: Record<PadKind, string[]> = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS'],
  generic: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'LS', 'RS'],
  playstation: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3'],
  // Standard mapping is positional: index 0 is the bottom button, which Nintendo labels B.
  switch: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS'],
};

export function buttonLabel(index: number, kind: PadKind): string {
  return SHARED[index] ?? FACE[kind][index] ?? `Button ${index}`;
}
