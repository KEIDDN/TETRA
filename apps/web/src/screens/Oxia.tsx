import { useEffect, useRef, useState, type ReactNode } from 'react';
import { music } from '../audio/music';
import { useMenuNav } from '../lib/nav';
import type { ExperienceScene } from '../ui/experience/ExperienceScene';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** Why TETRA exists, who OXIA Labs is, and who leads it. */
export function Oxia({ onBack, onExperience }: { onBack: () => void; onExperience: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useMenuNav(onBack, true);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 60);
    let disposed = false;
    let scene: ExperienceScene | null = null;
    void import('../ui/experience/ExperienceScene').then(({ ExperienceScene }) => {
      if (disposed || !stage.current) return;
      scene = new ExperienceScene(stage.current);
      scene.formation = 'mark';
    });
    let raf = 0;
    const tick = () => {
      if (scene) scene.bands = music.analyse();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      clearTimeout(t);
      cancelAnimationFrame(raf);
      scene?.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-fg">
      <div ref={stage} className="fixed inset-0" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.6)_48%,rgba(0,0,0,0.1)_80%)]"
      />

      <header className="fixed inset-x-0 top-0 z-20 flex h-20 items-center justify-between px-8 sm:px-12">
        <span className="font-mono text-[11px] font-medium tracking-[0.2em] uppercase">
          TETRA <span className="text-white/40">/ Why TETRA</span>
        </span>
        <button data-nav onClick={onBack} className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}>
          Close
        </button>
      </header>

      <main className="relative z-10 mx-auto flex min-h-full max-w-[1320px] flex-col justify-center px-8 pt-28 pb-16 sm:px-12 lg:pl-[8vw]">
        <Rise show={shown} delay={0}>
          <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Why TETRA</span>
        </Rise>
        <h1 className="mt-6 max-w-[11ch] text-[clamp(48px,6.6vw,112px)] leading-[1.04] font-[560] tracking-[-0.05em]">
          <Rise show={shown} delay={80}>
            We wanted to feel the blocks.
          </Rise>
        </h1>
        <Rise show={shown} delay={320}>
          <p className="mt-10 max-w-[44ch] text-[clamp(17px,1.35vw,21px)] leading-relaxed text-white/60">
            The falling-block game is forty years old, and most places to play it still feel rough. We wanted it made with care, with music at its
            heart: sound, light and play as one thing.
          </p>
        </Rise>
        <Rise show={shown} delay={440}>
          <p className="mt-5 max-w-[44ch] text-[clamp(15px,1.1vw,17px)] leading-relaxed text-white/40">That is the Experience. For training days, Focus is one switch away.</p>
        </Rise>
        <Rise show={shown} delay={560}>
          <p className="mt-14 text-[15px]">
            Miki Herrero <span className="text-white/40">— CEO &amp; Lead Designer, OXIA Labs</span>
          </p>
        </Rise>
        <Rise show={shown} delay={680}>
          <button
            data-nav
            onClick={onExperience}
            className={`group mt-10 inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] text-white/80 uppercase ${focusRing}`}
          >
            <span className="border-b border-white/30 pb-1 transition-colors group-hover:border-white">Take the Experience</span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
        </Rise>
      </main>
    </div>
  );
}

function Rise({ show, delay, children }: { show: boolean; delay: number; children: ReactNode }) {
  return (
    <div
      className={`transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${show ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
