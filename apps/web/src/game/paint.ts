/**
 * Canvas helpers for painting blocks. Connected skins draw each cell
 * according to its link mask so a piece reads as one continuous shape:
 * open sides are inset and rounded, linked sides run to the cell edge.
 * Canvas y grows downward, so LINK_UP is the cell's top side.
 */

export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;
const UP_RIGHT = 16;
const DOWN_RIGHT = 32;
const DOWN_LEFT = 64;
const UP_LEFT = 128;

export interface Shape {
  size: number;
  pad: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Corner radii: top-left, top-right, bottom-right, bottom-left. */
  radii: [number, number, number, number];
  /** Concave corners (both sides linked, diagonal not): tl, tr, br, bl. */
  notches: [boolean, boolean, boolean, boolean];
  open: { up: boolean; right: boolean; down: boolean; left: boolean };
}

export function shape(size: number, mask: number, pad: number, radius: number): Shape {
  const up = !(mask & UP);
  const right = !(mask & RIGHT);
  const down = !(mask & DOWN);
  const left = !(mask & LEFT);
  return {
    size,
    pad,
    x0: left ? pad : 0,
    y0: up ? pad : 0,
    x1: right ? size - pad : size,
    y1: down ? size - pad : size,
    radii: [up && left ? radius : 0, up && right ? radius : 0, down && right ? radius : 0, down && left ? radius : 0],
    notches: [
      !up && !left && !(mask & UP_LEFT),
      !up && !right && !(mask & UP_RIGHT),
      !down && !right && !(mask & DOWN_RIGHT),
      !down && !left && !(mask & DOWN_LEFT),
    ],
    open: { up, right, down, left },
  };
}

/** The shape's outline path. With `extend`, linked sides are pushed outside the cell so strokes there fall off-canvas. */
export function shapePath(ctx: CanvasRenderingContext2D, s: Shape, extend = 0): void {
  const e = extend;
  const x0 = s.open.left ? s.x0 : -e;
  const y0 = s.open.up ? s.y0 : -e;
  const x1 = s.open.right ? s.x1 : s.size + e;
  const y1 = s.open.down ? s.y1 : s.size + e;
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, s.radii);
}

/** Clips to the cell, letting open sides spill `bleed` px (for glows) while linked sides stop at the edge. */
export function clipCell(ctx: CanvasRenderingContext2D, s: Shape, bleed: number): void {
  const x0 = s.open.left ? -bleed : 0;
  const y0 = s.open.up ? -bleed : 0;
  const x1 = s.open.right ? s.size + bleed : s.size;
  const y1 = s.open.down ? s.size + bleed : s.size;
  ctx.beginPath();
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
}

/** Cuts the pad×pad square out of each concave corner. */
export function carveNotches(ctx: CanvasRenderingContext2D, s: Shape): void {
  const { pad, size } = s;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const corners: [number, number][] = [
    [0, 0],
    [size - pad, 0],
    [size - pad, size - pad],
    [0, size - pad],
  ];
  s.notches.forEach((on, i) => on && ctx.fillRect(corners[i][0], corners[i][1], pad, pad));
  ctx.restore();
}

/** Strokes the little elbow an outline needs around each concave corner. */
export function strokeNotches(ctx: CanvasRenderingContext2D, s: Shape, inset: number): void {
  const { pad, size } = s;
  const p = pad + inset;
  const q = size - pad - inset;
  const paths: [number, number][][] = [
    [
      [p, 0],
      [p, p],
      [0, p],
    ],
    [
      [q, 0],
      [q, p],
      [size, p],
    ],
    [
      [q, size],
      [q, q],
      [size, q],
    ],
    [
      [p, size],
      [p, q],
      [0, q],
    ],
  ];
  s.notches.forEach((on, i) => {
    if (!on) return;
    ctx.beginPath();
    const [a, b, c] = paths[i];
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.lineTo(...c);
    ctx.stroke();
  });
}

/** Linear gradient band along one open edge, fading inward. */
export function edgeBand(
  ctx: CanvasRenderingContext2D,
  s: Shape,
  side: 'up' | 'down' | 'left' | 'right',
  depth: number,
  color: (alpha: number) => string,
  alpha: number,
): void {
  if (!s.open[side]) return;
  const { x0, y0, x1, y1 } = s;
  const g =
    side === 'up'
      ? ctx.createLinearGradient(0, y0, 0, y0 + depth)
      : side === 'down'
        ? ctx.createLinearGradient(0, y1, 0, y1 - depth)
        : side === 'left'
          ? ctx.createLinearGradient(x0, 0, x0 + depth, 0)
          : ctx.createLinearGradient(x1, 0, x1 - depth, 0);
  g.addColorStop(0, color(alpha));
  g.addColorStop(1, color(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s.size, s.size);
}

/** Strokes only the parts of the outline on a given side band (top, middle or bottom). */
export function strokeBand(ctx: CanvasRenderingContext2D, s: Shape, band: 'top' | 'middle' | 'bottom', style: string, width: number): void {
  const r = Math.max(...s.radii, width) + 1;
  // Only a cell with an open top/bottom has a top/bottom band; otherwise its sides belong to the middle.
  const topEnd = s.open.up ? s.y0 + r : -2;
  const bottomStart = s.open.down ? s.y1 - r : s.size + 2;
  const ranges = { top: [-2, topEnd], middle: [topEnd, bottomStart], bottom: [bottomStart, s.size + 2] } as const;
  const [a, b] = ranges[band];
  if (b <= a) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-2, a, s.size + 4, b - a);
  ctx.clip();
  shapePath(ctx, s, width * 2);
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

export const white = (a: number) => `rgba(255,255,255,${a})`;
export const black = (a: number) => `rgba(0,0,0,${a})`;

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mixes a color toward white (amount > 0) or black (amount < 0). */
export function shade(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const [r, g, b] = channels(hex).map((c) => Math.round(c + (target - c) * t));
  return `rgb(${r},${g},${b})`;
}

/** Deterministic grain so every texture build looks identical. */
export function grain(ctx: CanvasRenderingContext2D, size: number, density: number, light: number, dark: number): void {
  let seed = 1337;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dots = Math.round(size * size * density);
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = rand() > 0.5 ? white(light) : black(dark);
    ctx.fillRect(rand() * size, rand() * size, 1, 1);
  }
}
