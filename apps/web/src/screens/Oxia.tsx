import { useEffect, useRef, useState, type ReactNode } from 'react';
import { music } from '../audio/music';
import { useMenuNav } from '../lib/nav';
import { Icon } from '../ui/Icon';
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
        <button data-nav onClick={onBack} className={`glass rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`}>
          <span className="flex items-center gap-2">
            <Icon name="close" size={10} /> Close <span className="font-mono text-[11px] text-white/40">Esc</span>
          </span>
        </button>
      </header>

      <main className="relative z-10 mx-auto flex min-h-full max-w-[1320px] flex-col justify-center px-8 pt-28 pb-16 sm:px-12 lg:pl-[8vw]">
        <Rise show={shown} delay={0}>
          <span className="label">Why TETRA</span>
        </Rise>
        <h1 className="mt-6 max-w-[900px] text-[clamp(48px,6.6vw,112px)] leading-[0.94] font-[560] tracking-[-0.05em]">
          <Rise show={shown} delay={80}>
            We wanted to
          </Rise>
          <Rise show={shown} delay={160}>
            feel the blocks.
          </Rise>
        </h1>

        <div className="mt-12 grid max-w-[880px] gap-x-12 gap-y-6 text-[clamp(16px,1.2vw,18px)] leading-relaxed text-white/65 md:grid-cols-2">
          <Rise show={shown} delay={300}>
            <p>
              The falling-block game has been played for forty years. Somewhere along the way it turned into a spreadsheet: pieces per second,
              finesse, frames. We love that side of it. But we also remember nights when the music and the stack moved as one, and nothing else
              existed.
            </p>
          </Rise>
          <Rise show={shown} delay={380}>
            <p>
              TETRA is our answer: a precise, competitive game that is also a room you walk into. Sound, light and play, designed as one thing. That
              is the Experience, and it is how we play. When you are here to train, Focus is one switch away.
            </p>
          </Rise>
        </div>

        <Rise show={shown} delay={480}>
          <div className="mt-14 flex max-w-[880px] flex-wrap items-center gap-6">
            <div className="glass flex items-center gap-5 rounded-[28px] py-4 pr-8 pl-4">
              <span className="grid size-14 place-items-center rounded-full bg-fg text-[18px] font-semibold tracking-[-0.02em] text-black">MH</span>
              <span>
                <span className="block text-[18px] font-[560] tracking-[-0.02em]">Miki Herrero</span>
                <span className="mt-0.5 block text-[13px] text-muted">CEO &amp; Lead Designer, OXIA Labs</span>
              </span>
            </div>
            <p className="max-w-[340px] text-[14px] leading-relaxed text-faint">
              OXIA Labs is a creative technology studio. We build apps, tools and experiences where engineering meets feel.
            </p>
          </div>
        </Rise>

        <Rise show={shown} delay={600}>
          <button data-nav onClick={onExperience} className={`glass-light mt-12 rounded-full px-6 py-3 text-[15px] font-semibold ${focusRing}`}>
            Take the Experience →
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
