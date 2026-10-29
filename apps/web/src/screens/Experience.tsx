import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { SKIN_ORDER } from '../game/skins';
import { useMenuNav } from '../lib/nav';
import { setExperience, updateSettings, useSettings } from '../lib/settings';
import { save } from '../lib/storage';
import { ModeWheel } from '../ui/ModeWheel';
import { Icon } from '../ui/Icon';
import type { ExperienceScene, Formation } from '../ui/experience/ExperienceScene';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

type ChapterId = 'sound' | 'rooms' | 'play' | 'opponents' | 'focus' | 'design' | 'oxia';
type View = 'welcome' | 'index' | 'listen' | ChapterId;

interface Chapter {
  id: ChapterId;
  name: string;
  /** One line for the index. */
  teaser: string;
  title: [string, string];
  body: string;
  facts?: [string, string][];
}

const CHAPTERS: Chapter[] = [
  {
    id: 'sound',
    name: 'Sound',
    teaser: 'The music is half the game.',
    title: ['You play', 'the music.'],
    body: 'In TETRA the music is not in the background. It is half of the game. Every session plays its own set of hypnotic, minimal techno, and you play it as much as it plays you: stack high and the mix sinks under a filter, chain combos and it opens up, land a quad and the room throws it back at you. Put on headphones and you are standing in the middle of the club.',
    facts: [
      ['Binaural', 'On headphones'],
      ['Club', 'Master chain'],
      ['Live', 'DJ on your game'],
    ],
  },
  {
    id: 'rooms',
    name: 'Rooms',
    teaser: 'Every skin brings its own light.',
    title: ['Light that', 'listens.'],
    body: 'Pick a skin and you walk into its room. The light behind your board follows the kick, counts the bars and opens up when the track drops. The board itself never moves an inch, so you always see every piece.',
    facts: [
      [String(SKIN_ORDER.length), 'Rooms'],
      ['Kick · Bar · Drop', 'What they hear'],
      ['0 px', 'Board movement'],
    ],
  },
  {
    id: 'play',
    name: 'Play',
    teaser: 'Precise to the frame.',
    title: ['Precise to', 'the frame.'],
    body: 'Under the light runs a serious engine: modern rotation, handling you tune to the frame, and every mode you know. Sprint 40 lines, chase a Blitz score, climb a Marathon, or go Endless until 20G.',
    facts: [
      ['SRS+', 'Rotation'],
      ['DAS · ARR', 'Tuned to the frame'],
      ['6', 'Ways to play'],
    ],
  },
  {
    id: 'opponents',
    name: 'Opponents',
    teaser: 'Ten bots that play like people.',
    title: ['Opponents', 'with a pulse.'],
    body: 'Ten bots, from your first match to a wall you will spend weeks climbing. They hesitate, misdrop and get greedy like people do, so beating one feels earned. Take them on in Versus, fight through the Cups, or build your own and watch it play.',
    facts: [
      ['10', 'Human-like bots'],
      ['3', 'Cups'],
      ['∞', 'Bots you build'],
    ],
  },
  {
    id: 'focus',
    name: 'Focus',
    teaser: 'Here to train? One switch.',
    title: ['Here to train?', 'Focus.'],
    body: 'The Experience is how we play TETRA, and we think it is the best way to feel it. But some days you are here to train: to shave tenths off your 40 lines or drill openers against the bots. Focus strips everything back for that. No rooms, no club, no intro, instant restarts. Flip the switch and feel the difference.',
  },
  {
    id: 'design',
    name: 'Design',
    teaser: 'Every detail, considered.',
    title: ['Made with', 'care.'],
    body: 'Every skin is a material, not a colour: glass that catches the light, concrete with its tie holes, weathering steel. Menus turn like a wheel, games start on the beat, and every sound is synthesised for TETRA. Nothing here is a default.',
    facts: [
      [String(SKIN_ORDER.length), 'Skins'],
      ['0', 'Stock sounds'],
      ['1', 'Obsession'],
    ],
  },
  {
    id: 'oxia',
    name: 'OXIA',
    teaser: 'Who is behind TETRA.',
    title: ['Designed by', 'OXIA Labs.'],
    body: 'TETRA is designed and built by OXIA Labs, a creative technology studio working where engineering meets feel.',
  },
];

const FORMATION: Record<View, Formation> = {
  welcome: 'welcome',
  index: 'index',
  listen: 'welcome',
  sound: 'sound',
  rooms: 'rooms',
  play: 'play',
  opponents: 'versus',
  focus: 'focus',
  design: 'design',
  oxia: 'oxia',
};

/**
 * The TETRA Experience: what TETRA is, told like a game's own menus. It
 * opens on a welcome, then an index of chapters, each a full screen of its
 * own. On first launch it runs straight through and ends by asking how
 * you are listening.
 */
export function Experience({ onDone, onOxia, firstRun = false }: { onDone: () => void; onOxia?: () => void; firstRun?: boolean }) {
  const settings = useSettings();
  const [view, setView] = useState<View>('welcome');
  const [focused, setFocused] = useState<ChapterId>('sound');
  const stage = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExperienceScene | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => sfx.unlock(), []);

  const chapterIndex = CHAPTERS.findIndex((c) => c.id === view);
  const go = useCallback((next: View) => {
    sfx.ui('move');
    setView(next);
  }, []);
  const finish = useCallback(
    (output?: 'headphones' | 'speakers') => {
      if (output) updateSettings((s) => ({ ...s, audio: { ...s.audio, output } }));
      save('onboarded', true);
      onDone();
    },
    [onDone],
  );
  const step = useCallback(
    (direction: 1 | -1) => {
      const i = chapterIndex + direction;
      if (i < 0) return go(firstRun ? 'welcome' : 'index');
      if (i >= CHAPTERS.length) return go(firstRun ? 'listen' : 'index');
      go(CHAPTERS[i].id);
    },
    [chapterIndex, firstRun, go],
  );

  // The 3D stage loads on its own (Three.js only ships with this page).
  useEffect(() => {
    let disposed = false;
    void import('../ui/experience/ExperienceScene').then(({ ExperienceScene }) => {
      if (disposed || !stage.current) return;
      sceneRef.current = new ExperienceScene(stage.current);
    });
    let raf = 0;
    const tick = () => {
      if (sceneRef.current) sceneRef.current.bands = music.analyse();
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
    const scene = sceneRef.current;
    if (scene) scene.formation = FORMATION[view];
    // The welcome plays the set muffled, as if from the next room; it opens when you walk in.
    music.club?.setLowpass(view === 'welcome' ? 700 : null);
  }, [view]);
  useEffect(() => () => music.club?.setLowpass(null), []);
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.reactive = settings.experience;
  }, [settings.experience]);
  // The stage may arrive after the first view was set.
  useEffect(() => {
    const id = setInterval(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.formation = FORMATION[view];
      scene.reactive = settings.experience;
    }, 250);
    return () => clearInterval(id);
  }, [view, settings.experience]);

  // Index: arrows move the wheel, Esc leaves.
  useMenuNav(firstRun ? undefined : onDone, view === 'index');
  useEffect(() => {
    if (view === 'index')
      firstRef.current?.parentElement?.querySelectorAll<HTMLButtonElement>('[data-nav]')[CHAPTERS.findIndex((c) => c.id === focused)]?.focus();
    // Only when arriving at the index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Welcome and chapters: their own keys.
  useEffect(() => {
    if (view === 'index') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (view === 'welcome') {
        if (e.code === 'Escape' && !firstRun) return onDone();
        e.preventDefault();
        return go(firstRun ? 'sound' : 'index');
      }
      if (view === 'listen') {
        if (e.code === 'Escape' || e.code === 'ArrowLeft') go('oxia');
        return;
      }
      if (e.code === 'ArrowRight' || e.code === 'Enter') {
        // Enter on a focused control is that control's.
        if (e.code === 'Enter' && document.activeElement instanceof HTMLButtonElement) return;
        e.preventDefault();
        step(1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (firstRun) finish();
        else go('index');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, firstRun, go, step, onDone, finish]);

  const chapter = chapterIndex >= 0 ? CHAPTERS[chapterIndex] : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-fg">
      <div ref={stage} className="absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${view === 'welcome' || view === 'oxia' || view === 'listen' ? 'opacity-0' : 'opacity-100'} bg-[linear-gradient(90deg,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.55)_42%,rgba(0,0,0,0)_70%)]`}
      />

      <header className="absolute inset-x-0 top-0 z-20 flex h-20 items-center justify-between px-8 sm:px-12">
        <button
          onClick={() => !firstRun && go('index')}
          className={`font-mono text-[11px] font-medium tracking-[0.2em] uppercase transition-opacity duration-500 ${view === 'welcome' ? 'opacity-0' : 'opacity-100'} ${focusRing}`}
        >
          TETRA <span className="text-white/40">/ Experience</span>
        </button>
        <button onClick={() => finish()} className={`glass rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`}>
          <span className="flex items-center gap-2">
            <Icon name="close" size={10} /> {firstRun ? 'Skip' : 'Close'} <span className="font-mono text-[11px] text-white/40">Esc</span>
          </span>
        </button>
      </header>

      {/* Welcome */}
      <Screen show={view === 'welcome'}>
        <button onClick={() => go(firstRun ? 'sound' : 'index')} className="absolute inset-0 grid place-items-center outline-none">
          <div className="text-center">
            <h1 className="text-[clamp(48px,8.4vw,150px)] leading-[0.95] font-[560] tracking-[-0.055em]">
              <Line show={view === 'welcome'} delay={250}>
                Welcome to TETRA
              </Line>
            </h1>
            <Reveal show={view === 'welcome'} delay={1100}>
              <p className="mt-8 text-[clamp(16px,1.3vw,19px)] text-white/55">Feel the blocks. Play the music.</p>
            </Reveal>
            <Reveal show={view === 'welcome'} delay={1700}>
              <span className="exp-blink mt-16 inline-block font-mono text-[11px] tracking-[0.28em] text-white/70 uppercase">Press any key</span>
            </Reveal>
          </div>
        </button>
      </Screen>

      {/* Index */}
      <Screen show={view === 'index'}>
        <div className="flex h-full flex-col justify-center px-8 sm:px-12 lg:pl-[8vw]">
          <Reveal show={view === 'index'} delay={80}>
            <span className="label">The Experience</span>
          </Reveal>
          <Reveal show={view === 'index'} delay={160}>
            <div className="mt-6 max-w-[640px]">
              <ModeWheel
                items={CHAPTERS.map((c) => c.id)}
                selected={focused}
                label={(id) => CHAPTERS.find((c) => c.id === id)!.name}
                extra={(id) => (
                  <span className="ml-2 font-mono text-[0.18em] tracking-[0.2em] text-white/40">
                    {String(CHAPTERS.findIndex((c) => c.id === id) + 1).padStart(2, '0')}
                  </span>
                )}
                onSelect={setFocused}
                onActivate={(id) => go(id)}
                firstRef={firstRef}
              />
            </div>
          </Reveal>
          <Reveal show={view === 'index'} delay={260}>
            <div className="mt-10 flex max-w-[560px] items-center justify-between gap-8 border-t border-line pt-6">
              <p key={focused} className="animate-fade text-[16px] text-muted">
                {CHAPTERS.find((c) => c.id === focused)!.teaser}
              </p>
              <button
                onClick={() => go(focused)}
                className={`glass-light flex shrink-0 items-center gap-3 rounded-full py-2.5 pr-2.5 pl-5 text-[15px] font-semibold ${focusRing}`}
              >
                Open
                <span className="grid size-7 place-items-center rounded-full bg-black/10 font-mono text-[12px]">↵</span>
              </button>
            </div>
          </Reveal>
        </div>
      </Screen>

      {/* Chapters */}
      {CHAPTERS.map((c, i) => (
        <Screen key={c.id} show={view === c.id}>
          {c.id === 'oxia' ? (
            <Oxia show={view === 'oxia'} firstRun={firstRun} onWhy={onOxia} onNext={() => step(1)} />
          ) : (
            <div className="flex h-full flex-col justify-center px-8 pb-20 sm:px-12 lg:pl-[8vw]">
              <Reveal show={view === c.id} delay={0}>
                <div className="flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] uppercase">
                  <span className="text-white/40">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`h-px bg-white/40 transition-all duration-1000 ease-out ${view === c.id ? 'w-12' : 'w-0'}`} />
                  <span>{c.name}</span>
                </div>
              </Reveal>
              <h2 className="mt-7 text-[clamp(52px,7.4vw,128px)] leading-[0.92] font-[560] tracking-[-0.05em]">
                {c.title.map((line, k) => (
                  <Line key={line} show={view === c.id} delay={90 + k * 90}>
                    {line}
                  </Line>
                ))}
              </h2>
              <Reveal show={view === c.id} delay={320}>
                <p className="mt-8 max-w-[540px] text-[clamp(16px,1.25vw,19px)] leading-relaxed text-white/65">{c.body}</p>
              </Reveal>
              {c.facts && (
                <Reveal show={view === c.id} delay={440}>
                  <div className="mt-12 flex max-w-[640px] gap-3">
                    {c.facts.map(([big, small]) => (
                      <div key={small} className="glass flex-1 rounded-[22px] px-5 py-4">
                        <div className="text-[clamp(20px,1.9vw,30px)] leading-none font-[560] tracking-[-0.035em]">{big}</div>
                        <div className="mt-2.5 font-mono text-[10px] tracking-[0.18em] text-white/50 uppercase">{small}</div>
                      </div>
                    ))}
                  </div>
                </Reveal>
              )}
              {c.id === 'focus' && (
                <Reveal show={view === 'focus'} delay={440}>
                  <FocusSwitches on={settings.experience} />
                </Reveal>
              )}
            </div>
          )}
        </Screen>
      ))}

      {/* First run: how are you listening? */}
      <Screen show={view === 'listen'}>
        <div className="grid h-full place-items-center px-8">
          <div className="w-full max-w-[720px] text-center">
            <Reveal show={view === 'listen'} delay={0}>
              <span className="label">One last thing</span>
            </Reveal>
            <h2 className="mt-6 text-[clamp(44px,6vw,100px)] leading-[0.95] font-[560] tracking-[-0.05em]">
              <Line show={view === 'listen'} delay={100}>
                How are you listening?
              </Line>
            </h2>
            <Reveal show={view === 'listen'} delay={300}>
              <p className="mx-auto mt-6 max-w-[500px] text-[17px] leading-relaxed text-white/60">
                Headphones put you inside the room. Speakers get the club master in wide stereo. You can change it any time in Settings.
              </p>
            </Reveal>
            <Reveal show={view === 'listen'} delay={420}>
              <div className="mt-12 grid grid-cols-2 gap-4">
                <Choice title="Headphones" hint="Binaural, the full room" onClick={() => finish('headphones')} />
                <Choice title="Speakers" hint="Wide stereo, club master" onClick={() => finish('speakers')} />
              </div>
            </Reveal>
          </div>
        </div>
      </Screen>

      {chapter && (
        <nav className="animate-fade absolute inset-x-0 bottom-0 z-20 flex h-24 items-center justify-between px-8 sm:px-12">
          <button onClick={() => step(-1)} className={`glass rounded-full px-5 py-2.5 text-[14px] font-medium ${focusRing}`}>
            ← {chapterIndex > 0 ? CHAPTERS[chapterIndex - 1].name : firstRun ? 'Welcome' : 'Index'}
          </button>
          <div className="flex items-center gap-2">
            {CHAPTERS.map((c, i) => (
              <span key={c.id} className={`h-1 rounded-full transition-all duration-500 ${i === chapterIndex ? 'w-8 bg-fg' : 'w-1 bg-white/25'}`} />
            ))}
          </div>
          <button onClick={() => step(1)} className={`glass-light rounded-full px-5 py-2.5 text-[14px] font-semibold ${focusRing}`}>
            {chapterIndex < CHAPTERS.length - 1 ? CHAPTERS[chapterIndex + 1].name : firstRun ? 'Finish' : 'Index'} →
          </button>
        </nav>
      )}
    </div>
  );
}

/** A full-screen layer that fades in and out with its view. */
function Screen({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      className={`absolute inset-0 z-10 transition-opacity duration-500 ${show ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      aria-hidden={!show}
    >
      {children}
    </div>
  );
}

/** The Focus chapter's live switches: flip them and the page changes sound and light. */
function FocusSwitches({ on }: { on: boolean }) {
  const parts: [string, string][] = [
    ['Rooms', 'Light that follows the music'],
    ['Club sound', 'Mastering and space'],
    ['Live DJ', 'The mix follows your game'],
    ['Game intro', 'The board builds on the beat'],
  ];
  return (
    <div className="mt-10 max-w-[560px]">
      <div className="glass inline-flex rounded-full p-1">
        {(
          [
            [true, 'Experience'],
            [false, 'Focus'],
          ] as const
        ).map(([value, name]) => (
          <button
            key={name}
            onClick={() => value !== on && setExperience(value)}
            className={`rounded-full px-6 py-2.5 text-[15px] font-medium transition-all duration-300 ease-spring ${focusRing} ${on === value ? 'bg-fg text-black' : 'text-muted hover:text-fg'}`}
          >
            {name}
          </button>
        ))}
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4">
        {parts.map(([name, hint], i) => (
          <li key={name} className="flex items-center gap-3">
            <span
              className={`relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors duration-300 ${on ? 'bg-[#30d158]' : 'bg-white/15'}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span
                className={`absolute top-[2px] left-[2px] size-[14px] rounded-full bg-white transition-transform duration-300 ease-spring ${on ? 'translate-x-[14px]' : ''}`}
                style={{ transitionDelay: `${i * 90}ms` }}
              />
            </span>
            <span>
              <span className="block text-[14px] font-medium">{name}</span>
              <span className="block text-[12px] text-faint">{hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The close: contained, almost an ad. */
function Oxia({ show, firstRun, onWhy, onNext }: { show: boolean; firstRun: boolean; onWhy?: () => void; onNext: () => void }) {
  return (
    <div className="grid h-full place-items-center px-8 pb-16">
      <div className="pt-[22vh] text-center">
        <Reveal show={show} delay={0}>
          <span className="label">Designed and built by</span>
        </Reveal>
        <h2 className="mt-6 text-[clamp(64px,10vw,180px)] leading-[0.9] font-[600] tracking-[-0.06em]">
          <Line show={show} delay={120}>
            OXIA Labs
          </Line>
        </h2>
        <Reveal show={show} delay={360}>
          <p className="mx-auto mt-7 max-w-[460px] text-[17px] leading-relaxed text-white/60">
            A creative technology studio. We build where engineering meets feel. TETRA is ours.
          </p>
        </Reveal>
        <Reveal show={show} delay={480}>
          <div className="mt-10 flex justify-center gap-3">
            {onWhy && !firstRun && (
              <button onClick={onWhy} className={`glass-light rounded-full px-6 py-3 text-[15px] font-semibold ${focusRing}`}>
                Why TETRA →
              </button>
            )}
            {firstRun && (
              <button onClick={onNext} className={`glass-light rounded-full px-6 py-3 text-[15px] font-semibold ${focusRing}`}>
                Continue →
              </button>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/** A headline line that slides up from behind its own mask; padded so descenders never clip. */
function Line({ children, show, delay }: { children: ReactNode; show: boolean; delay: number }) {
  return (
    <span className="-mb-[0.14em] block overflow-hidden pb-[0.14em]">
      <span
        className={`block transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${show ? 'translate-y-0' : 'translate-y-[110%]'}`}
        style={{ transitionDelay: show ? `${delay}ms` : '0ms' }}
      >
        {children}
      </span>
    </span>
  );
}

/** Fades and lifts in with its screen. */
function Reveal({ children, show, delay }: { children: ReactNode; show: boolean; delay: number }) {
  return (
    <div
      className={`transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${show ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
      style={{ transitionDelay: show ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

function Choice({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`glass rounded-[28px] p-7 text-left ${focusRing}`}>
      <span className="block text-[26px] font-[560] tracking-[-0.03em]">{title}</span>
      <span className="mt-2 block font-mono text-[10px] tracking-[0.2em] text-white/50 uppercase">{hint}</span>
    </button>
  );
}
