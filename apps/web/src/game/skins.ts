import type { PieceType } from '@tetra/engine';

export type BlockKind = PieceType | 'garbage';
export type SkinId = 'default' | 'glass' | 'mono' | 'outline' | 'neon' | 'paper';
export type SoundPackId = 'soft' | 'glass' | 'click' | 'neon' | 'paper';
export type Blend = 'normal' | 'add';

export interface Skin {
  id: SkinId;
  name: string;
  description: string;
  colors: Record<BlockKind, string>;
  /** Extra margin painted around each block (fraction of a cell), for glows. */
  bleed: number;
  /** Paints one block whose top-left corner is at (0,0) and side is `size` (device px). */
  drawBlock(ctx: CanvasRenderingContext2D, size: number, color: string): void;
  /** Ghost painter; defaults to the block at `ghostAlpha`. */
  drawGhost?(ctx: CanvasRenderingContext2D, size: number, color: string): void;
  ghostAlpha: number;
  /** How block sprites blend with what's under them. */
  blend: Blend;
  /** How flashes, trails and particles blend. */
  fxBlend: Blend;
  particle: 'dot' | 'square';
  /** Row-clear flash color. */
  flash: string;
  sound: SoundPackId;
}

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export function hexToNumber(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

const APPLE: Record<BlockKind, string> = {
  I: '#64d2ff',
  O: '#ffd60a',
  T: '#bf5af2',
  S: '#30d158',
  Z: '#ff453a',
  J: '#0a84ff',
  L: '#ff9f0a',
  garbage: '#48484a',
};

function inset(size: number, fraction = 0.035) {
  const pad = Math.max(1, Math.round(size * fraction));
  return { pad, s: size - pad * 2 };
}

function outlineGhost(width: number, alpha: number, radius: number) {
  return (ctx: CanvasRenderingContext2D, size: number, color: string) => {
    const { pad, s } = inset(size, 0.06);
    const w = Math.max(1, size * width);
    ctx.beginPath();
    ctx.roundRect(pad + w / 2, pad + w / 2, s - w, s - w, s * radius);
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = w;
    ctx.stroke();
  };
}

/** Default: flat Apple system colors, soft corners, a faint top sheen. */
const DEFAULT: Skin = {
  id: 'default',
  name: 'Default',
  description: 'Flat system colors, soft corners.',
  colors: APPLE,
  bleed: 0,
  ghostAlpha: 0.2,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'soft',
  drawBlock(ctx, size, color) {
    const { pad, s } = inset(size);
    const r = s * 0.2;
    ctx.save();
    ctx.translate(pad, pad);
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, 0, 0, s);
    sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, s, s);
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, s - 1, s - 1, r);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
};

/** Liquid Glass: tinted translucent bodies, a specular highlight and a bright rim. */
const GLASS: Skin = {
  id: 'glass',
  name: 'Liquid Glass',
  description: 'Translucent, refractive, specular.',
  colors: { ...APPLE, garbage: '#8e8e93' },
  bleed: 0,
  ghostAlpha: 0.35,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'glass',
  drawBlock(ctx, size, color) {
    const { pad, s } = inset(size, 0.04);
    const r = s * 0.26;
    ctx.save();
    ctx.translate(pad, pad);
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, r);
    const body = ctx.createLinearGradient(0, 0, s, s);
    body.addColorStop(0, hexToRgba(color, 0.85));
    body.addColorStop(1, hexToRgba(color, 0.45));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.clip();

    // Light bending through the edges.
    ctx.lineWidth = s * 0.18;
    ctx.strokeStyle = hexToRgba(color, 0.8);
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, r);
    ctx.stroke();

    const spec = ctx.createRadialGradient(s * 0.3, s * 0.2, 0, s * 0.3, s * 0.2, s * 0.62);
    spec.addColorStop(0, 'rgba(255,255,255,0.75)');
    spec.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, s, s);

    const caustic = ctx.createLinearGradient(0, s * 0.7, 0, s);
    caustic.addColorStop(0, 'rgba(255,255,255,0)');
    caustic.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.fillStyle = caustic;
    ctx.fillRect(0, s * 0.7, s, s * 0.3);

    const rim = ctx.createLinearGradient(0, 0, 0, s);
    rim.addColorStop(0, 'rgba(255,255,255,0.85)');
    rim.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    rim.addColorStop(1, 'rgba(255,255,255,0.45)');
    ctx.beginPath();
    ctx.roundRect(0.75, 0.75, s - 1.5, s - 1.5, r);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },
  drawGhost: outlineGhost(0.05, 0.6, 0.26),
};

/** Mono: luminance only, square, brutalist. */
const MONO: Skin = {
  id: 'mono',
  name: 'Mono',
  description: 'Luminance only. No color, no ornament.',
  colors: {
    I: '#ffffff',
    O: '#e3e3e8',
    T: '#c4c4ca',
    S: '#a6a6ad',
    Z: '#88888f',
    J: '#6c6c73',
    L: '#55555b',
    garbage: '#2c2c2e',
  },
  bleed: 0,
  ghostAlpha: 0.18,
  blend: 'normal',
  fxBlend: 'normal',
  particle: 'square',
  flash: '#ffffff',
  sound: 'click',
  drawBlock(ctx, size, color) {
    const { pad, s } = inset(size, 0.03);
    ctx.fillStyle = color;
    ctx.fillRect(pad, pad, s, s);
  },
  drawGhost(ctx, size) {
    const { pad, s } = inset(size, 0.08);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.strokeRect(pad, pad, s, s);
  },
};

/** Outline: technical drawing. Hairline strokes over a whisper of fill. */
const OUTLINE: Skin = {
  id: 'outline',
  name: 'Outline',
  description: 'A technical drawing. Strokes only.',
  colors: APPLE,
  bleed: 0,
  ghostAlpha: 0.3,
  blend: 'normal',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'click',
  drawBlock(ctx, size, color) {
    const { pad, s } = inset(size, 0.08);
    const w = Math.max(1.5, size * 0.055);
    ctx.beginPath();
    ctx.roundRect(pad + w / 2, pad + w / 2, s - w, s - w, s * 0.16);
    ctx.fillStyle = hexToRgba(color, 0.16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  },
  drawGhost: outlineGhost(0.03, 0.5, 0.16),
};

/** Neon: tubes of light with a bloom that adds up where blocks meet. */
const NEON: Skin = {
  id: 'neon',
  name: 'Neon',
  description: 'Blocks of light. A nod to Tetris Effect.',
  colors: { ...APPLE, I: '#5ce1ff', J: '#3d7bff', garbage: '#6e6e73' },
  bleed: 0.35,
  ghostAlpha: 0.28,
  blend: 'add',
  fxBlend: 'add',
  particle: 'dot',
  flash: '#ffffff',
  sound: 'neon',
  drawBlock(ctx, size, color) {
    const { pad, s } = inset(size, 0.1);
    const r = s * 0.18;
    const w = Math.max(1.5, size * 0.07);
    ctx.save();
    ctx.translate(pad, pad);
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.4;
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, r);
    ctx.fillStyle = hexToRgba(color, 0.16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(w * 0.5, w * 0.5, s - w, s - w, r);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.stroke();
    ctx.restore();
  },
  drawGhost: outlineGhost(0.04, 0.55, 0.18),
};

/** Paper: matte pastels with a fine grain. */
const PAPER: Skin = {
  id: 'paper',
  name: 'Paper',
  description: 'Matte pastels with a fine grain.',
  colors: {
    I: '#a6dcef',
    O: '#f4e2a1',
    T: '#cfb6e8',
    S: '#b3dfae',
    Z: '#f1b5ad',
    J: '#a8bfee',
    L: '#f4c79e',
    garbage: '#5a5a5e',
  },
  bleed: 0,
  ghostAlpha: 0.22,
  blend: 'normal',
  fxBlend: 'normal',
  particle: 'square',
  flash: '#fffaf0',
  sound: 'paper',
  drawBlock(ctx, size, color) {
    const { pad, s } = inset(size, 0.045);
    const r = s * 0.12;
    ctx.save();
    ctx.translate(pad, pad);
    ctx.beginPath();
    ctx.roundRect(0, 0, s, s, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.clip();
    const light = ctx.createLinearGradient(0, 0, s, s);
    light.addColorStop(0, 'rgba(255,255,255,0.22)');
    light.addColorStop(1, 'rgba(60,40,20,0.16)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, s, s);
    // Deterministic grain so every texture build looks the same.
    let seed = 1337;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const dots = Math.round(s * s * 0.08);
    for (let i = 0; i < dots; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(rand() * s, rand() * s, 1, 1);
    }
    ctx.restore();
  },
};

export const SKINS: Record<SkinId, Skin> = {
  default: DEFAULT,
  glass: GLASS,
  mono: MONO,
  outline: OUTLINE,
  neon: NEON,
  paper: PAPER,
};

export const SKIN_ORDER: SkinId[] = ['default', 'glass', 'mono', 'outline', 'neon', 'paper'];

/** Paints a block into a fresh canvas, including the skin's bleed margin. */
export function paintBlock(skin: Skin, size: number, color: string, ghost = false): HTMLCanvasElement {
  const bleed = Math.ceil(size * skin.bleed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size + bleed * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(bleed, bleed);
  if (ghost && skin.drawGhost) skin.drawGhost(ctx, size, color);
  else skin.drawBlock(ctx, size, color);
  return canvas;
}
