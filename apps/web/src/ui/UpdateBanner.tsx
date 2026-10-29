import { useEffect, useState } from 'react';
import { desktop, type DesktopUpdate } from '../lib/platform';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** Desktop only: a quiet note when a new version of TETRA is waiting. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<DesktopUpdate | null>(null);
  useEffect(() => desktop?.onUpdate?.(setUpdate), []);
  if (!update) return null;

  return (
    <div className="animate-rise fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="glass-panel flex items-center gap-5 rounded-full py-2 pr-2 pl-6 text-[14px]">
        <span className="whitespace-nowrap">
          <span className="font-medium">TETRA {update.version}</span>
          <span className="text-white/55">{update.state === 'ready' ? ' is ready.' : ' is out.'}</span>
        </span>
        <button
          onClick={() => (update.state === 'ready' ? desktop?.installUpdate?.() : desktop?.openExternal(update.url))}
          className={`glass-light rounded-full px-4 py-1.5 text-[13px] font-semibold ${focusRing}`}
        >
          {update.state === 'ready' ? 'Restart' : 'Download'}
        </button>
        <button onClick={() => setUpdate(null)} aria-label="Later" className={`px-2 text-[13px] text-white/45 transition-colors hover:text-fg ${focusRing}`}>
          Later
        </button>
      </div>
    </div>
  );
}
