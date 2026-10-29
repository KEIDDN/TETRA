import { useEffect, useRef, useState, type ReactNode } from 'react';
import { music } from '../audio/music';
import { useMenuNav } from '../lib/nav';
import type { ExperienceScene } from '../ui/experience/ExperienceScene';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** The story in a few beats: each section is one idea, a title and a short paragraph. */
const SECTIONS: { kicker: string; title: string; body: string }[] = [
  {
    kicker: 'The idea',
    title: 'A forty-year-old game, played like an instrument.',
    body: 'The falling-block game is close to perfect. Most places to play it today are not: cluttered, noisy, unconsidered. We wanted a version made with the care of a premium product, where the music is not a soundtrack but half of the game.',
  },
  {
    kicker: 'The studio',
    title: 'OXIA Labs. Independent creative technology.',
    body: 'We are an independent studio that designs and builds software where engineering meets feel: apps, tools and experiences. Small team, high standards, no shortcuts. Every pixel, every sound and every frame is deliberate.',
  },
  {
    kicker: 'Independent',
    title: 'Built out of love. Nothing else.',
    body: 'TETRA is independent. No ads, no store, no tricks. We built it because we love this game and the music that keeps a room moving until sunrise, and because we wanted somewhere beautiful to play both.',
  },
];

/** Why TETRA exists, who OXIA Labs is, and who leads it. */
export function Oxia({ onBack, onExperience }: { onBack: () => void; onExperience: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useMenuNav(onBack, true);

  useEffect(() => {
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
      cancelAnimationFrame(raf);
      scene?.dispose();
    };
  }, []);

  return (
    <div ref={scroller} className="fixed inset-0 overflow-y-auto bg-black text-fg">
      <div ref={stage} className="fixed inset-0" aria-hidden />
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.65)_50%,rgba(0,0,0,0.1)_82%)]" />

      <header className="fixed inset-x-0 top-0 z-20 flex h-20 items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-8 sm:px-12">
        <span className="font-mono text-[11px] font-medium tracking-[0.24em] uppercase">
          TETRA <span className="text-white/40">· Why TETRA</span>
        </span>
        <button data-nav onClick={onBack} className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}>
          Close
        </button>
      </header>

      <main className="relative z-10 mx-auto max-w-[1320px] px-8 sm:px-12 lg:pl-[8vw]">
        {/* Hero */}
        <section className="flex min-h-screen flex-col justify-center pt-20">
          <Reveal root={scroller}>
            <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Why TETRA</span>
          </Reveal>
          <Reveal root={scroller} delay={100}>
            <h1 className="mt-6 max-w-[11ch] text-[clamp(52px,7vw,124px)] leading-[1.03] font-[560] tracking-[-0.055em]">We wanted to feel the blocks.</h1>
          </Reveal>
          <Reveal root={scroller} delay={300}>
            <p className="mt-10 max-w-[40ch] text-[clamp(17px,1.35vw,21px)] leading-relaxed text-white/60">
              So we built TETRA: sound, light and play designed as one thing. This is why, and who we are.
            </p>
          </Reveal>
          <Reveal root={scroller} delay={500}>
            <p className="exp-blink mt-16 font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">Scroll</p>
          </Reveal>
        </section>

        {SECTIONS.map((s, i) => (
          <section key={s.kicker} className="flex min-h-[80vh] flex-col justify-center py-16">
            <Reveal root={scroller}>
              <div className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] uppercase">
                <span className="text-white/35">{String(i + 1).padStart(2, '0')}</span>
                <span className="h-px w-10 bg-white/30" />
                <span className="text-white/70">{s.kicker}</span>
              </div>
            </Reveal>
            <Reveal root={scroller} delay={100}>
              <h2 className="mt-6 max-w-[16ch] text-[clamp(38px,4.6vw,80px)] leading-[1.05] font-[560] tracking-[-0.045em]">{s.title}</h2>
            </Reveal>
            <Reveal root={scroller} delay={240}>
              <p className="mt-8 max-w-[46ch] text-[clamp(16px,1.25vw,20px)] leading-relaxed text-white/55">{s.body}</p>
            </Reveal>
          </section>
        ))}

        {/* The person behind it, and the way in. */}
        <section className="flex min-h-[90vh] flex-col justify-center pt-16 pb-28">
          <Reveal root={scroller}>
            <div className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Designed and directed by</div>
          </Reveal>
          <Reveal root={scroller} delay={100}>
            <div className="mt-6 text-[clamp(44px,5.6vw,96px)] leading-[1.03] font-[560] tracking-[-0.05em]">Miki Herrero</div>
          </Reveal>
          <Reveal root={scroller} delay={200}>
            <div className="mt-3 text-[clamp(16px,1.3vw,20px)] text-white/50">CEO &amp; Lead Designer, OXIA Labs</div>
          </Reveal>
          <Reveal root={scroller} delay={360}>
            <div className="mt-16 flex flex-wrap items-center gap-10">
              <button data-nav onClick={onExperience} className={`group inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] text-white/85 uppercase ${focusRing}`}>
                <span className="border-b border-white/30 pb-1 transition-colors group-hover:border-white">Take the Experience</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </button>
              <button data-nav onClick={onBack} className={`group inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase ${focusRing}`}>
                <span className="border-b border-white/15 pb-1 transition-colors group-hover:border-white/60">Play TETRA</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </button>
            </div>
          </Reveal>
        </section>
      </main>
    </div>
  );
}

/** Rises in once it scrolls into view, and stays. */
function Reveal({ root, delay = 0, children }: { root: React.RefObject<HTMLDivElement | null>; delay?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { root: root.current, threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);
  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform,filter] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${shown ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[6px]'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
