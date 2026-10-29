import { useEffect, useState } from 'react';
import { updateSettings, useSettings } from '../lib/settings';
import { toast } from './toast';

/** Always says when developer mode is on; tapping it offers the way out. */
export function DevBadge() {
  const { developer } = useSettings();
  const viaUrl = new URLSearchParams(location.search).has('dev');
  const [asking, setAsking] = useState(false);
  // Menus scroll inside their own containers; step aside once the page moves so the badge never covers content.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el && typeof el.scrollTop === 'number') setScrolled(el.scrollTop > 24);
    };
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);
  if (!developer && !viaUrl) return null;
  const leave = () => {
    setAsking(false);
    updateSettings((s) => ({ ...s, developer: false }));
    if (viaUrl) {
      const url = new URL(location.href);
      url.searchParams.delete('dev');
      history.replaceState(null, '', url);
    }
    toast('Developer mode off');
  };
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 flex h-[min(96px,12vh)] items-center justify-center transition-[opacity,transform] duration-300 ${
        scrolled && !asking ? '-translate-y-3 opacity-0' : ''
      }`}
    >
      <div className={`relative ${scrolled && !asking ? '' : 'pointer-events-auto'}`}>
        <button
          onClick={() => setAsking((a) => !a)}
          className="hairline flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-md transition-colors hover:bg-white/[0.06]"
          title="Developer mode: everything is unlocked"
        >
          <span className="size-1.5 rounded-full bg-[#ffb340] shadow-[0_0_8px_#ffb340]" />
          <span className="font-mono text-[10px] font-medium tracking-[0.18em] text-[#ffb340]">DEV</span>
        </button>
        {asking && (
          <div className="animate-pop hairline absolute top-full left-1/2 mt-2 w-[240px] -translate-x-1/2 rounded-[20px] bg-[#111113] p-4 text-center shadow-2xl">
            <p className="text-[13px] leading-snug text-muted">Everything is unlocked for you. Leave developer mode?</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setAsking(false)} className="hairline flex-1 rounded-full bg-tile py-2 text-[13px] font-medium">
                Keep
              </button>
              <button onClick={leave} className="flex-1 rounded-full bg-accent py-2 text-[13px] font-semibold text-black">
                Leave
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
