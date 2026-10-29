import { linkMasks } from '@tetra/engine';
import { useEffect, useRef } from 'react';
import { paintBlock, SKINS, type SkinId } from '../game/skins';
import { Icon } from './Icon';

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
    const px = Math.round(12 * dpr);
    canvas.width = 3 * px;
    canvas.height = 2 * px;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = skin.blend === 'add' ? 'lighter' : 'source-over';
    const color = skin.palette(1).T;
    const bleed = Math.ceil(px * skin.bleed);
    const masks = linkMasks(T_CELLS);
    T_CELLS.forEach(([x, y], i) => ctx.drawImage(paintBlock(skin, px, color, 'T', masks[i]), x * px - bleed, (1 - y) * px - bleed));
  }, [id]);
  return <canvas ref={ref} className="h-[24px] w-[36px]" aria-hidden />;
}

/**
 * Every skin as a T on a pane of glass; a brighter lens of glass springs to
 * the one you pick.
 */
export function SkinPicker({
  skins,
  value,
  onChange,
  locked,
  onLocked,
}: {
  skins: SkinId[];
  value: SkinId;
  onChange: (id: SkinId) => void;
  /** Skins still to be won: shown dimmed with a lock, and not picked. */
  locked?: (id: SkinId) => boolean;
  onLocked?: (id: SkinId) => void;
}) {
  const index = Math.max(0, skins.indexOf(value));
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="glass-panel relative inline-grid grid-cols-5 rounded-[30px] p-2.5">
        <div
          aria-hidden
          className="pick-lens pointer-events-none absolute top-2.5 left-2.5 h-14 w-[72px] rounded-[20px] transition-transform duration-500 ease-[cubic-bezier(0.34,1.5,0.64,1)]"
          style={{ transform: `translate(${(index % COLS) * 72}px, ${Math.floor(index / COLS) * 56}px)` }}
        />
        {skins.map((id) => {
          const shut = id !== value && !!locked?.(id);
          return (
            <button
              key={id}
              onClick={() => (shut ? onLocked?.(id) : onChange(id))}
              title={shut ? `${SKINS[id].name} · locked` : SKINS[id].name}
              aria-label={shut ? `${SKINS[id].name}, locked` : SKINS[id].name}
              aria-pressed={id === value}
              className={`relative z-10 grid h-14 w-[72px] place-items-center rounded-[20px] outline-none transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.34,1.5,0.64,1)] focus-visible:ring-2 focus-visible:ring-accent/60 ${
                shut
                  ? 'cursor-default'
                  : id === value
                    ? 'scale-110 cursor-pointer opacity-100'
                    : 'cursor-pointer opacity-55 hover:-translate-y-0.5 hover:scale-105 hover:opacity-100'
              }`}
            >
              <span className={shut ? 'opacity-20 grayscale' : ''}>
                <MiniT id={id} />
              </span>
              {shut && (
                <span className="absolute inset-0 grid place-items-center text-white/70">
                  <Icon name="lock" size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
