import { useEffect, useState } from 'react';
import type { Track } from '../audio/catalog';
import { music } from '../audio/music';

/** "♪ Title — Artist" in a corner for a few seconds when a game starts or the track changes. */
export function NowPlaying() {
  const [shown, setShown] = useState<{ track: Track; key: number } | null>(null);
  useEffect(() => {
    let timer = 0;
    const show = (track: Track | null) => {
      clearTimeout(timer);
      if (!track) return setShown(null);
      setShown({ track, key: Date.now() });
      timer = window.setTimeout(() => setShown(null), 3400);
    };
    // A beat after the countdown starts, so it doesn't fight the "3, 2, 1".
    const first = window.setTimeout(() => show(music.current), 600);
    const off = music.subscribe(show);
    return () => {
      off();
      clearTimeout(first);
      clearTimeout(timer);
    };
  }, []);
  if (!shown) return null;
  return (
    <div key={shown.key} className="now-playing glass-panel pointer-events-none fixed bottom-6 left-6 z-30 flex items-center gap-3 rounded-full px-4 py-2">
      <span className="now-playing-bars" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="text-[13px] font-medium tracking-[-0.01em]">{shown.track.title}</span>
      <span className="text-[13px] text-faint">{shown.track.artist}</span>
    </div>
  );
}
