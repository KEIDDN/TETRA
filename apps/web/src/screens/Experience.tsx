import { useEffect, useRef, useState, type ReactNode } from 'react';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { useMenuNav } from '../lib/nav';
import { updateSettings, useSettings } from '../lib/settings';
import { save } from '../lib/storage';
import type { ExperienceScene } from '../ui/experience/ExperienceScene';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
/** Lit pieces in monochrome: pure white and a few greys, the brutalist way. */
const PALETTE = ['#ffffff', '#d9d9de', '#9a9aa2', '#f4f4f6', '#5e5e66', '#c4c4cc'];

interface Chapter {
  kicker: string;
  title: string[];
  body: ReactNode;
  facts?: [string, string][];
}

const CHAPTERS: Chapter[] = [
  {
    kicker: 'Origin',
    title: ['Born from', 'two obsessions.'],
    body: (
      <>
        Falling blocks, and the music that keeps a room moving until sunrise. They speak the same language: tension, release, the moment everything
        locks into place. TETRA is where they finally meet.
      </>
    ),
  },
  {
    kicker: 'Play',
    title: ['Precise to', 'the millisecond.'],
    body: <>A competitive engine with modern rotation, handling you tune to the frame, and opponents that play like people, not machines.</>,
    facts: [
      ['SRS+', 'Rotation'],
      ['120', 'FPS'],
      ['10', 'Human-like bots'],
    ],
  },
  {
    kicker: 'Sound',
    title: ['A club in', 'your headphones.'],
    body: (
      <>
        Hypnotic techno, mastered for a concrete room you can feel. On headphones the sound surrounds you, speakers ahead and the room behind. The sub
        sits in your chest, not in your ears.
      </>
    ),
    facts: [
      ['Binaural', 'On headphones'],
      ['Club', 'Master chain'],
      ['−14', 'LUFS, every track'],
    ],
  },
  {
    kicker: 'Light',
    title: ['Light that', 'listens.'],
    body: (
      <>
        Every skin is its own room of light. It follows the kick, counts the bars and opens up when the track drops, while the board stays perfectly
        still, so you never lose a piece.
      </>
    ),
    facts: [
      ['12', 'Rooms'],
      ['Kick', 'Bar, phrase, drop'],
      ['0', 'Board movement'],
    ],
  },
  {
    kicker: 'Flow',
    title: ['You play', 'inside it.'],
    body: (
      <>
        Stack too high and the music sinks under water. Chain a combo and it opens up. Land a quad and the room throws it back at you. You don't play
        over the music. You disappear into it.
      </>
    ),
  },
];

const TOTAL = CHAPTERS.length + 2;

/**
 * The TETRA Experience: what it is and who makes it. Shown once at first
 * launch (ending with "headphones or speakers?") and always reachable from
 * the home screen and Settings.
 */
export function Experience({ onDone, firstRun = false }: { onDone: () => void; firstRun?: boolean }) {
  const { audio } = useSettings();
  const [active, setActive] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExperienceScene | null>(null);
  useMenuNav(firstRun ? undefined : onDone, true);
  useEffect(() => sfx.unlock(), []);

  // The 3D stage loads on its own (Three.js only ships with this page).
  useEffect(() => {
    let disposed = false;
    void import('../ui/experience/ExperienceScene').then(({ ExperienceScene }) => {
      if (disposed || !stage.current) return;
      sceneRef.current = new ExperienceScene(stage.current, PALETTE);
    });
    let raf = 0;
    const tick = () => {
      const el = scroller.current;
      const scene = sceneRef.current;
      if (el && scene) {
        scene.progress = el.scrollTop / el.clientHeight;
        scene.bands = music.analyse();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = scroller.current!;
    const onScroll = () => setActive(Math.round(root.scrollTop / root.clientHeight));
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  const finish = (output?: 'headphones' | 'speakers') => {
    if (output) updateSettings((s) => ({ ...s, experience: true, audio: { ...s.audio, output } }));
    save('onboarded', true);
    sfx.ui('select');
    onDone();
  };
  const next = () => scroller.current?.scrollBy({ top: scroller.current.clientHeight, behavior: 'smooth' });

  return (
    <div className="exp fixed inset-0 bg-black text-fg">
      <div ref={stage} className="absolute inset-0" aria-hidden />
      {/* Readability: dark on the text side, the 3D breathing on the other. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.45)_45%,rgba(0,0,0,0)_75%)]" />
      <Grid />

      <header className="absolute inset-x-0 top-0 z-20 grid h-20 grid-cols-[1fr_auto_1fr] items-center border-b border-white/10 px-6 sm:px-10">
        <span className="font-mono text-[11px] font-medium tracking-[0.2em] uppercase">
          TETRA <span className="text-white/40">/ Experience</span>
        </span>
        <span className="tabular font-mono text-[11px] tracking-[0.2em] text-white/50">
          {String(active + 1).padStart(2, '0')} <span className="text-white/25">/ {String(TOTAL).padStart(2, '0')}</span>
        </span>
        <button data-nav onClick={() => finish(firstRun ? audio.output : undefined)} className={`justify-self-end font-mono text-[11px] tracking-[0.2em] text-white/60 uppercase hover:text-fg ${focusRing}`}>
          {firstRun ? 'Skip' : 'Close'} <span className="ml-1 text-white/30">Esc</span>
        </button>
      </header>

      <div className="absolute top-20 right-0 bottom-12 z-20 hidden w-14 flex-col items-center justify-center gap-2 border-l border-white/10 sm:flex">
        {Array.from({ length: TOTAL }, (_, i) => (
          <button
            key={i}
            aria-label={`Section ${i + 1}`}
            onClick={() => scroller.current?.scrollTo({ top: i * scroller.current.clientHeight, behavior: 'smooth' })}
            className={`w-[3px] transition-all duration-500 ${i === active ? 'h-10 bg-accent' : 'h-3 bg-white/20 hover:bg-white/50'}`}
          />
        ))}
      </div>

      <Marquee />

      <div ref={scroller} className="relative z-10 h-full snap-y snap-mandatory overflow-y-auto">
        <section className="flex h-full snap-start flex-col justify-end px-6 pt-20 pb-[16vh] sm:px-10 lg:pl-[7vw]">
          <Reveal show={active === 0} delay={0}>
            <span className="font-mono text-[11px] tracking-[0.24em] text-white/60 uppercase">OXIA Labs presents</span>
          </Reveal>
          <h1 className="mt-6 text-[clamp(44px,13.5vw,230px)] leading-[0.8] font-[600] tracking-[-0.065em] uppercase">
            <Line show={active === 0} delay={80}>
              Tetra
            </Line>
            <Line show={active === 0} delay={180} className="exp-outline">
              Experience
            </Line>
          </h1>
          <Reveal show={active === 0} delay={360}>
            <p className="mt-10 max-w-[520px] text-[clamp(17px,1.5vw,21px)] leading-relaxed text-white/70">A game you play. A set you live through.</p>
          </Reveal>
          <Reveal show={active === 0} delay={480}>
            <button data-nav onClick={next} className={`group mt-12 flex items-center gap-4 font-mono text-[12px] tracking-[0.2em] uppercase ${focusRing}`}>
              <span className="exp-cue grid size-12 place-items-center border border-white/30 transition-colors group-hover:bg-white group-hover:text-black">↓</span>
              {firstRun ? 'Begin' : 'Scroll'}
            </button>
          </Reveal>
        </section>

        {CHAPTERS.map((c, i) => {
          const show = active === i + 1;
          return (
            <section key={c.kicker} className="relative flex h-full snap-start flex-col justify-center px-6 pt-20 pb-16 sm:px-10 lg:pl-[7vw]">
              <span aria-hidden className={`exp-index pointer-events-none absolute right-24 bottom-16 hidden transition-all duration-1000 lg:block ${show ? 'opacity-100' : 'translate-y-10 opacity-0'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <Reveal show={show} delay={0}>
                <div className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] uppercase">
                  <span className="text-white/40">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`h-px bg-white/40 transition-all duration-1000 ease-out ${show ? 'w-16' : 'w-0'}`} />
                  <span>{c.kicker}</span>
                </div>
              </Reveal>
              <h2 className="mt-7 text-[clamp(52px,8.6vw,148px)] leading-[0.86] font-[600] tracking-[-0.055em]">
                {c.title.map((line, k) => (
                  <Line key={line} show={show} delay={90 + k * 90}>
                    {line}
                  </Line>
                ))}
              </h2>
              <Reveal show={show} delay={320}>
                <p className="mt-9 max-w-[560px] text-[clamp(16px,1.4vw,20px)] leading-relaxed text-white/70">{c.body}</p>
              </Reveal>
              {c.facts && (
                <div className="mt-12 grid max-w-[720px] grid-cols-3 border-t border-l border-white/15">
                  {c.facts.map(([big, small], k) => (
                    <Reveal key={small} show={show} delay={420 + k * 80}>
                      <div className="h-full border-r border-b border-white/15 bg-black/40 px-5 py-5 backdrop-blur-sm">
                        <div className="text-[clamp(26px,3vw,44px)] leading-none font-[600] tracking-[-0.04em]">{big}</div>
                        <div className="mt-3 font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase">{small}</div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section className="flex h-full snap-start flex-col justify-center px-6 pt-20 pb-16 sm:px-10 lg:pl-[7vw]">
          {firstRun ? (
            <>
              <Reveal show={active === TOTAL - 1} delay={0}>
                <span className="font-mono text-[11px] tracking-[0.24em] text-white/60 uppercase">One last thing</span>
              </Reveal>
              <h2 className="mt-7 text-[clamp(52px,8.6vw,148px)] leading-[0.86] font-[600] tracking-[-0.055em]">
                <Line show={active === TOTAL - 1} delay={90}>
                  How are you
                </Line>
                <Line show={active === TOTAL - 1} delay={180}>
                  listening?
                </Line>
              </h2>
              <Reveal show={active === TOTAL - 1} delay={320}>
                <p className="mt-9 max-w-[540px] text-[clamp(16px,1.4vw,20px)] leading-relaxed text-white/70">
                  Headphones put you inside the room. Speakers get the club master in wide stereo. You can change it any time in Settings.
                </p>
              </Reveal>
              <div className="mt-12 grid max-w-[640px] grid-cols-1 border-t border-l border-white/20 sm:grid-cols-2">
                <Choice title="Headphones" hint="Binaural, the full room" onClick={() => finish('headphones')} primary />
                <Choice title="Speakers" hint="Wide stereo, club master" onClick={() => finish('speakers')} />
              </div>
            </>
          ) : (
            <>
              <Reveal show={active === TOTAL - 1} delay={0}>
                <span className="font-mono text-[11px] tracking-[0.24em] text-white/60 uppercase">Made by</span>
              </Reveal>
              <h2 className="mt-7 text-[clamp(52px,8.6vw,148px)] leading-[0.86] font-[600] tracking-[-0.055em] uppercase">
                <Line show={active === TOTAL - 1} delay={90}>
                  OXIA
                </Line>
                <Line show={active === TOTAL - 1} delay={180} className="exp-outline">
                  Labs
                </Line>
              </h2>
              <Reveal show={active === TOTAL - 1} delay={320}>
                <p className="mt-9 max-w-[580px] text-[clamp(16px,1.4vw,20px)] leading-relaxed text-white/70">
                  OXIA Labs is a creative technology studio. We build software of every kind, apps, tools and experiences, always where engineering meets
                  feel. TETRA is ours: a game you sit down to play, and a place the music pulls you into until nothing else is left.
                </p>
              </Reveal>
              <Reveal show={active === TOTAL - 1} delay={440}>
                <button data-nav onClick={() => finish()} className={`mt-12 border border-white bg-white px-8 py-4 font-mono text-[12px] font-semibold tracking-[0.2em] text-black uppercase transition-colors hover:bg-transparent hover:text-white ${focusRing}`}>
                  Enter TETRA →
                </button>
              </Reveal>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** A headline line that slides up from behind its own mask. */
function Line({ children, show, delay, className = '' }: { children: ReactNode; show: boolean; delay: number; className?: string }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <span
        className={`block transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${show ? 'translate-y-0' : 'translate-y-[105%]'} ${className}`}
        style={{ transitionDelay: show ? `${delay}ms` : '0ms' }}
      >
        {children}
      </span>
    </span>
  );
}

/** Fades and lifts in once its section is on screen. */
function Reveal({ children, show, delay }: { children: ReactNode; show: boolean; delay: number }) {
  return (
    <div
      className={`transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${show ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      style={{ transitionDelay: show ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

/** A 12-column hairline grid: the page's skeleton, always visible. */
function Grid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] hidden grid-cols-12 px-6 sm:px-10 lg:grid">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className="border-l border-white/[0.045] last:border-r" />
      ))}
    </div>
  );
}

/** A strip of words running along the bottom edge, forever. */
function Marquee() {
  const words = 'TETRA EXPERIENCE ✦ PLAY ✦ SOUND ✦ LIGHT ✦ FLOW ✦ OXIA LABS ✦ ';
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 h-12 overflow-hidden border-t border-white/10 bg-black/70 backdrop-blur-md">
      <div className="exp-marquee flex h-full w-max items-center font-mono text-[11px] tracking-[0.3em] whitespace-nowrap text-white/55">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="px-4">
            {words}
          </span>
        ))}
      </div>
    </div>
  );
}

function Choice({ title, hint, onClick, primary }: { title: string; hint: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      data-nav
      onClick={onClick}
      className={`group border-r border-b border-white/20 p-7 text-left transition-colors ${focusRing} ${primary ? 'bg-white text-black hover:bg-white/85' : 'bg-black/50 backdrop-blur-md hover:bg-white hover:text-black'}`}
    >
      <span className="block text-[28px] font-[600] tracking-[-0.03em]">{title}</span>
      <span className={`mt-2 block font-mono text-[10px] tracking-[0.2em] uppercase ${primary ? 'text-black/55' : 'text-white/55 group-hover:text-black/55'}`}>{hint}</span>
    </button>
  );
}
