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
  const { pad, size } = s;
  // The band's edge sits on the outline: inset by pad where that side is open.
  const edge = side === 'up' || side === 'left' ? pad : size - pad;
  const g =
    side === 'up' || side === 'down'
      ? ctx.createLinearGradient(0, edge, 0, edge + (side === 'up' ? depth : -depth))
      : ctx.createLinearGradient(edge, 0, edge + (side === 'left' ? depth : -depth), 0);
  g.addColorStop(0, color(alpha));
  g.addColorStop(1, color(0));
  ctx.fillStyle = g;
  if (s.open[side]) {
    ctx.fillRect(0, 0, size, size);
    return;
  }
  // A concave corner carries the neighbours' outline pad px into this cell;
  // continue their bands along it so they don't stop short at the cell edge.
  const [tl, tr, br, bl] = s.notches;
  const far = size - pad;
  if (side === 'up') {
    if (tl) ctx.fillRect(0, pad, pad, depth);
    if (tr) ctx.fillRect(far, pad, pad, depth);
  } else if (side === 'down') {
    if (bl) ctx.fillRect(0, far - depth, pad, depth);
    if (br) ctx.fillRect(far, far - depth, pad, depth);
  } else if (side === 'left') {
    if (tl) ctx.fillRect(pad, 0, depth, pad);
    if (bl) ctx.fillRect(pad, far, depth, pad);
  } else {
    if (tr) ctx.fillRect(far - depth, 0, depth, pad);
    if (br) ctx.fillRect(far - depth, far, depth, pad);
  }
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

/** Seeded Park–Miller generator, so every texture build looks identical. */
export function random(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const fields = new Map<string, Float32Array>();

/**
 * Fractal value noise in [0, 1] that tiles with period `size`, so a texture
 * runs on seamlessly into the neighbouring cell of a connected piece.
 */
function noiseField(size: number, seed: number, scale: number, octaves: number): Float32Array {
  const key = `${size}:${seed}:${scale}:${octaves}`;
  const cached = fields.get(key);
  if (cached) return cached;
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = scale << o;
    const rand = random(seed * 31 + o * 977);
    const lattice = Float32Array.from({ length: n * n }, rand);
    const at = (x: number, y: number) => lattice[(y % n) * n + (x % n)];
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n;
      const iy = Math.floor(fy);
      const ty = (fy - iy) * (fy - iy) * (3 - 2 * (fy - iy));
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n;
        const ix = Math.floor(fx);
        const tx = (fx - ix) * (fx - ix) * (3 - 2 * (fx - ix));
        const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
        const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
        out[y * size + x] += (top + (bottom - top) * ty) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  fields.set(key, out);
  return out;
}

export interface MottleOptions {
  seed: number;
  /** Lattice cells across one block for the coarsest octave. */
  scale: number;
  octaves?: number;
  /** Peak alpha of the light and dark halves. */
  light: number;
  dark: number;
  lightColor?: string;
  darkColor?: string;
  /** Pushes the field toward its extremes (1 = linear). */
  contrast?: number;
}

/** Paints a tileable mottled texture over the block, respecting the current clip. */
export function mottle(ctx: CanvasRenderingContext2D, size: number, o: MottleOptions): void {
  const n = Math.max(1, Math.round(size));
  const field = noiseField(n, o.seed, o.scale, o.octaves ?? 4);
  const [lr, lg, lb] = channels(o.lightColor ?? '#ffffff');
  const [dr, dg, db] = channels(o.darkColor ?? '#000000');
  const contrast = o.contrast ?? 1;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n;
  const tex = canvas.getContext('2d')!;
  const img = tex.createImageData(n, n);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(-1, Math.min(1, (field[i] - 0.5) * 2 * contrast));
    const p = i * 4;
    const light = v > 0;
    img.data[p] = light ? lr : dr;
    img.data[p + 1] = light ? lg : dg;
    img.data[p + 2] = light ? lb : db;
    img.data[p + 3] = Math.round(Math.abs(v) * (light ? o.light : o.dark) * 255);
  }
  tex.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0, size, size);
}

/** Small air pits, as in cast concrete or pitted steel: a dark hollow with a lit lower lip. */
export function pits(ctx: CanvasRenderingContext2D, size: number, seed: number, count: number, radius: number, depth = 0.5): void {
  const rand = random(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = radius * (0.4 + rand() * 0.8);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.35, r, 0, Math.PI * 2);
    ctx.fillStyle = white(depth * 0.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = black(depth);
    ctx.fill();
  }
}

/** Fine horizontal hairlines, like brushed or rolled metal; tiles across linked cells. */
export function brushed(ctx: CanvasRenderingContext2D, size: number, seed: number, alpha: number): void {
  const rand = random(seed);
  const step = Math.max(1, size / 48);
  for (let y = 0; y < size; y += step) {
    const a = (rand() - 0.5) * 2 * alpha;
    ctx.fillStyle = a > 0 ? white(a) : black(-a);
    ctx.fillRect(0, y, size, step * 0.6);
  }
}

/** Vertical runoff streaks, like rain on weathered steel. Each spans the cell so it continues into the cell below. */
export function streaks(ctx: CanvasRenderingContext2D, size: number, seed: number, count: number, color: string, alpha: number): void {
  const rand = random(seed);
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const w = size * (0.015 + rand() * 0.06);
    const a = alpha * (0.3 + rand() * 0.7);
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.5, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - w, 0, w * 2, size);
  }
}
