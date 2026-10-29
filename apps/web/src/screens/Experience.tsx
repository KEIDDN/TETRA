import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import type { SceneId } from '../game/scenes/shaderScene';
import { useMenuNav } from '../lib/nav';
import { updateSettings, useSettings } from '../lib/settings';
import { save } from '../lib/storage';
import { SceneBackdrop } from '../ui/SceneBackdrop';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

interface Chapter {
  scene: SceneId;
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  facts?: [string, string][];
}

const CHAPTERS: Chapter[] = [
  {
    scene: 'aurora',
    kicker: 'Origin',
    title: (
      <>
        Born from two
        <br />
        obsessions.
      </>
    ),
    body: (
      <>
        Falling blocks, and the music that keeps a room moving until sunrise. We kept noticing they speak the same language: tension, release, the
        moment everything locks into place. TETRA is what happens when you stop treating them as separate things.
      </>
    ),
  },
  {
    scene: 'wire',
    kicker: 'Play',
    title: (
      <>
        Precise to the
        <br />
        millisecond.
      </>
    ),
    body: <>A competitive engine with modern rotation, handling you tune to the frame, and opponents that play like people, not machines.</>,
    facts: [
      ['SRS+', 'Rotation'],
      ['120', 'FPS'],
      ['10', 'Human-like bots'],
    ],
  },
  {
    scene: 'neon',
    kicker: 'Sound',
    title: (
      <>
        A club in your
        <br />
        headphones.
      </>
    ),
    body: (
      <>
        Hypnotic techno, mastered for a concrete room you can feel. On headphones the sound surrounds you, binaural, speakers ahead and the room
        behind. The sub sits in your chest, not in your ears.
      </>
    ),
    facts: [
      ['Binaural', 'On headphones'],
      ['Club', 'Master chain'],
      ['−14', 'LUFS, every track'],
    ],
  },
  {
    scene: 'crystal',
    kicker: 'Light',
    title: (
      <>
        Light that
        <br />
        listens.
      </>
    ),
    body: (
      <>
        Every skin has its own architecture of light. It follows the kick, counts the bars, and opens up when the track drops, while the board
        stays perfectly still, so you never lose a piece.
      </>
    ),
    facts: [
      ['12', 'Scenes'],
      ['Kick', 'Bar, phrase, drop'],
      ['0', 'Board movement'],
    ],
  },
  {
    scene: 'ember',
    kicker: 'Flow',
    title: (
      <>
        Everything
        <br />
        answers you.
      </>
    ),
    body: (
      <>
        Stack too high and the music sinks under water. Chain a combo and it opens up. Land a quad and the room throws it back at you. You are not
        playing over the music. You are playing it.
      </>
    ),
  },
];

/**
 * The TETRA Experience: what it is and why. Shown once at first launch
 * (ending with "headphones or speakers?") and always reachable from the
 * home screen and Settings.
 */
export function Experience({ onDone, firstRun = false }: { onDone: () => void; firstRun?: boolean }) {
  const { audio } = useSettings();
  const [chapter, setChapter] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  useMenuNav(firstRun ? undefined : onDone, true);
  useEffect(() => sfx.unlock(), []);

  // The backdrop follows the section in view.
  useEffect(() => {
    const root = scroller.current!;
    const sections = [...root.querySelectorAll<HTMLElement>('[data-chapter]')];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setChapter(Number((e.target as HTMLElement).dataset.chapter));
      },
      { root, threshold: 0.55 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const scene: SceneId = chapter < 0 ? 'gem' : chapter >= CHAPTERS.length ? 'mono' : CHAPTERS[chapter].scene;
  const finish = (output?: 'headphones' | 'speakers') => {
    if (output) updateSettings((s) => ({ ...s, experience: true, audio: { ...s.audio, output } }));
    save('onboarded', true);
    sfx.ui('select');
    onDone();
  };
  const next = () => scroller.current?.scrollBy({ top: window.innerHeight, behavior: 'smooth' });

  return (
    <div className="fixed inset-0 bg-black">
      <SceneBackdrop scene={scene} cap={0.3} className="absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_60%,rgba(0,0,0,0.78),rgba(0,0,0,0.25)_70%)]" />

      <header className="absolute inset-x-0 top-0 z-10 flex h-24 items-center justify-between px-6 sm:px-10">
        <span className="label text-fg">
          TETRA <span className="text-faint">Experience</span>
        </span>
        <button data-nav onClick={() => finish(firstRun ? audio.output : undefined)} className={`rounded-full px-4 py-2 text-[14px] font-medium text-muted hover:text-fg ${focusRing}`}>
          {firstRun ? 'Skip' : '← Back'} <span className="label ml-2">Esc</span>
        </button>
      </header>

      <Progress count={CHAPTERS.length + 2} active={chapter + 1} />

      <div ref={scroller} className="relative h-full snap-y snap-mandatory overflow-y-auto">
        <section data-chapter={-1} className="flex min-h-full snap-start flex-col justify-end px-6 pb-[12vh] sm:px-10 lg:px-[8vw]">
          <div className="exp-rise label">OXIA Labs presents</div>
          <h1 className="exp-rise mt-5 text-[clamp(72px,15vw,240px)] leading-[0.82] font-[520] tracking-[-0.06em]" style={{ animationDelay: '120ms' }}>
            TETRA
            <br />
            <span className="text-white/35">Experience</span>
          </h1>
          <p className="exp-rise mt-8 max-w-[560px] text-[clamp(18px,1.6vw,22px)] leading-relaxed text-muted" style={{ animationDelay: '260ms' }}>
            Falling blocks. Club sound. Living light. One flow state.
          </p>
          <button data-nav onClick={next} className={`exp-rise mt-12 flex w-fit items-center gap-3 text-[14px] font-medium text-fg ${focusRing}`} style={{ animationDelay: '400ms' }}>
            <span className="exp-cue grid size-10 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]">↓</span>
            {firstRun ? 'Begin' : 'Scroll'}
          </button>
        </section>

        {CHAPTERS.map((c, i) => (
          <section key={c.kicker} data-chapter={i} className="flex min-h-full snap-start flex-col justify-center px-6 py-28 sm:px-10 lg:px-[8vw]">
            <div className={`transition-all duration-700 ease-spring ${chapter === i ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="flex items-center gap-4">
                <span className="tabular text-[13px] text-faint">0{i + 1}</span>
                <span className="h-px w-10 bg-white/25" />
                <span className="label text-fg">{c.kicker}</span>
              </div>
              <h2 className="mt-6 text-[clamp(52px,8.5vw,140px)] leading-[0.9] font-[500] tracking-[-0.055em]">{c.title}</h2>
              <p className="mt-8 max-w-[600px] text-[clamp(17px,1.5vw,21px)] leading-relaxed text-white/70">{c.body}</p>
              {c.facts && (
                <div className="mt-12 flex flex-wrap gap-x-14 gap-y-6 border-t border-white/10 pt-8">
                  {c.facts.map(([big, small]) => (
                    <div key={small}>
                      <div className="text-[clamp(32px,3.4vw,48px)] leading-none font-medium tracking-[-0.04em]">{big}</div>
                      <div className="label mt-2">{small}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}

        <section data-chapter={CHAPTERS.length} className="flex min-h-full snap-start flex-col justify-center px-6 py-28 sm:px-10 lg:px-[8vw]">
          <div className={`transition-all duration-700 ease-spring ${chapter === CHAPTERS.length ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <div className="label">{firstRun ? 'One last thing' : 'Made by OXIA Labs'}</div>
            <h2 className="mt-6 text-[clamp(52px,8.5vw,140px)] leading-[0.9] font-[500] tracking-[-0.055em]">
              {firstRun ? (
                <>
                  How are you
                  <br />
                  listening?
                </>
              ) : (
                <>
                  Built for
                  <br />
                  flow.
                </>
              )}
            </h2>
            {firstRun ? (
              <>
                <p className="mt-8 max-w-[560px] text-[clamp(17px,1.5vw,21px)] leading-relaxed text-white/70">
                  Headphones put you inside the room. Speakers get the club master in wide stereo. You can change it any time in Settings.
                </p>
                <div className="mt-12 grid max-w-[620px] gap-3 sm:grid-cols-2">
                  <Choice title="Headphones" hint="Binaural, the full room" icon={<HeadphonesGlyph />} onClick={() => finish('headphones')} primary />
                  <Choice title="Speakers" hint="Wide stereo, club master" icon={<SpeakersGlyph />} onClick={() => finish('speakers')} />
                </div>
              </>
            ) : (
              <>
                <p className="mt-8 max-w-[560px] text-[clamp(17px,1.5vw,21px)] leading-relaxed text-white/70">
                  OXIA Labs is a small studio working where software meets sound. TETRA is our first instrument: a game you play, and a set you
                  live through.
                </p>
                <button data-nav onClick={() => finish()} className={`mt-12 rounded-full bg-accent px-8 py-4 text-[16px] font-semibold text-black transition-transform duration-300 ease-spring hover:scale-[1.04] ${focusRing}`}>
                  Back to TETRA
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Progress({ count, active }: { count: number; active: number }) {
  return (
    <div className="pointer-events-none absolute top-1/2 right-6 z-10 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`w-[2px] rounded-full transition-all duration-500 ${i === active ? 'h-8 bg-accent' : 'h-3 bg-white/20'}`} />
      ))}
    </div>
  );
}

function Choice({ title, hint, icon, onClick, primary }: { title: string; hint: string; icon: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      data-nav
      onClick={onClick}
      className={`group flex items-center gap-5 rounded-[28px] p-6 text-left transition-transform duration-300 ease-spring hover:scale-[1.03] ${focusRing} ${
        primary ? 'bg-accent text-black' : 'bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] backdrop-blur-md'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>
        <span className="block text-[20px] font-semibold tracking-[-0.02em]">{title}</span>
        <span className={`block text-[13px] ${primary ? 'text-black/60' : 'text-muted'}`}>{hint}</span>
      </span>
    </button>
  );
}

function HeadphonesGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 22v-5a11 11 0 0 1 22 0v5" />
      <rect x="4" y="20" width="6" height="10" rx="2.5" fill="currentColor" stroke="none" />
      <rect x="24" y="20" width="6" height="10" rx="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SpeakersGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="12" height="24" rx="3" />
      <rect x="19" y="5" width="12" height="24" rx="3" />
      <circle cx="9" cy="20" r="3.5" />
      <circle cx="25" cy="20" r="3.5" />
      <circle cx="9" cy="11" r="1.4" fill="currentColor" />
      <circle cx="25" cy="11" r="1.4" fill="currentColor" />
    </svg>
  );
}
