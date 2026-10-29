import { linkMasks } from '@tetra/engine';
import { useEffect, useRef } from 'react';
import { paintBlock, SKINS, type SkinId } from '../game/skins';

const T_CELLS: [number, number][] = [
  [0, 1],
  [1, 1],
  [2, 1],
  [1, 0],
];
const COLS = 5;

/** One T in a skin, painted with its real painter. */
function MiniT({ id }: { id: SkinId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const skin = SKINS[id];
    const canvas = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(9 * dpr);
    canvas.width = 3 * px;
    canvas.height = 2 * px;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = skin.blend === 'add' ? 'lighter' : 'source-over';
    const color = skin.palette(1).T;
    const bleed = Math.ceil(px * skin.bleed);
    const masks = linkMasks(T_CELLS);
    T_CELLS.forEach(([x, y], i) => ctx.drawImage(paintBlock(skin, px, color, 'T', masks[i]), x * px - bleed, (1 - y) * px - bleed));
  }, [id]);
  return <canvas ref={ref} className="h-[18px] w-[27px]" aria-hidden />;
}

/**
 * Every skin as a T on a pane of glass; a brighter lens of glass springs to
 * the one you pick.
 */
export function SkinPicker({ skins, value, onChange }: { skins: SkinId[]; value: SkinId; onChange: (id: SkinId) => void }) {
  const index = Math.max(0, skins.indexOf(value));
  return (
    <div className="glass-panel relative inline-grid grid-cols-5 rounded-[26px] p-2" onClick={(e) => e.stopPropagation()}>
      <div
        aria-hidden
        className="pick-lens pointer-events-none absolute top-2 left-2 h-11 w-14 rounded-[16px] transition-transform duration-500 ease-[cubic-bezier(0.34,1.5,0.64,1)]"
        style={{ transform: `translate(${(index % COLS) * 56}px, ${Math.floor(index / COLS) * 44}px)` }}
      />
      {skins.map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={SKINS[id].name}
          aria-label={SKINS[id].name}
          aria-pressed={id === value}
          className={`relative z-10 grid h-11 w-14 place-items-center rounded-[16px] outline-none transition-[opacity,transform] duration-300 focus-visible:ring-2 focus-visible:ring-accent/60 ${id === value ? 'scale-110 opacity-100' : 'opacity-55 hover:opacity-90'}`}
        >
          <MiniT id={id} />
        </button>
      ))}
    </div>
  );
}
