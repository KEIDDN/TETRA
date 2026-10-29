import { useEffect, useMemo } from 'react';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { getSettings } from '../lib/settings';
import { SKINS } from '../game/skins';
import { Icon } from './Icon';

/** Winning a cup: the screen goes dark, minos rain in your skin's colours, the trophy rises. Any key goes on. */
export function ChampionCelebration({ cup, onDone }: { cup: string; onDone: () => void }) {
  const colors = useMemo(() => Object.values(SKINS[getSettings().appearance.skin].palette(1)).slice(0, 7), []);
  const minos = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        size: 8 + Math.random() * 16,
        delay: Math.random() * 1.6,
        duration: 2.6 + Math.random() * 2.4,
        spin: (Math.random() - 0.5) * 540,
        color: colors[i % colors.length],
      })),
    [colors],
  );
  useEffect(() => {
    sfx.personalBest();
    music.club?.throw(8, music.bpm);
    const done = () => onDone();
    const t = setTimeout(() => {
      window.addEventListener('keydown', done, { once: true });
      window.addEventListener('pointerdown', done, { once: true });
    }, 900);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', done);
      window.removeEventListener('pointerdown', done);
    };
  }, [onDone]);

  return (
    <div className="animate-fade fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/90 backdrop-blur-md">
      {minos.map((m, i) => (
        <span
          key={i}
          className="champion-mino absolute -top-8 rounded-[22%]"
          style={
            {
              left: `${m.left}%`,
              width: m.size,
              height: m.size,
              background: m.color,
              animationDelay: `${m.delay}s`,
              animationDuration: `${m.duration}s`,
              '--spin': `${m.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="relative text-center">
        <div className="animate-pop mx-auto grid size-28 place-items-center text-accent [filter:drop-shadow(0_0_24px_rgba(237,235,250,0.6))]">
          <Icon name="trophy" size={96} />
        </div>
        <div className="label mt-8">{cup}</div>
        <h1 className="animate-rise mt-4 text-[clamp(64px,10vw,160px)] leading-[0.9] font-[600] tracking-[-0.06em] [animation-delay:200ms]">Champion.</h1>
        <p className="animate-rise mt-8 font-mono text-[11px] tracking-[0.28em] text-white/60 uppercase [animation-delay:900ms]">Press any key</p>
      </div>
    </div>
  );
}
