import type { PieceType } from '@tetra/engine';

export type BlockKind = PieceType | 'garbage';

export interface Skin {
  id: string;
  name: string;
  colors: Record<BlockKind, string>;
  /** Paints one block filling a `size`×`size` canvas (device pixels). */
  drawBlock(ctx: CanvasRenderingContext2D, size: number, color: string): void;
  /** Opacity of the ghost piece. */
  ghostAlpha: number;
}

/** Default: flat Apple system colors, soft corners, a faint top sheen. */
export const DEFAULT_SKIN: Skin = {
  id: 'default',
  name: 'Default',
  colors: {
    I: '#64d2ff',
    O: '#ffd60a',
    T: '#bf5af2',
    S: '#30d158',
    Z: '#ff453a',
    J: '#0a84ff',
    L: '#ff9f0a',
    garbage: '#48484a',
  },
  ghostAlpha: 0.2,
  drawBlock(ctx, size, color) {
    const inset = Math.max(1, Math.round(size * 0.035));
    const s = size - inset * 2;
    const r = s * 0.2;
    ctx.save();
    ctx.translate(inset, inset);

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
