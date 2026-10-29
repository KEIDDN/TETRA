import type { Command } from '../lib/settings';
import { COMMANDS, STICK_DOWN, STICK_LEFT, STICK_RIGHT, STICK_UP } from '../lib/settings';
import { buttonLabel, keyLabel, type PadKind } from '../lib/labels';

/** What each command is called where space is tight. */
const SHORT: Record<Command, string> = {
  moveLeft: 'Left',
  moveRight: 'Right',
  softDrop: 'Soft',
  hardDrop: 'Hard',
  rotateCW: 'CW',
  rotateCCW: 'CCW',
  rotate180: '180',
  hold: 'Hold',
  retry: 'Retry',
  pause: 'Pause',
};

/** input → the commands bound to it. */
function byInput<K extends string | number>(bindings: Record<Command, K[]>): Map<K, string> {
  const map = new Map<K, string>();
  for (const { id } of COMMANDS) {
    for (const k of bindings[id] ?? []) map.set(k, map.has(k) ? `${map.get(k)} · ${SHORT[id]}` : SHORT[id]);
  }
  return map;
}

// ── Keyboard ────────────────────────────────────────────────────

type Key = [code: string, width?: number];
const letters = (s: string): Key[] => [...s].map((c) => [`Key${c}`]);
const ROWS: Key[][] = [
  [['Escape'], ...'1234567890'.split('').map((d): Key => [`Digit${d}`]), ['Minus'], ['Equal'], ['Backspace', 1.5]],
  [['Tab', 1.5], ...letters('QWERTYUIOP'), ['BracketLeft'], ['BracketRight'], ['Backslash']],
  [['CapsLock', 1.75], ...letters('ASDFGHJKL'), ['Semicolon'], ['Quote'], ['Enter', 1.75]],
  [['ShiftLeft', 2.25], ...letters('ZXCVBNM'), ['Comma'], ['Period'], ['Slash'], ['ShiftRight', 2.25]],
  [['ControlLeft', 1.25], ['AltLeft', 1.25], ['MetaLeft', 1.25], ['Space', 6.25], ['MetaRight', 1.25], ['AltRight', 1.25], ['ControlRight', 1.25]],
];
const U = 30;
const GAP = 4;
const ARROWS_X = 15.5 * U + 18;

const KEY_TEXT: Record<string, string> = { Backspace: '⌫', CapsLock: 'Caps', Enter: '↵', Tab: 'Tab', Escape: 'Esc' };

/** A minimal keyboard: the keys you play with light up with what they do. */
export function KeyboardPreview({ bindings }: { bindings: Record<Command, string[]> }) {
  const bound = byInput(bindings);
  const keys: { code: string; x: number; y: number; w: number }[] = [];
  ROWS.forEach((row, r) => {
    let x = 0;
    for (const [code, width = 1] of row) {
      keys.push({ code, x, y: r * U, w: width * U - GAP });
      x += width * U;
    }
  });
  keys.push(
    { code: 'ArrowUp', x: ARROWS_X + U, y: 3 * U, w: U - GAP },
    { code: 'ArrowLeft', x: ARROWS_X, y: 4 * U, w: U - GAP },
    { code: 'ArrowDown', x: ARROWS_X + U, y: 4 * U, w: U - GAP },
    { code: 'ArrowRight', x: ARROWS_X + 2 * U, y: 4 * U, w: U - GAP },
  );

  return (
    <svg viewBox={`-2 -2 ${ARROWS_X + 3 * U + 2} ${5 * U + 2}`} className="w-full" role="img" aria-label="Keyboard layout">
      {keys.map(({ code, x, y, w }) => {
        const action = bound.get(code);
        const h = U - GAP;
        return (
          <g key={code}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx={6}
              fill={action ? '#f4f3fb' : 'rgba(255,255,255,0.035)'}
              stroke={action ? 'none' : 'rgba(255,255,255,0.09)'}
            />
            {action ? (
              <>
                <text x={x + w / 2} y={y + 11} textAnchor="middle" fontSize="7" fill="rgba(0,0,0,0.45)" fontFamily="Geist Mono, monospace">
                  {KEY_TEXT[code] ?? keyLabel(code)}
                </text>
                <text x={x + w / 2} y={y + 21} textAnchor="middle" fontSize={action.length > 6 ? 6 : 7.5} fontWeight={600} fill="#000">
                  {action}
                </text>
              </>
            ) : (
              <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)" fontFamily="Geist Mono, monospace">
                {KEY_TEXT[code] ?? (code.startsWith('Key') || code.startsWith('Digit') || code.startsWith('Arrow') ? keyLabel(code) : '')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Controller ──────────────────────────────────────────────────

type Spot = { x: number; y: number; side: 'left' | 'right' };
const SPOTS: Record<number, Spot> = {
  0: { x: 392, y: 162, side: 'right' },
  1: { x: 414, y: 140, side: 'right' },
  2: { x: 370, y: 140, side: 'right' },
  3: { x: 392, y: 118, side: 'right' },
  4: { x: 214, y: 72, side: 'left' },
  5: { x: 386, y: 72, side: 'right' },
  6: { x: 214, y: 52, side: 'left' },
  7: { x: 386, y: 52, side: 'right' },
  8: { x: 276, y: 128, side: 'left' },
  9: { x: 324, y: 128, side: 'right' },
  10: { x: 258, y: 188, side: 'left' },
  11: { x: 342, y: 188, side: 'right' },
  12: { x: 208, y: 124, side: 'left' },
  13: { x: 208, y: 156, side: 'left' },
  14: { x: 192, y: 140, side: 'left' },
  15: { x: 224, y: 140, side: 'left' },
  [STICK_LEFT]: { x: 246, y: 188, side: 'left' },
  [STICK_RIGHT]: { x: 270, y: 188, side: 'left' },
  [STICK_UP]: { x: 258, y: 176, side: 'left' },
  [STICK_DOWN]: { x: 258, y: 200, side: 'left' },
};

/** A minimal controller drawing with callouts for every bound button. */
export function ControllerPreview({ bindings, kind, stick }: { bindings: Record<Command, number[]>; kind: PadKind; stick: boolean }) {
  const bound = byInput(bindings);
  const on = (b: number) => bound.has(b);
  const fill = (b: number) => (on(b) ? '#f4f3fb' : 'rgba(255,255,255,0.05)');
  const stroke = 'rgba(255,255,255,0.18)';

  const callouts = [...bound.entries()]
    .filter(([b]) => SPOTS[b] && (stick || b < STICK_LEFT))
    .map(([b, action]) => ({ b, action, ...SPOTS[b] }));
  const placed = (['left', 'right'] as const).flatMap((side) => {
    const list = callouts.filter((c) => c.side === side).sort((a, b) => a.y - b.y);
    const top = 30;
    const step = list.length > 1 ? Math.min(32, 220 / (list.length - 1)) : 0;
    const start = list.length > 1 ? top + (220 - step * (list.length - 1)) / 2 : 140;
    return list.map((c, i) => ({ ...c, ly: start + i * step }));
  });

  const face = (b: number, x: number, y: number) => (
    <g key={b}>
      <circle cx={x} cy={y} r={9} fill={fill(b)} stroke={on(b) ? 'none' : stroke} />
      <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight={600} fill={on(b) ? '#000' : 'rgba(255,255,255,0.45)'}>
        {buttonLabel(b, kind)}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 600 270" className="w-full" role="img" aria-label="Controller layout">
      {/* Triggers and bumpers */}
      <rect x={186} y={46} width={56} height={12} rx={6} fill={fill(6)} stroke={on(6) ? 'none' : stroke} />
      <rect x={358} y={46} width={56} height={12} rx={6} fill={fill(7)} stroke={on(7) ? 'none' : stroke} />
      <rect x={180} y={66} width={68} height={10} rx={5} fill={fill(4)} stroke={on(4) ? 'none' : stroke} />
      <rect x={352} y={66} width={68} height={10} rx={5} fill={fill(5)} stroke={on(5) ? 'none' : stroke} />
      {/* Body */}
      <path
        d="M210 84 H390 C440 84 462 108 474 150 L494 222 C500 246 476 262 456 248 L414 214 H186 L144 248 C124 262 100 246 106 222 L126 150 C138 108 160 84 210 84 Z"
        fill="rgba(255,255,255,0.025)"
        stroke={stroke}
      />
      {/* D-pad */}
      <rect x={202} y={114} width={12} height={20} rx={3} fill={fill(12)} stroke={on(12) ? 'none' : stroke} />
      <rect x={202} y={146} width={12} height={20} rx={3} fill={fill(13)} stroke={on(13) ? 'none' : stroke} />
      <rect x={182} y={134} width={20} height={12} rx={3} fill={fill(14)} stroke={on(14) ? 'none' : stroke} />
      <rect x={214} y={134} width={20} height={12} rx={3} fill={fill(15)} stroke={on(15) ? 'none' : stroke} />
      {/* Face buttons */}
      {face(3, 392, 118)}
      {face(2, 370, 140)}
      {face(1, 414, 140)}
      {face(0, 392, 162)}
      {/* Select / start */}
      <rect x={268} y={124} width={16} height={8} rx={4} fill={fill(8)} stroke={on(8) ? 'none' : stroke} />
      <rect x={316} y={124} width={16} height={8} rx={4} fill={fill(9)} stroke={on(9) ? 'none' : stroke} />
      {/* Sticks */}
      <circle
        cx={258}
        cy={188}
        r={17}
        fill={on(10) || (stick && [STICK_LEFT, STICK_RIGHT, STICK_UP, STICK_DOWN].some(on)) ? 'rgba(244,243,251,0.85)' : 'rgba(255,255,255,0.05)'}
        stroke={stroke}
      />
      <circle cx={342} cy={188} r={17} fill={fill(11)} stroke={on(11) ? 'none' : stroke} />

      {/* Callouts */}
      {placed.map((c) => {
        const lx = c.side === 'left' ? 96 : 504;
        return (
          <g key={c.b}>
            <polyline
              points={`${c.x},${c.y} ${c.side === 'left' ? 150 : 450},${c.ly} ${lx},${c.ly}`}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={0.8}
            />
            <circle cx={c.x} cy={c.y} r={1.8} fill="#fff" />
            <text x={c.side === 'left' ? lx - 6 : lx + 6} y={c.ly + 3.5} textAnchor={c.side === 'left' ? 'end' : 'start'} fontSize="10" fill="rgba(255,255,255,0.75)">
              {c.action}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export const SUPPORTED_PADS = ['Xbox Series and One', 'PlayStation 5 DualSense', 'PlayStation 4 DualShock', 'Switch Pro', 'Most USB and Bluetooth pads'];
