import type { PieceType } from '@tetra/engine';
import {
  black,
  brushed,
  carveNotches,
  clipCell,
  DOWN,
  edgeBand,
  grain,
  LEFT,
  mottle,
  pits,
  RIGHT,
  rgba,
  shade,
  shape,
  shapePath,
  strokeBand,
  streaks,
  strokeNotches,
  UP,
  white,
} from './paint';

export type BlockKind = PieceType | 'garbage';
export type SkinId =
  | 'studio'
  | 'clay'
  | 'gem'
  | 'crystal'
  | 'neon'
  | 'aurora'
  | 'ember'
  | 'bevel'
  | 'wire'
  | 'nes'
  | 'gameboy'
  | 'mono'
  | 'glass'
  | 'brut'
  | 'corten';
export type SoundPackId = 'studio' | 'glass' | 'wood' | 'pure';
export type Blend = 'normal' | 'add';
export type Palette = Record<BlockKind, string>;
export type GridStyle = 'lines' | 'dots' | 'none';

export interface Skin {
  id: SkinId;
  name: string;
  description: string;
  /** Block colors; may change with the level (NES). */
  palette(level: number): Palette;
  /** Whether the palette depends on the level. */
  leveled?: boolean;
  /** Draws pieces as continuous shapes using link masks. */
  connected: boolean;
  /** Extra margin painted around each block (fraction of a cell), for glows. */
  bleed: number;
  /** Paints one cell at (0,0) of side `size` (device px). `mask` is 0 for unconnected skins. */
  paint(ctx: CanvasRenderingContext2D, size: number, color: string, mask: number, kind: BlockKind): void;
  /** Ghost painter; defaults to the block at `ghostAlpha`. */
  paintGhost?(ctx: CanvasRenderingContext2D, size: number, color: string, mask: number): void;
  ghostAlpha: number;
  blend: Blend;
  fxBlend: Blend;
  particle: 'dot' | 'square';
  flash: string;
  sound: SoundPackId;
  /** Grid style when the player leaves it on Auto. */
  grid: GridStyle;
  /** Blocks slowly pulse in brightness. */
  breathe?: boolean;
}

const fixed = (palette: Palette) => () => palette;

/** A stable texture seed per piece type, so each piece's grain differs while every build looks the same. */
const KIND_SEED: Record<BlockKind, number> = { I: 11, O: 23, T: 37, S: 41, Z: 53, J: 67, L: 79, garbage: 97 };

function connectedGhost(width: number, alpha: number, fill: number, radius: number) {
  return (ctx: CanvasRenderingContext2D, size: number, color: string, mask: number) => {
    const pad = Math.max(1, Math.round(size * 0.05));
    const s = shape(size, mask, pad, size * radius);
    const w = Math.max(1, size * width);
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = rgba(color, fill);
    ctx.fill();
    carveNotches(ctx, s);
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = w;
    const inset = s.pad > 0 ? w / 2 : 0;
    const t = { ...s, x0: s.x0 + inset, y0: s.y0 + inset, x1: s.x1 - inset, y1: s.y1 - inset };
    shapePath(ctx, t, w * 2);
    ctx.stroke();
    strokeNotches(ctx, s, inset);
    ctx.restore();
  };
}

// ── Studio ──────────────────────────────────────────────────────

const STUDIO_COLORS: Palette = {
  I: '#4cc3f2',
  O: '#f6c445',
  T: '#a46ef0',
  S: '#43c776',
  Z: '#f0595a',
  J: '#4a78f5',
  L: '#f58b42',
  garbage: '#3a3a3f',
};

/** Studio: one continuous lit shape per piece. Light comes from above. */
const STUDIO: Skin = {
  id: 'studio',
  name: 'Studio',
  description: 'Continuous pieces, lit from above.',
  palette: fixed(STUDIO_COLORS),
  connected: true,
  bleed: 0,
  ghostAlpha: 1,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'studio',
  grid: 'lines',
  paint(ctx, size, color, mask, kind) {
    const pad = Math.max(1, Math.round(size * 0.04));
    const s = shape(size, mask, pad, size * 0.22);
    const w = Math.max(1, size * 0.03);
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    shapePath(ctx, s);
    ctx.clip();
    // Thin bands read as one bevel running around the whole piece; deep ones would show every cell.
    edgeBand(ctx, s, 'up', size * 0.24, white, 0.26);
    edgeBand(ctx, s, 'down', size * 0.22, black, 0.2);
    edgeBand(ctx, s, 'left', size * 0.12, white, 0.06);
    edgeBand(ctx, s, 'right', size * 0.12, black, 0.07);
    // A satin finish: barely-there mottling so the colour reads as a material, not a fill.
    mottle(ctx, size, { seed: KIND_SEED[kind], scale: 3, light: 0.025, dark: 0.03 });
    edgeBand(ctx, s, 'up', size * 0.06, white, 0.22);
    ctx.restore();
    carveNotches(ctx, s);
    strokeBand(ctx, s, 'top', white(0.5), w);
    strokeBand(ctx, s, 'middle', white(0.12), w);
    strokeBand(ctx, s, 'bottom', black(0.28), w);
    ctx.strokeStyle = white(0.12);
    ctx.lineWidth = w;
    strokeNotches(ctx, s, w / 2);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.035, 0.55, 0.08, 0.22),
};

// ── Clay ────────────────────────────────────────────────────────

const CLAY_COLORS: Palette = {
  I: '#8fd3ea',
  O: '#f3d488',
  T: '#c6a9ee',
  S: '#9cd8a7',
  Z: '#f1a39d',
  J: '#9bb4f1',
  L: '#f3ba8b',
  garbage: '#56565c',
};

/** Clay: soft-touch matte pastels with deep, pillowy shading. */
const CLAY: Skin = {
  id: 'clay',
  name: 'Clay',
  description: 'Soft-touch matte pastels.',
  palette: fixed(CLAY_COLORS),
  connected: true,
  bleed: 0,
  ghostAlpha: 1,
  blend: 'normal',
  fxBlend: 'normal',
  particle: 'square',
  flash: '#fffaf2',
  sound: 'wood',
  grid: 'lines',
  paint(ctx, size, color, mask, kind) {
    const pad = Math.max(1, Math.round(size * 0.045));
    const s = shape(size, mask, pad, size * 0.34);
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    shapePath(ctx, s);
    ctx.clip();
    edgeBand(ctx, s, 'up', size * 0.34, white, 0.42);
    edgeBand(ctx, s, 'left', size * 0.2, white, 0.14);
    edgeBand(ctx, s, 'down', size * 0.32, (a) => `rgba(70,40,30,${a})`, 0.3);
    edgeBand(ctx, s, 'right', size * 0.2, (a) => `rgba(70,40,30,${a})`, 0.12);
    // Soft-touch: broad, gentle unevenness plus a fine powdery tooth.
    mottle(ctx, size, { seed: KIND_SEED[kind], scale: 2, octaves: 3, light: 0.045, dark: 0.045, darkColor: '#462a1e' });
    grain(ctx, size, 0.12, 0.07, 0.045);
    ctx.restore();
    carveNotches(ctx, s);
    // A faint lit lip on the top edge, as on a pressed, rounded surface.
    strokeBand(ctx, s, 'top', white(0.32), Math.max(1, size * 0.022));
    ctx.restore();
  },
  paintGhost: connectedGhost(0.04, 0.5, 0.1, 0.34),
};

// ── Gem ─────────────────────────────────────────────────────────

const GEM_COLORS: Palette = {
  I: '#2ec5f0',
  O: '#ffc21a',
  T: '#a347f0',
  S: '#22c35e',
  Z: '#f0303d',
  J: '#2f62f0',
  L: '#ff7a1a',
  garbage: '#55555c',
};

/** Gem: a cut stone per cell, faceted with a specular glint. */
const GEM: Skin = {
  id: 'gem',
  name: 'Gem',
  description: 'Cut stones with facets and glints.',
  palette: fixed(GEM_COLORS),
  connected: false,
  bleed: 0,
  ghostAlpha: 0.22,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'glass',
  grid: 'lines',
  paint(ctx, size, color) {
    // An emerald (step) cut seen from above: concentric chamfered rings of
    // facets around a flat table. Steps alternate light and dark, as real
    // step cuts do, and a soft reflection crosses the table.
    const pad = Math.max(1, Math.round(size * 0.035));
    const s = size - pad * 2;
    const ring = (i: number): [number, number][] => {
      const c = s * 0.2 - i * 0.6;
      const a = i;
      const b = s - i;
      return [[a + c, a], [b - c, a], [b, a + c], [b, b - c], [b - c, b], [a + c, b], [a, b - c], [a, a + c]];
    };
    const path = (pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    ctx.save();
    ctx.translate(pad, pad);
    path(ring(0));
    ctx.fillStyle = shade(color, -0.35);
    ctx.fill();
    ctx.clip();
    const steps = [0, s * 0.09, s * 0.17, s * 0.24];
    // Light from the upper left: each facet's shade follows its outward normal.
    const normals = [[0, -1], [0.7, -0.7], [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7]];
    for (let k = 0; k < steps.length - 1; k++) {
      const outer = ring(steps[k]);
      const inner = ring(steps[k + 1]);
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        const lit = -(normals[i][0] * 0.55 + normals[i][1] * 0.85);
        const amount = lit * (k % 2 ? -0.22 : 0.42) + (k === 1 ? 0.06 : 0);
        path([outer[i], outer[j], inner[j], inner[i]]);
        ctx.fillStyle = shade(color, Math.max(-0.7, Math.min(0.7, amount)));
        ctx.fill();
      }
    }
    const t = ring(steps[steps.length - 1]);
    path(t);
    const table = ctx.createLinearGradient(t[0][0], t[0][1], t[4][0], t[4][1]);
    table.addColorStop(0, shade(color, 0.22));
    table.addColorStop(0.5, color);
    table.addColorStop(1, shade(color, -0.18));
    ctx.fillStyle = table;
    ctx.fill();
    // A broad, soft reflection across the table instead of a point glint.
    ctx.save();
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, 0, s, s);
    sheen.addColorStop(0.28, white(0));
    sheen.addColorStop(0.4, white(0.26));
    sheen.addColorStop(0.47, white(0.06));
    sheen.addColorStop(0.55, white(0));
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
    // Hairline facet edges.
    ctx.lineWidth = Math.max(0.75, s * 0.012);
    ctx.lineJoin = 'round';
    steps.slice(1).forEach((st, k) => {
      path(ring(st));
      ctx.strokeStyle = white(k === 2 ? 0.4 : 0.18);
      ctx.stroke();
    });
    ctx.beginPath();
    const o = ring(0);
    const i3 = ring(steps[3]);
    o.forEach(([x, y], i) => {
      ctx.moveTo(x, y);
      ctx.lineTo(i3[i][0], i3[i][1]);
    });
    ctx.strokeStyle = white(0.14);
    ctx.stroke();
    // Girdle: a crisp outline, lit on top.
    path(ring(0.5));
    const girdle = ctx.createLinearGradient(0, 0, 0, s);
    girdle.addColorStop(0, white(0.7));
    girdle.addColorStop(0.5, white(0.15));
    girdle.addColorStop(1, black(0.4));
    ctx.strokeStyle = girdle;
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.stroke();
    ctx.restore();
  },
};

// ── Neon ────────────────────────────────────────────────────────

const NEON_COLORS: Palette = {
  I: '#5ce1ff',
  O: '#ffe14d',
  T: '#c86bff',
  S: '#4dff9a',
  Z: '#ff4d6d',
  J: '#4d7cff',
  L: '#ff9f4d',
  garbage: '#8a8a94',
};

/** Neon: each piece is one glowing tube outline around a dim core. */
const NEON: Skin = {
  id: 'neon',
  name: 'Neon',
  description: 'One glowing tube of light per piece.',
  palette: fixed(NEON_COLORS),
  connected: true,
  bleed: 0.4,
  ghostAlpha: 1,
  blend: 'add',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'glass',
  grid: 'dots',
  paint(ctx, size, color, mask) {
    const pad = Math.max(2, Math.round(size * 0.1));
    const s = shape(size, mask, pad, size * 0.2);
    const w = Math.max(1.5, size * 0.07);
    ctx.save();
    clipCell(ctx, s, size * 0.4);
    const inset = { ...s, x0: s.x0 + w / 2, y0: s.y0 + w / 2, x1: s.x1 - w / 2, y1: s.y1 - w / 2 };
    const tube = () => {
      shapePath(ctx, inset, size);
      ctx.stroke();
      strokeNotches(ctx, s, w / 2);
    };
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.45;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    tube();
    tube();
    // Repaint the core flat so the inner glow doesn't vary from cell to cell.
    ctx.shadowBlur = 0;
    shapePath(ctx, inset);
    ctx.fillStyle = shade(color, -0.8);
    ctx.fill();
    carveNotches(ctx, s);
    tube();
    ctx.strokeStyle = white(0.85);
    ctx.lineWidth = Math.max(1, w * 0.3);
    shapePath(ctx, inset, size);
    ctx.stroke();
    strokeNotches(ctx, s, w / 2);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.035, 0.6, 0.06, 0.2),
};

// ── Bevel ───────────────────────────────────────────────────────

const BEVEL_COLORS: Palette = {
  I: '#3dc9b0',
  O: '#e8c13a',
  T: '#b04ae0',
  S: '#7ac83a',
  Z: '#e04a4f',
  J: '#4a5ae0',
  L: '#e8833a',
  garbage: '#6a6a70',
};

/** Bevel: the classic online-stacker mino, square with lit bevels. */
const BEVEL: Skin = {
  id: 'bevel',
  name: 'Bevel',
  description: 'The classic beveled mino of modern online play.',
  palette: fixed(BEVEL_COLORS),
  connected: false,
  bleed: 0,
  ghostAlpha: 0.28,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'square',
  flash: '#ffffff',
  sound: 'pure',
  grid: 'lines',
  paint(ctx, size, color, _mask, kind) {
    const s = size;
    const b = Math.max(2, s * 0.13);
    const facet = (points: [number, number][], fill: string | CanvasGradient) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const face = ctx.createLinearGradient(0, b, 0, s - b);
    face.addColorStop(0, shade(color, 0.12));
    face.addColorStop(1, shade(color, -0.08));
    ctx.fillStyle = face;
    ctx.fillRect(0, 0, s, s);
    // Bevels shade along their length too, as a moulded edge would.
    const ramp = (x0: number, y0: number, x1: number, y1: number, from: number, to: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, shade(color, from));
      g.addColorStop(1, shade(color, to));
      return g;
    };
    facet([[0, 0], [s, 0], [s - b, b], [b, b]], ramp(0, 0, s, 0, 0.48, 0.3));
    facet([[0, 0], [b, b], [b, s - b], [0, s]], ramp(0, 0, 0, s, 0.26, 0.08));
    facet([[s, 0], [s, s], [s - b, s - b], [s - b, b]], ramp(0, 0, 0, s, -0.12, -0.28));
    facet([[0, s], [b, s - b], [s - b, s - b], [s, s]], ramp(0, 0, s, 0, -0.3, -0.42));
    ctx.save();
    ctx.beginPath();
    ctx.rect(b, b, s - 2 * b, s - 2 * b);
    ctx.clip();
    mottle(ctx, size, { seed: KIND_SEED[kind], scale: 3, light: 0.05, dark: 0.05 });
    ctx.restore();
    // Crisp mitres and a lit inner edge where the bevel meets the face.
    const hair = Math.max(1, s * 0.016);
    ctx.lineWidth = hair;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(b, b);
    ctx.moveTo(s, 0);
    ctx.lineTo(s - b, b);
    ctx.strokeStyle = white(0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b, s - b);
    ctx.lineTo(b, b);
    ctx.lineTo(s - b, b);
    ctx.strokeStyle = black(0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s - b, b);
    ctx.lineTo(s - b, s - b);
    ctx.lineTo(b, s - b);
    ctx.strokeStyle = white(0.16);
    ctx.stroke();
    ctx.strokeStyle = black(0.35);
    ctx.strokeRect(hair / 2, hair / 2, s - hair, s - hair);
  },
};

// ── NES ─────────────────────────────────────────────────────────

/** NES palettes by level (primary, secondary), cycling every ten levels. */
const NES_LEVELS: [string, string][] = [
  ['#0058f8', '#3cbcfc'],
  ['#00a800', '#b8f818'],
  ['#d800cc', '#f878f8'],
  ['#0058f8', '#58d854'],
  ['#e40058', '#58f898'],
  ['#58f898', '#6888fc'],
  ['#f83800', '#7c7c7c'],
  ['#6844fc', '#a80020'],
  ['#0058f8', '#f83800'],
  ['#f83800', '#fca044'],
];

/** NES: 8×8 pixel blocks. Colors change with the level, as on the console. */
const NES: Skin = {
  id: 'nes',
  name: 'NES',
  description: 'Pixel blocks. Colors shift with every level.',
  leveled: true,
  palette(level) {
    const [primary, secondary] = NES_LEVELS[(Math.max(1, level) - 1) % NES_LEVELS.length];
    return { T: primary, O: primary, I: primary, J: primary, S: primary, L: secondary, Z: secondary, garbage: '#7c7c7c' };
  },
  connected: false,
  bleed: 0,
  ghostAlpha: 0.25,
  blend: 'normal',
  fxBlend: 'normal',
  particle: 'square',
  flash: '#ffffff',
  sound: 'pure',
  grid: 'none',
  paint(ctx, size, color, _mask, kind) {
    const edge = (i: number) => Math.round((i * size) / 8);
    const px = (x: number, y: number, w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(edge(x), edge(y), edge(x + w) - edge(x), edge(y + h) - edge(y));
    };
    px(0, 0, 7, 7, color);
    if (kind === 'T' || kind === 'O' || kind === 'I') {
      px(1, 1, 5, 5, '#fcfcfc');
      px(0, 0, 1, 1, '#fcfcfc');
    } else {
      px(0, 0, 1, 1, '#fcfcfc');
      px(1, 1, 2, 1, '#fcfcfc');
      px(1, 2, 1, 1, '#fcfcfc');
    }
  },
};

// ── Mono ────────────────────────────────────────────────────────

const MONO_COLORS: Palette = {
  I: '#f5f5f7',
  O: '#dcdce0',
  T: '#bfbfc5',
  S: '#a3a3aa',
  Z: '#86868e',
  J: '#6b6b73',
  L: '#55555c',
  garbage: '#2a2a2e',
};

/** Mono: luminance only, near-square, a single hairline of light. */
const MONO: Skin = {
  id: 'mono',
  name: 'Mono',
  description: 'Luminance only. Continuous, near-square.',
  palette: fixed(MONO_COLORS),
  connected: true,
  bleed: 0,
  ghostAlpha: 1,
  blend: 'normal',
  fxBlend: 'normal',
  particle: 'square',
  flash: '#ffffff',
  sound: 'pure',
  grid: 'lines',
  paint(ctx, size, color, mask, kind) {
    const pad = Math.max(1, Math.round(size * 0.035));
    const s = shape(size, mask, pad, size * 0.06);
    const w = Math.max(1, size * 0.025);
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    shapePath(ctx, s);
    ctx.clip();
    // Brushed aluminium: hairlines run straight through linked cells.
    brushed(ctx, size, KIND_SEED[kind], 0.05);
    mottle(ctx, size, { seed: KIND_SEED[kind] + 5, scale: 2, octaves: 2, light: 0.05, dark: 0.06 });
    edgeBand(ctx, s, 'up', size * 0.1, white, 0.14);
    edgeBand(ctx, s, 'down', size * 0.12, black, 0.16);
    ctx.restore();
    carveNotches(ctx, s);
    strokeBand(ctx, s, 'top', white(0.6), w);
    strokeBand(ctx, s, 'bottom', black(0.3), w);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.03, 0.5, 0.06, 0.06),
};

// ── Aurora ──────────────────────────────────────────────────────

const AURORA_COLORS: Palette = {
  I: '#4ff0ff',
  O: '#ffe680',
  T: '#d38bff',
  S: '#5dffb0',
  Z: '#ff7aa8',
  J: '#6f8cff',
  L: '#ffb36b',
  garbage: '#7d8aa0',
};

/** Aurora: bioluminescent cells, each with a glowing nucleus, inside one soft membrane. */
const AURORA: Skin = {
  id: 'aurora',
  name: 'Aurora',
  description: 'Bioluminescent cells that slowly breathe.',
  palette: fixed(AURORA_COLORS),
  connected: true,
  bleed: 0.3,
  ghostAlpha: 1,
  blend: 'add',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'glass',
  grid: 'dots',
  breathe: true,
  paint(ctx, size, color, mask) {
    const pad = Math.max(1, Math.round(size * 0.06));
    const s = shape(size, mask, pad, size * 0.3);
    ctx.save();
    clipCell(ctx, s, size * 0.3);
    shapePath(ctx, s);
    ctx.fillStyle = rgba(color, 0.2);
    ctx.fill();
    ctx.save();
    shapePath(ctx, s);
    ctx.clip();
    // Light gathers toward the piece's edge, like a membrane, instead of a dot per cell.
    edgeBand(ctx, s, 'up', size * 0.16, (a) => rgba(color, a), 0.45);
    edgeBand(ctx, s, 'down', size * 0.16, (a) => rgba(color, a), 0.45);
    edgeBand(ctx, s, 'left', size * 0.16, (a) => rgba(color, a), 0.45);
    edgeBand(ctx, s, 'right', size * 0.16, (a) => rgba(color, a), 0.45);
    edgeBand(ctx, s, 'up', size * 0.08, white, 0.25);
    ctx.restore();
    carveNotches(ctx, s);
    const w = Math.max(1, size * 0.03);
    const inset = { ...s, x0: s.x0 + w / 2, y0: s.y0 + w / 2, x1: s.x1 - w / 2, y1: s.y1 - w / 2 };
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.3;
    ctx.strokeStyle = rgba(color, 0.8);
    ctx.lineWidth = w;
    shapePath(ctx, inset, size);
    ctx.stroke();
    strokeNotches(ctx, s, w / 2);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.03, 0.55, 0.05, 0.3),
};

// ── Crystal ─────────────────────────────────────────────────────

const CRYSTAL_COLORS: Palette = {
  I: '#5fd8ff',
  O: '#ffd95a',
  T: '#b98cff',
  S: '#5fe8a0',
  Z: '#ff6f86',
  J: '#6d8fff',
  L: '#ffa25f',
  garbage: '#8a8f9c',
};

/** Crystal: dark prismatic glass, internal facets and an iridescent rim. */
const CRYSTAL: Skin = {
  id: 'crystal',
  name: 'Crystal',
  description: 'Prismatic glass with an iridescent rim.',
  palette: fixed(CRYSTAL_COLORS),
  connected: false,
  bleed: 0,
  ghostAlpha: 0.3,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'glass',
  grid: 'lines',
  paint(ctx, size, color) {
    // Dark glass cut as a prism: one clean diagonal split, light pooling in
    // the far corner and an iridescent rim. No busy facets.
    const pad = Math.max(1, Math.round(size * 0.04));
    const s = size - pad * 2;
    const r = s * 0.14;
    ctx.save();
    ctx.translate(pad, pad);
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, r);
    const body = ctx.createLinearGradient(0, 0, s, s);
    body.addColorStop(0, shade(color, -0.25));
    body.addColorStop(0.6, shade(color, -0.55));
    body.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Caustic: refracted light gathers inside the lower right.
    const pool = ctx.createRadialGradient(s * 0.82, s * 0.85, 0, s * 0.82, s * 0.85, s * 0.7);
        pool.addColorStop(0, shade(color, 0.35));
    pool.addColorStop(0.45, color);
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 1;
    // The prism's upper face catches the sky.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.closePath();
    const top = ctx.createLinearGradient(0, 0, s * 0.5, s * 0.5);
    top.addColorStop(0, white(0.3));
    top.addColorStop(1, white(0.04));
    ctx.fillStyle = top;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(0, s);
    ctx.strokeStyle = white(0.4);
    ctx.lineWidth = Math.max(0.75, s * 0.014);
    ctx.stroke();
    ctx.restore();
    const w = Math.max(1.5, s * 0.045);
    ctx.beginPath();
    ctx.roundRect(w / 2, w / 2, s - w, s - w, r);
    // Conic gradients are recent; older engines get a two-tone sweep instead.
    const conic = typeof ctx.createConicGradient === 'function';
    const rim = conic ? ctx.createConicGradient(-Math.PI / 4, s / 2, s / 2) : ctx.createLinearGradient(0, 0, s, s);
    const stops = conic ? [shade(color, 0.3), '#9ffbff', '#ff9cf4', '#fff59c', shade(color, 0.3)] : ['#9ffbff', '#ff9cf4'];
    stops.forEach((c, i) => rim.addColorStop(i / (stops.length - 1), c));
    ctx.strokeStyle = rim;
    ctx.lineWidth = w;
    ctx.stroke();
    // A white specular hairline on the top-left curve.
    ctx.beginPath();
    ctx.moveTo(w, s * 0.55);
    ctx.lineTo(w, r + w / 2);
    ctx.arcTo(w, w, r + w / 2, w, r);
    ctx.lineTo(s * 0.55, w);
    ctx.strokeStyle = white(0.85);
    ctx.lineWidth = Math.max(0.75, w * 0.35);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  },
};

// ── Ember ───────────────────────────────────────────────────────

const EMBER_COLORS: Palette = {
  I: '#56d8ff',
  O: '#ffd23f',
  T: '#c77dff',
  S: '#5ef08a',
  Z: '#ff5b5b',
  J: '#5b8cff',
  L: '#ff9f43',
  garbage: '#6b5f58',
};

/** Ember: molten, glowing cores under a dark crust that follows the piece outline. */
const EMBER: Skin = {
  id: 'ember',
  name: 'Ember',
  description: 'A molten filament inside a dark shell.',
  palette: fixed(EMBER_COLORS),
  connected: true,
  bleed: 0.2,
  ghostAlpha: 1,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#fff2d6',
  sound: 'wood',
  grid: 'lines',
  paint(ctx, size, color, mask) {
    const pad = Math.max(1, Math.round(size * 0.04));
    const shell = shape(size, mask, pad, size * 0.18);
    // The core runs through linked sides, so it is one filament across the piece.
    const body = shade(color, -0.8);
    ctx.save();
    clipCell(ctx, shell, size * 0.2);
    shapePath(ctx, shell);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    shapePath(ctx, shell);
    ctx.clip();
    const filament = (inset: number, fill: string, glow: number) => {
      const core = shape(size, mask, Math.round(size * inset), size * 0.12);
      ctx.save();
      // Keep concave corners out of the core so its inner corners stay clean.
      ctx.beginPath();
      ctx.rect(-size, -size, size * 3, size * 3);
      const cp = core.pad;
      const corners: [number, number][] = [[0, 0], [size - cp, 0], [size - cp, size - cp], [0, size - cp]];
      core.notches.forEach((on, i) => on && ctx.rect(corners[i][0], corners[i][1], cp, cp));
      ctx.clip('evenodd');
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      shapePath(ctx, core);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    };
    filament(0.2, color, size * 0.18);
    filament(0.34, shade(color, 0.55), 0);
    edgeBand(ctx, shell, 'up', size * 0.14, white, 0.08);
    ctx.restore();
    carveNotches(ctx, shell);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.03, 0.5, 0.06, 0.18),
};

// ── Game Boy ────────────────────────────────────────────────────

const DMG = ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'];

/** Game Boy: four shades of green, a different 8×8 pattern per piece. */
const GAMEBOY: Skin = {
  id: 'gameboy',
  name: 'Game Boy',
  description: 'Four greens. A pattern for every piece.',
  palette: fixed({ I: DMG[2], O: DMG[3], T: DMG[1], S: DMG[2], Z: DMG[3], J: DMG[2], L: DMG[3], garbage: DMG[1] }),
  connected: false,
  bleed: 0,
  ghostAlpha: 0.3,
  blend: 'normal',
  fxBlend: 'normal',
  particle: 'square',
  flash: DMG[3],
  sound: 'pure',
  grid: 'none',
  paint(ctx, size, _color, _mask, kind) {
    const edge = (i: number) => Math.round((i * size) / 8);
    const px = (x: number, y: number, w: number, h: number, c: number) => {
      ctx.fillStyle = DMG[c];
      ctx.fillRect(edge(x), edge(y), edge(x + w) - edge(x), edge(y + h) - edge(y));
    };
    px(0, 0, 8, 8, 0);
    switch (kind) {
      case 'I':
        px(1, 1, 6, 6, 1);
        px(1, 2, 6, 1, 2);
        px(1, 5, 6, 1, 2);
        break;
      case 'O':
        px(1, 1, 6, 6, 2);
        px(3, 3, 2, 2, 0);
        break;
      case 'T':
        px(1, 1, 6, 6, 1);
        px(1, 1, 6, 1, 2);
        break;
      case 'S':
        for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) px(x, y, 1, 1, (x + y) % 2 ? 1 : 2);
        break;
      case 'Z':
        px(1, 1, 6, 6, 3);
        px(2, 2, 4, 4, 1);
        break;
      case 'J':
        px(1, 1, 6, 6, 2);
        px(2, 2, 4, 4, 1);
        px(3, 3, 2, 2, 2);
        break;
      case 'L':
        px(1, 1, 6, 6, 3);
        px(1, 1, 1, 1, 2);
        break;
      default:
        px(1, 1, 6, 6, 1);
        px(2, 2, 1, 1, 0);
        px(5, 5, 1, 1, 0);
    }
  },
};

// ── Wire ────────────────────────────────────────────────────────

/** Wire: every block is an isometric wireframe cube. */
const WIRE: Skin = {
  id: 'wire',
  name: 'Wire',
  description: 'Isometric wireframe cubes.',
  palette: fixed(NEON_COLORS),
  connected: false,
  bleed: 0.12,
  ghostAlpha: 0.35,
  blend: 'add',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'pure',
  grid: 'lines',
  paint(ctx, size, color) {
    const pad = Math.max(1, size * 0.07);
    const d = size * 0.18;
    const a = pad + d * 0.2;
    const b = size - pad - d * 0.6;
    const w = Math.max(1, size * 0.03);
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    // Back face, dimmer.
    ctx.strokeStyle = rgba(color, 0.4);
    ctx.strokeRect(a + d, a - d * 0.6, b - a, b - a);
    // Edges joining the faces.
    ctx.beginPath();
    for (const [x, y] of [[a, a], [b, a], [b, b], [a, b]] as const) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + d, y - d * 0.6);
    }
    ctx.stroke();
    // Front face.
    ctx.fillStyle = rgba(color, 0.12);
    ctx.fillRect(a, a, b - a, b - a);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.12;
    ctx.strokeRect(a, a, b - a, b - a);
  },
};

// ── Glass ───────────────────────────────────────────────────────

const GLASS_COLORS: Palette = {
  I: '#5ad2ff',
  O: '#ffd060',
  T: '#b78bff',
  S: '#5fe3a1',
  Z: '#ff6b7f',
  J: '#6a8dff',
  L: '#ffa25c',
  garbage: '#8c919c',
};

/**
 * Glass: thick, dark-tinted liquid glass. Opaque enough to read on any
 * background; the light lives on the rim: a bright specular lip on top,
 * colour refracting along the far edges and a glint on the outer corners.
 */
const GLASS: Skin = {
  id: 'glass',
  name: 'Liquid Glass',
  description: 'Thick tinted glass with a living rim of light.',
  palette: fixed(GLASS_COLORS),
  connected: true,
  bleed: 0,
  ghostAlpha: 1,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'glass',
  grid: 'dots',
  paint(ctx, size, color, mask) {
    const pad = Math.max(1, Math.round(size * 0.05));
    const s = shape(size, mask, pad, size * 0.34);
    const w = Math.max(1, size * 0.03);
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = shade(color, -0.42);
    ctx.fill();
    ctx.save();
    shapePath(ctx, s);
    ctx.clip();
    // Only thin bands that fade along the outline: anything deeper restarts in
    // every cell and shows the seams, and a hard switch between rim styles
    // reads as a cut where the corner meets the side.
    const tint = (a: number) => rgba(color, a);
    edgeBand(ctx, s, 'down', size * 0.14, tint, 0.85);
    edgeBand(ctx, s, 'right', size * 0.1, tint, 0.5);
    edgeBand(ctx, s, 'up', size * 0.12, white, 0.22);
    // Rim light: bright along the top, the colour's own light along the bottom.
    edgeBand(ctx, s, 'up', w * 2.2, white, 0.75);
    edgeBand(ctx, s, 'down', w * 2.2, (a) => rgba(GLASS_TINT[color] ?? '#ffffff', a), 0.8);
    ctx.restore();
    carveNotches(ctx, s);
    // One continuous hairline around the whole piece.
    const inset = { ...s, x0: s.x0 + w / 2, y0: s.y0 + w / 2, x1: s.x1 - w / 2, y1: s.y1 - w / 2 };
    ctx.strokeStyle = white(0.42);
    ctx.lineWidth = w;
    shapePath(ctx, inset, size);
    ctx.stroke();
    strokeNotches(ctx, s, w / 2);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.035, 0.6, 0.1, 0.34),
};

/** A lighter version of each glass colour for the refracted rim. */
const GLASS_TINT: Record<string, string> = Object.fromEntries(
  Object.values(GLASS_COLORS).map((c) => [c, mix(c, '#ffffff', 0.45)]),
);

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (n: number, shift: number) => (n >> shift) & 255;
  const c = [16, 8, 0].map((sh) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ── Brut ────────────────────────────────────────────────────────

const BRUT_COLORS: Palette = {
  I: '#8aa2aa',
  O: '#c9b48a',
  T: '#958aa0',
  S: '#8b9e82',
  Z: '#b07d70',
  J: '#727f97',
  L: '#bb9673',
  garbage: '#4a4a4c',
};

/**
 * Brut: béton brut. Pigmented cast concrete with hard arrises, formwork
 * joints between the cells of a piece, air pits and one tie hole per panel.
 */
const BRUT: Skin = {
  id: 'brut',
  name: 'Brut',
  description: 'Raw cast concrete. Formwork joints and tie holes.',
  palette: fixed(BRUT_COLORS),
  connected: true,
  bleed: 0,
  ghostAlpha: 1,
  blend: 'normal',
  fxBlend: 'normal',
  particle: 'square',
  flash: '#f2efe8',
  sound: 'wood',
  grid: 'lines',
  paint(ctx, size, color, mask, kind) {
    const pad = Math.max(1, Math.round(size * 0.035));
    const s = shape(size, mask, pad, 0);
    const seed = KIND_SEED[kind];
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    shapePath(ctx, s);
    ctx.clip();
    // Cement laitance: blotchy, cloudy, with darker water stains.
    mottle(ctx, size, { seed, scale: 2, light: 0.16, dark: 0.22, contrast: 1.4, darkColor: '#1d1b18' });
    mottle(ctx, size, { seed: seed + 3, scale: 8, octaves: 2, light: 0.1, dark: 0.12 });
    grain(ctx, size, 0.25, 0.1, 0.12);
    pits(ctx, size, seed, Math.round(size / 9), size * 0.018, 0.55);
    // Formwork joints where this panel meets the next one of the same pour.
    const j = Math.max(1, size * 0.018);
    ctx.fillStyle = black(0.2);
    if (mask & RIGHT) ctx.fillRect(size - j, 0, j, size);
    if (mask & DOWN) ctx.fillRect(0, size - j, size, j);
    ctx.fillStyle = white(0.06);
    if (mask & LEFT) ctx.fillRect(0, 0, j, size);
    if (mask & UP) ctx.fillRect(0, 0, size, j);
    // Tie hole: a cone-shaped recess with a lit lower lip.
    const c = size / 2;
    const hr = size * 0.07;
    ctx.beginPath();
    ctx.arc(c, c + hr * 0.25, hr * 1.25, 0, Math.PI * 2);
    ctx.fillStyle = white(0.12);
    ctx.fill();
    const hole = ctx.createRadialGradient(c, c - hr * 0.3, 0, c, c, hr * 1.15);
    hole.addColorStop(0, black(0.75));
    hole.addColorStop(0.7, black(0.45));
    hole.addColorStop(1, black(0));
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(c, c, hr * 1.15, 0, Math.PI * 2);
    ctx.fill();
    // Hard arrises: chipped light on top, heavy shade beneath.
    edgeBand(ctx, s, 'up', size * 0.07, white, 0.2);
    edgeBand(ctx, s, 'left', size * 0.05, white, 0.1);
    edgeBand(ctx, s, 'down', size * 0.16, black, 0.4);
    edgeBand(ctx, s, 'right', size * 0.1, black, 0.25);
    ctx.restore();
    carveNotches(ctx, s);
    const w = Math.max(1, size * 0.02);
    strokeBand(ctx, s, 'top', white(0.3), w);
    strokeBand(ctx, s, 'bottom', black(0.5), w);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.04, 0.5, 0.08, 0),
};

// ── Corten ──────────────────────────────────────────────────────

const CORTEN_COLORS: Palette = {
  I: '#ec8a45',
  O: '#f9d39b',
  T: '#b24d1f',
  S: '#d0662a',
  Z: '#8f3716',
  J: '#6b2a12',
  L: '#f5a83e',
  garbage: '#3b2419',
};

/**
 * Corten: weathering steel in every tone of orange. Heavy plates with rust
 * bloom, rain runoff that runs down through the piece, pitting and a hard,
 * cut edge.
 */
const CORTEN: Skin = {
  id: 'corten',
  name: 'Corten',
  description: 'Weathering steel. Every tone of rust.',
  palette: fixed(CORTEN_COLORS),
  connected: true,
  bleed: 0,
  ghostAlpha: 1,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'square',
  flash: '#ffd9a8',
  sound: 'wood',
  grid: 'lines',
  paint(ctx, size, color, mask, kind) {
    const pad = Math.max(1, Math.round(size * 0.035));
    const s = shape(size, mask, pad, size * 0.03);
    const seed = KIND_SEED[kind];
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.save();
    shapePath(ctx, s);
    ctx.clip();
    // Rust bloom: deep oxide patches and bright, powdery orange.
    mottle(ctx, size, { seed, scale: 2, light: 0.18, dark: 0.26, contrast: 1.5, lightColor: '#ffc078', darkColor: '#3a1406' });
    mottle(ctx, size, { seed: seed + 7, scale: 6, octaves: 3, light: 0.14, dark: 0.18, contrast: 1.3, lightColor: '#ffd8a0', darkColor: '#2a0e04' });
    streaks(ctx, size, seed, 4, '#2a0e04', 0.16);
    streaks(ctx, size, seed + 1, 3, '#ffb060', 0.12);
    grain(ctx, size, 0.3, 0.1, 0.16);
    pits(ctx, size, seed + 2, Math.round(size / 12), size * 0.014, 0.5);
    // Plates are welded where cells meet: a dark seam with a bright bead.
    const j = Math.max(1, size * 0.016);
    ctx.fillStyle = black(0.18);
    if (mask & RIGHT) ctx.fillRect(size - j, 0, j, size);
    if (mask & DOWN) ctx.fillRect(0, size - j, size, j);
    ctx.fillStyle = 'rgba(255,190,120,0.14)';
    if (mask & LEFT) ctx.fillRect(0, 0, j, size);
    if (mask & UP) ctx.fillRect(0, 0, size, j);
    edgeBand(ctx, s, 'up', size * 0.08, (a) => `rgba(255,214,160,${a})`, 0.3);
    edgeBand(ctx, s, 'down', size * 0.18, black, 0.45);
    edgeBand(ctx, s, 'right', size * 0.1, black, 0.22);
    ctx.restore();
    carveNotches(ctx, s);
    const w = Math.max(1, size * 0.022);
    strokeBand(ctx, s, 'top', 'rgba(255,220,170,0.55)', w);
    strokeBand(ctx, s, 'bottom', black(0.55), w);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.04, 0.55, 0.08, 0.03),
};

export const SKINS: Record<SkinId, Skin> = {
  studio: STUDIO,
  clay: CLAY,
  gem: GEM,
  crystal: CRYSTAL,
  neon: NEON,
  aurora: AURORA,
  ember: EMBER,
  bevel: BEVEL,
  wire: WIRE,
  nes: NES,
  gameboy: GAMEBOY,
  mono: MONO,
  glass: GLASS,
  brut: BRUT,
  corten: CORTEN,
};
export const SKIN_ORDER: SkinId[] = [
  'studio',
  'glass',
  'clay',
  'gem',
  'crystal',
  'neon',
  'aurora',
  'ember',
  'brut',
  'corten',
  'bevel',
  'wire',
  'nes',
  'gameboy',
  'mono',
];

export function hexToNumber(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/** Paints one cell into a fresh canvas, including the skin's bleed margin. */
export function paintBlock(skin: Skin, size: number, color: string, kind: BlockKind, mask = 0, ghost = false): HTMLCanvasElement {
  const bleed = Math.ceil(size * skin.bleed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size + bleed * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(bleed, bleed);
  const m = skin.connected ? mask : 0;
  if (ghost && skin.paintGhost) skin.paintGhost(ctx, size, color, m);
  else skin.paint(ctx, size, color, m, kind);
  return canvas;
}

/** The grid actually drawn for a player setting and skin. */
export function resolveGrid(mode: 'auto' | 'lines' | 'dots' | 'off', skin: Skin): GridStyle {
  if (mode === 'off') return 'none';
  return mode === 'auto' ? skin.grid : mode;
}
