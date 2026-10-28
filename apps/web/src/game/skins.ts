import type { PieceType } from '@tetra/engine';
import {
  black,
  carveNotches,
  clipCell,
  edgeBand,
  grain,
  rgba,
  shade,
  shape,
  shapePath,
  strokeBand,
  strokeNotches,
  white,
} from './paint';

export type BlockKind = PieceType | 'garbage';
export type SkinId = 'studio' | 'clay' | 'gem' | 'neon' | 'bevel' | 'nes' | 'mono';
export type SoundPackId = 'studio' | 'glass' | 'wood' | 'pure';
export type Blend = 'normal' | 'add';
export type Palette = Record<BlockKind, string>;

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
  /** Draw the board grid with this skin (pixel skins look better without). */
  grid: boolean;
}

const fixed = (palette: Palette) => () => palette;

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
  grid: true,
  paint(ctx, size, color, mask) {
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
  grid: true,
  paint(ctx, size, color, mask) {
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
    grain(ctx, size, 0.06, 0.08, 0.05);
    ctx.restore();
    carveNotches(ctx, s);
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
  grid: true,
  paint(ctx, size, color) {
    const pad = Math.max(1, Math.round(size * 0.035));
    const s = size - pad * 2;
    const b = s * 0.22;
    ctx.save();
    ctx.translate(pad, pad);
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, s * 0.1);
    ctx.clip();
    const facet = (points: [number, number][], fill: string) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    facet([[0, 0], [s, 0], [s - b, b], [b, b]], shade(color, 0.5));
    facet([[0, 0], [b, b], [b, s - b], [0, s]], shade(color, 0.22));
    facet([[s, 0], [s, s], [s - b, s - b], [s - b, b]], shade(color, -0.25));
    facet([[0, s], [b, s - b], [s - b, s - b], [s, s]], shade(color, -0.48));
    const table = ctx.createLinearGradient(0, b, 0, s - b);
    table.addColorStop(0, shade(color, 0.28));
    table.addColorStop(0.55, color);
    table.addColorStop(1, shade(color, -0.12));
    ctx.fillStyle = table;
    ctx.fillRect(b, b, s - 2 * b, s - 2 * b);
    // Facet edges catch the light.
    ctx.strokeStyle = white(0.28);
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.strokeRect(b, b, s - 2 * b, s - 2 * b);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(b, b);
    ctx.moveTo(s, 0);
    ctx.lineTo(s - b, b);
    ctx.strokeStyle = white(0.35);
    ctx.stroke();
    const glint = ctx.createRadialGradient(b + s * 0.14, b + s * 0.12, 0, b + s * 0.14, b + s * 0.12, s * 0.16);
    glint.addColorStop(0, white(0.95));
    glint.addColorStop(0.4, white(0.35));
    glint.addColorStop(1, white(0));
    ctx.fillStyle = glint;
    ctx.fillRect(0, 0, s, s);
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
  description: 'One glowing outline per piece. A nod to Tetris Effect.',
  palette: fixed(NEON_COLORS),
  connected: true,
  bleed: 0.4,
  ghostAlpha: 1,
  blend: 'add',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'glass',
  grid: true,
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
  grid: true,
  paint(ctx, size, color) {
    const s = size;
    const b = Math.max(2, s * 0.13);
    const facet = (points: [number, number][], fill: string) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    const face = ctx.createLinearGradient(0, 0, 0, s);
    face.addColorStop(0, shade(color, 0.08));
    face.addColorStop(1, shade(color, -0.06));
    ctx.fillStyle = face;
    ctx.fillRect(0, 0, s, s);
    facet([[0, 0], [s, 0], [s - b, b], [b, b]], shade(color, 0.36));
    facet([[0, 0], [b, b], [b, s - b], [0, s]], shade(color, 0.16));
    facet([[s, 0], [s, s], [s - b, s - b], [s - b, b]], shade(color, -0.2));
    facet([[0, s], [b, s - b], [s - b, s - b], [s, s]], shade(color, -0.36));
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
  grid: false,
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
  grid: true,
  paint(ctx, size, color, mask) {
    const pad = Math.max(1, Math.round(size * 0.035));
    const s = shape(size, mask, pad, size * 0.06);
    const w = Math.max(1, size * 0.025);
    ctx.save();
    clipCell(ctx, s, 0);
    shapePath(ctx, s);
    ctx.fillStyle = color;
    ctx.fill();
    carveNotches(ctx, s);
    strokeBand(ctx, s, 'top', white(0.55), w);
    ctx.restore();
  },
  paintGhost: connectedGhost(0.03, 0.5, 0.06, 0.06),
};

export const SKINS: Record<SkinId, Skin> = { studio: STUDIO, clay: CLAY, gem: GEM, neon: NEON, bevel: BEVEL, nes: NES, mono: MONO };
export const SKIN_ORDER: SkinId[] = ['studio', 'clay', 'gem', 'neon', 'bevel', 'nes', 'mono'];

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
