import { linkMasks } from '@tetra/engine';
import { useEffect, useRef } from 'react';
import { paintBlock, type BlockKind, type Skin } from '../game/skins';

/** A small built stack: every piece type the eye needs to judge a skin. */
const PREVIEW: { kind: BlockKind; cells: [number, number][] }[] = [
  { kind: 'J', cells: [[0, 1], [0, 0], [1, 0], [2, 0]] },
  { kind: 'T', cells: [[3, 0], [4, 0], [5, 0], [4, 1]] },
  { kind: 'O', cells: [[6, 0], [7, 0], [6, 1], [7, 1]] },
  { kind: 'L', cells: [[8, 0], [9, 0], [9, 1], [9, 2]] },
  { kind: 'S', cells: [[1, 2], [2, 2], [2, 1], [3, 1]] },
  { kind: 'I', cells: [[4, 2], [5, 2], [6, 2], [7, 2]] },
];

/** The skin painted with its real block painter, so the swatch is exactly what you play with. */
export function SkinSwatch({ skin, cell = 15, className }: { skin: Skin; cell?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(cell * dpr);
    canvas.width = 10 * px;
    canvas.height = 3 * px;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = skin.blend === 'add' ? 'lighter' : 'source-over';
    const palette = skin.palette(1);
    const bleed = Math.ceil(px * skin.bleed);
    for (const { kind, cells } of PREVIEW) {
      const masks = linkMasks(cells);
      cells.forEach(([x, y], i) => ctx.drawImage(paintBlock(skin, px, palette[kind], kind, masks[i]), x * px - bleed, (2 - y) * px - bleed));
    }
  }, [skin, cell]);
  return <canvas ref={ref} style={{ width: cell * 10, height: cell * 3 }} className={className} />;
}
