import { useCallback, useEffect, useRef, useState } from 'react';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { setExperience, updateSettings, useSettings } from '../lib/settings';
import { save } from '../lib/storage';
import type { ExperienceScene, Formation } from '../ui/experience/ExperienceScene';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70 rounded-sm';

type Step = 'origin' | 'sound' | 'rooms' | 'opponents' | 'focus' | 'oxia' | 'listen';

interface Statement {
  id: Step;
  /** Its name in the bar at the bottom. */
  name: string;
  /** Lines are split with `|`, so no word is ever left alone on a line. */
  title: string;
  line: string;
  formation: Formation;
}

/** The story, one statement per screen. Few words, each one earning its place. */
const STORY: Statement[] = [
  { id: 'origin', name: 'Origin', title: 'Music and blocks|speak the same language.', line: 'Tension. Release. The drop.', formation: 'welcome' },
  { id: 'sound', name: 'Sound', title: 'You play the music.', line: 'Stack high and it sinks. Clear four and it drops.', formation: 'sound' },
  { id: 'rooms', name: 'Rooms', title: 'Every skin is a room.', line: 'Light that listens to the beat.', formation: 'rooms' },
  { id: 'opponents', name: 'Opponents', title: 'Opponents|with a pulse.', line: 'Ten bots that play like people. Mistakes included.', formation: 'versus' },
  { id: 'focus', name: 'Focus', title: 'Here to train?', line: 'Focus turns off everything but the stack.', formation: 'focus' },
  { id: 'oxia', name: 'OXIA', title: 'Designed by|OXIA Labs.', line: 'A creative technology studio, where engineering meets feel.', formation: 'oxia' },
];

const LISTEN: Statement = { id: 'listen', name: 'Listen', title: 'How are you listening?', line: 'You can change it any time in Settings.', formation: 'welcome' };

/**
 * The TETRA Experience: why TETRA exists, told in six statements over the
 * 3D stage, with the menu music underneath. It opens on a welcome; arrows,
 * the wheel or the bar move through it. On first launch it ends by asking
 * how you are listening.
 */
export function Experience({ onDone, onOxia, firstRun = false }: { onDone: () => void; onOxia?: () => void; firstRun?: boolean }) {
  const settings = useSettings();
  const story = firstRun ? [...STORY, LISTEN] : STORY;
  const [index, setIndex] = useState(-1);
  const stage = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExperienceScene | null>(null);
  useEffect(() => sfx.unlock(), []);

  const current = index >= 0 ? story[index] : null;
  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(-1, Math.min(story.length - 1, next));
      setIndex((i) => {
        if (clamped !== i) sfx.ui('move');
        return clamped;
      });
    },
    [story.length],
  );
  const finish = useCallback(
    (output?: 'headphones' | 'speakers') => {
      if (output) updateSettings((s) => ({ ...s, audio: { ...s.audio, output } }));
      save('onboarded', true);
      onDone();
    },
    [onDone],
  );

  // The 3D stage loads on its own (Three.js only ships with this page).
  useEffect(() => {
    let disposed = false;
    void import('../ui/experience/ExperienceScene').then(({ ExperienceScene }) => {
      if (disposed || !stage.current) return;
      const scene = new ExperienceScene(stage.current);
      scene.centered = true;
      sceneRef.current = scene;
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

  // The stage follows the story; the welcome hears the music as if from the next room.
  useEffect(() => {
    const apply = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.formation = current?.formation ?? 'welcome';
      scene.reactive = settings.experience;
    };
    apply();
    const id = setInterval(apply, 250);
    music.club?.setLowpass(index < 0 ? 700 : null);
    return () => clearInterval(id);
  }, [current, index, settings.experience]);
  useEffect(() => () => music.club?.setLowpass(null), []);

  // Keys, and the wheel: one statement per gesture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        return finish();
      }
      if (index < 0) {
        e.preventDefault();
        return go(0);
      }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown' || e.code === 'Space') {
        e.preventDefault();
        go(index + 1);
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        go(index - 1);
      }
    };
    let acc = 0;
    let lockedUntil = 0;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now < lockedUntil) return;
      acc += e.deltaY;
      if (Math.abs(acc) < 50) return;
      go(index + Math.sign(acc));
      acc = 0;
      lockedUntil = now + 850;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [index, go, finish]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-fg" onClick={() => index < 0 && go(0)}>
      <div ref={stage} className="absolute inset-0" aria-hidden />
      {/* A soft dark pool in the middle keeps the words above the light. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_46%_at_50%_50%,rgba(0,0,0,0.9),rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.1)_90%)]" />

      <header className="absolute inset-x-0 top-0 z-20 flex h-20 items-center justify-between px-8 sm:px-12">
        <span className="font-mono text-[11px] font-medium tracking-[0.24em] text-white/70 uppercase">TETRA</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
          className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}
        >
          {firstRun ? 'Skip' : 'Close'}
        </button>
      </header>

      {/* Welcome */}
      <Layer show={index < 0}>
        <h1 className="text-[clamp(48px,8vw,140px)] leading-[1.04] font-[560] tracking-[-0.055em]">
          <Words show={index < 0} text="Welcome to TETRA" delay={300} />
        </h1>
        <Fade show={index < 0} delay={1400}>
          <p className="exp-blink mt-14 font-mono text-[11px] tracking-[0.3em] text-white/60 uppercase">Press any key</p>
        </Fade>
      </Layer>

      {story.map((s, i) => (
        <Layer key={s.id} show={index === i}>
          <h2 className="text-[clamp(44px,6.4vw,112px)] leading-[1.04] font-[560] tracking-[-0.05em]">
            {s.title.split('|').map((line, k, all) => (
              <span key={k} className="block whitespace-nowrap">
                <Words show={index === i} text={line} delay={120 + k * 70 * (all[k - 1]?.split(' ').length ?? 0)} />
              </span>
            ))}
          </h2>
          <Fade show={index === i} delay={650}>
            <p className="mx-auto mt-8 max-w-[34ch] text-[clamp(17px,1.35vw,21px)] leading-relaxed text-white/55">{s.line}</p>
          </Fade>
          {s.id === 'focus' && (
            <Fade show={index === i} delay={900}>
              <FocusSwitch on={settings.experience} />
            </Fade>
          )}
          {s.id === 'oxia' && onOxia && !firstRun && (
            <Fade show={index === i} delay={900}>
              <button
                onClick={onOxia}
                className={`group mt-12 inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] text-white/80 uppercase ${focusRing}`}
              >
                <span className="border-b border-white/30 pb-1 transition-colors group-hover:border-white">Why we made TETRA</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </button>
            </Fade>
          )}
          {s.id === 'listen' && (
            <Fade show={index === i} delay={900}>
              <div className="mt-14 flex items-center justify-center gap-12">
                {(['headphones', 'speakers'] as const).map((output) => (
                  <button
                    key={output}
                    onClick={() => finish(output)}
                    className={`group text-[clamp(28px,2.6vw,40px)] font-[520] tracking-[-0.03em] text-white/45 transition-colors hover:text-fg ${focusRing}`}
                  >
                    {output === 'headphones' ? 'Headphones' : 'Speakers'}
                    <span className="mx-auto mt-2 block h-px w-0 bg-fg transition-all duration-500 group-hover:w-full" />
                  </button>
                ))}
              </div>
            </Fade>
          )}
        </Layer>
      ))}

      {/* The bar: where you are, and a menu to jump anywhere. */}
      <nav
        className={`absolute inset-x-0 bottom-0 z-20 flex h-24 items-center justify-center gap-7 px-8 transition-opacity duration-700 ${index < 0 ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      >
        {story.map((s, i) => (
          <button
            key={s.id}
            onClick={(e) => {
              e.stopPropagation();
              go(i);
            }}
            className={`group flex flex-col items-center gap-2.5 ${focusRing}`}
          >
            <span className={`h-px transition-all duration-500 ${i === index ? 'w-10 bg-fg' : 'w-5 bg-white/25 group-hover:bg-white/60'}`} />
            <span className={`font-mono text-[10px] tracking-[0.2em] uppercase transition-colors duration-500 ${i === index ? 'text-fg' : 'text-white/30 group-hover:text-white/70'}`}>
              {s.name}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** One full-screen statement, centred. */
function Layer({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 z-10 grid place-items-center px-8 text-center transition-[opacity,filter] duration-700 ${show ? 'opacity-100' : 'pointer-events-none opacity-0 blur-[6px]'}`}
      aria-hidden={!show}
    >
      <div>{children}</div>
    </div>
  );
}

/** A headline whose words rise one by one from behind their own line, and lift away when it leaves. */
function Words({ text, show, delay }: { text: string; show: boolean; delay: number }) {
  return (
    <>
      {text.split(' ').map((word, i, all) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-top -mb-[0.12em]">
          <span
            className={`inline-block transition-[transform,opacity] ease-[cubic-bezier(0.16,1,0.3,1)] ${show ? 'translate-y-0 opacity-100 duration-[1100ms]' : '-translate-y-[40%] opacity-0 duration-500'}`}
            style={{ transitionDelay: show ? `${delay + i * 70}ms` : '0ms' }}
          >
            {word}
            {i < all.length - 1 ? ' ' : ''}
          </span>
        </span>
      ))}
    </>
  );
}

function Fade({ show, delay, children }: { show: boolean; delay: number; children: React.ReactNode }) {
  return (
    <div
      className={`transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${show ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
      style={{ transitionDelay: show ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

/** Experience or Focus: flip it and hear and see what changes. */
function FocusSwitch({ on }: { on: boolean }) {
  return (
    <div className="mt-12 inline-flex items-center gap-10">
      {(
        [
          [true, 'Experience'],
          [false, 'Focus'],
        ] as const
      ).map(([value, name]) => (
        <button
          key={name}
          onClick={(e) => {
            e.stopPropagation();
            if (value !== on) setExperience(value);
          }}
          className={`group flex flex-col items-center gap-3 text-[clamp(22px,1.9vw,30px)] font-[520] tracking-[-0.03em] transition-colors duration-500 ${on === value ? 'text-fg' : 'text-white/35 hover:text-white/70'} ${focusRing}`}
        >
          {name}
          <span className={`h-px transition-all duration-500 ${on === value ? 'w-full bg-fg' : 'w-0 bg-white/40'}`} />
        </button>
      ))}
    </div>
  );
}
