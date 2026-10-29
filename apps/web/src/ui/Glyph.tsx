import { useInputDevice, type InputDevice } from '../lib/inputDevice';

export type GlyphKind = 'confirm' | 'back' | 'pause' | 'retry' | 'vertical' | 'horizontal';

const KEYS: Record<GlyphKind, string> = { confirm: '↵', back: 'Esc', pause: 'Esc', retry: 'R', vertical: '↑↓', horizontal: '←→' };
const FACE: Record<Exclude<InputDevice, 'keyboard'>, Partial<Record<GlyphKind, string>>> = {
  xbox: { confirm: 'A', back: 'B', pause: '☰', retry: '⧉' },
  playstation: { confirm: '✕', back: '○', pause: 'Options', retry: 'Create' },
};

/**
 * The key or button for an action, drawn for whatever the player is using:
 * keys on a keyboard, Xbox buttons for most controllers, PlayStation shapes on a DualSense.
 */
export function Glyph({ k, className = '' }: { k: GlyphKind; className?: string }) {
  const device = useInputDevice();
  if (device === 'keyboard') return <span className={`font-mono text-[11px] ${className}`}>{KEYS[k]}</span>;
  if (k === 'vertical' || k === 'horizontal') return <DPad axis={k} className={className} />;
  const label = FACE[device][k]!;
  const round = label.length === 1;
  return (
    <span
      className={`inline-grid h-[18px] place-items-center rounded-full align-middle text-[10px] leading-none font-semibold shadow-[inset_0_0_0_1.2px_currentColor] ${
        round ? 'w-[18px]' : 'px-1.5'
      } ${className}`}
    >
      {label}
    </span>
  );
}

/** A d-pad with the arms in use lit. */
function DPad({ axis, className }: { axis: 'vertical' | 'horizontal'; className: string }) {
  const lit = (on: boolean) => (on ? 'currentColor' : 'none');
  const v = axis === 'vertical';
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className={`inline-block align-middle ${className}`} aria-hidden>
      <g stroke="currentColor" strokeWidth="1.1">
        <rect x="5.5" y="0.8" width="5" height="5" rx="1" fill={lit(v)} />
        <rect x="5.5" y="10.2" width="5" height="5" rx="1" fill={lit(v)} />
        <rect x="0.8" y="5.5" width="5" height="5" rx="1" fill={lit(!v)} />
        <rect x="10.2" y="5.5" width="5" height="5" rx="1" fill={lit(!v)} />
      </g>
    </svg>
  );
}
