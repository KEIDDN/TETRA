import { BOTS } from '@tetra/bot';
import { useCallback, useEffect, useRef, useState } from 'react';
import { director } from '../audio/director';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { setExperience, updateSettings, useSettings } from '../lib/settings';
import { save } from '../lib/storage';
import { DemoBoard, type DemoMode } from '../ui/DemoBoard';
import { GlassSwitch } from '../ui/GlassSwitch';
import type { ExperienceScene, Formation } from '../ui/experience/ExperienceScene';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70 rounded-sm';
/** The page's own set: everything is cut to its beat. */
const TRACK = 'oxia-spatial-decay';
const RIVAL = BOTS[6];

type Id = 'welcome' | 'origin' | 'sound' | 'rooms' | 'opponents' | 'focus' | 'oxia' | 'listen';

interface Chapter {
  id: Id;
  /** Its name in the bar. */
  name: string;
  /** Headline lines; each word lands on a beat. */
  title: string[];
  /** A short, bigger answer that lands after the headline. */
  punch?: string;
  line?: string;
  /** 3D stage formation, or the real game in the Mono skin. */
  stage: Formation | { game: DemoMode; bot?: boolean };
}

const CHAPTERS: Chapter[] = [
  { id: 'welcome', name: 'TETRA', title: ['Welcome to TETRA'], stage: 'oxia' },
  { id: 'origin', name: 'Origin', title: ['Music and blocks', 'speak the same language.'], line: 'Tension. Release. The drop.', stage: 'welcome' },
  {
    id: 'sound',
    name: 'Sound',
    title: ["You don't play", 'over the music.'],
    punch: 'You play it.',
    line: 'Stack high and the mix sinks. Clear four and it drops.',
    stage: { game: 'marathon' },
  },
  { id: 'rooms', name: 'Rooms', title: ['Every skin', 'is a room.'], line: 'Light that follows the kick, counts the bars and breaks on the drop.', stage: { game: 'blitz' } },
  {
    id: 'opponents',
    name: 'Opponents',
    title: ['Opponents', 'with a pulse.'],
    line: 'Ten bots that hesitate, misdrop and get greedy. Just like people.',
    stage: { game: 'versus', bot: true },
  },
  { id: 'focus', name: 'Focus', title: ['Here to train?'], line: 'One switch. Everything but the stack goes quiet.', stage: { game: 'sprint' } },
  { id: 'oxia', name: 'OXIA', title: ['Designed by', 'OXIA Labs.'], line: 'Creative technology, made with obsession.', stage: 'oxia' },
];
const LISTEN: Chapter = { id: 'listen', name: 'Listen', title: ['How are you', 'listening?'], stage: 'welcome' };

/** Beats since `active` turned on, from the live beat clock (or a steady pulse when the music has none yet). */
function useBeats(active: boolean): number {
  const [beats, setBeats] = useState(0);
  useEffect(() => {
    if (!active) {
      setBeats(0);
      return;
    }
    const next = music.nextBeat();
    const period = (next?.period ?? 60 / 131) * 1000;
    const first = performance.now() + (next ? next.in * 1000 : 120);
    let raf = 0;
    const tick = () => {
      const n = Math.max(0, Math.floor((performance.now() - first) / period) + 1);
      setBeats((b) => (b === n ? b : n));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return beats;
}

/**
 * The TETRA Experience: walking into the club. Chapters you move through,
 * each a scene cut to the beat of the page's own track: 3D for the opening
 * and the mark, the real game in Mono with its room for the rest.
 */
export function Experience({ onDone, onOxia, firstRun = false }: { onDone: () => void; onOxia?: () => void; firstRun?: boolean }) {
  const settings = useSettings();
  const chapters = firstRun ? [...CHAPTERS, LISTEN] : CHAPTERS;
  const [index, setIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExperienceScene | null>(null);
  const chapter = chapters[index];
  const game = typeof chapter.stage === 'object' ? chapter.stage : null;
  const [gameMode, setGameMode] = useState<{ game: DemoMode; bot?: boolean } | null>(null);
  useEffect(() => sfx.unlock(), []);

  // The page plays its own set.
  useEffect(() => {
    director.pin(TRACK);
    return () => director.pin(null);
  }, []);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(chapters.length - 1, next));
      setIndex((i) => {
        if (clamped !== i) sfx.ui('move');
        return clamped;
      });
    },
    [chapters.length],
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
      scene.stagger = 5;
      sceneRef.current = scene;
    });
    let raf = 0;
    const tick = () => {
      const bands = music.analyse();
      if (sceneRef.current) sceneRef.current.bands = bands;
      root.current?.style.setProperty('--kick', bands.kick.toFixed(3));
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

  // The stage follows the chapter. The game layer stays mounted across game chapters and leaves after its fade.
  useEffect(() => {
    if (game) setGameMode(game);
    const apply = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (!game) scene.formation = chapter.stage as Formation;
      if (chapter.id !== 'welcome') scene.stagger = 0.6;
      scene.reactive = settings.experience;
      scene.paused = !!game;
    };
    apply();
    const id = setInterval(apply, 200);
    const leave = game ? 0 : window.setTimeout(() => setGameMode(null), 800);
    // The opening hears the set from the next room; it opens as you walk in.
    music.club?.setLowpass(chapter.id === 'welcome' ? 650 : null);
    return () => {
      clearInterval(id);
      clearTimeout(leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, settings.experience]);
  useEffect(() => () => music.club?.setLowpass(null), []);

  // Keys, and the wheel: one chapter per gesture.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        return finish();
      }
      if (e.code === 'ArrowRight' || e.code === 'ArrowDown' || e.code === 'Space' || (index === 0 && e.code === 'Enter')) {
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
      lockedUntil = now + 900;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [index, go, finish]);

  const toggleFocus = (focus: boolean) => {
    if (focus === !settings.experience) return;
    if (focus) {
      // The room drops out: the set sinks under a filter, then the club goes dry.
      music.club?.setLowpass(700);
      window.setTimeout(() => {
        setExperience(false);
        music.club?.setLowpass(null);
      }, 380);
    } else {
      setExperience(true);
      music.club?.throw(6, music.bpm);
    }
  };

  return (
    <div ref={root} className="fixed inset-0 overflow-hidden bg-black text-fg" onClick={() => index === 0 && go(1)}>
      <div ref={stage} className={`absolute inset-0 transition-opacity duration-700 ${game ? 'opacity-0' : 'opacity-100'}`} aria-hidden />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${game ? 'opacity-0' : 'opacity-100'} bg-[radial-gradient(55%_46%_at_50%_55%,rgba(0,0,0,0.88),rgba(0,0,0,0.5)_55%,rgba(0,0,0,0.05)_90%)]`}
      />

      {/* The real game: Mono, with its room. */}
      {gameMode && (
        <div className={`absolute inset-y-0 right-0 left-[34%] transition-opacity duration-700 ${game ? 'opacity-100' : 'opacity-0'}`}>
          <DemoBoard
            mode={(game ?? gameMode).game}
            skin="mono"
            bot={(game ?? gameMode).bot ? RIVAL : undefined}
            room={chapter.id === 'focus' ? 'experience' : 'on'}
            className="absolute inset-0"
          />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[30%] bg-gradient-to-r from-black to-transparent" />
          {chapter.id === 'opponents' && (
            <div className="absolute right-10 bottom-28 font-mono text-[10px] tracking-[0.24em] text-white/50 uppercase">
              Live · {RIVAL.name} · Level {RIVAL.level}
            </div>
          )}
        </div>
      )}

      <header className="absolute inset-x-0 top-0 z-20 flex h-20 items-center justify-between px-8 sm:px-12">
        <span className="font-mono text-[11px] font-medium tracking-[0.24em] text-white/70 uppercase">TETRA · Experience</span>
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

      {chapters.map((c, i) => (
        <Scene key={c.id} chapter={c} active={index === i} gameSide={typeof c.stage === 'object'}>
          {c.id === 'welcome' && <p className="exp-blink font-mono text-[11px] tracking-[0.3em] text-white/60 uppercase">Press any key</p>}
          {c.id === 'focus' && <GlassSwitch options={['Experience', 'Focus']} value={settings.experience ? 0 : 1} onChange={(v) => toggleFocus(v === 1)} />}
          {c.id === 'oxia' && onOxia && !firstRun && (
            <button onClick={onOxia} className={`group inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] text-white/80 uppercase ${focusRing}`}>
              <span className="border-b border-white/30 pb-1 transition-colors group-hover:border-white">Why we made TETRA</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          )}
          {c.id === 'listen' && (
            <div className="flex items-center justify-center gap-12">
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
          )}
        </Scene>
      ))}

      {/* The bar: where you are, and a menu to jump anywhere. */}
      <nav className={`absolute inset-x-0 bottom-0 z-20 flex h-24 items-center justify-center gap-7 px-8 transition-opacity duration-700 ${index === 0 ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        {chapters.slice(1).map((c, k) => {
          const i = k + 1;
          return (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation();
                go(i);
              }}
              className={`group flex flex-col items-center gap-2.5 ${focusRing}`}
            >
              <span className={`h-px transition-all duration-500 ${i === index ? 'w-10 bg-fg' : 'w-5 bg-white/25 group-hover:bg-white/60'}`} />
              <span className={`font-mono text-[10px] tracking-[0.2em] uppercase transition-colors duration-500 ${i === index ? 'text-fg' : 'text-white/30 group-hover:text-white/70'}`}>
                {c.name}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/**
 * One chapter. Its headline lands word by word on the beat, then the punch,
 * the line and any controls, a beat apart. Centred over the 3D stage, or on
 * the left with the game beside it.
 */
function Scene({ chapter, active, gameSide, children }: { chapter: Chapter; active: boolean; gameSide: boolean; children?: React.ReactNode }) {
  const beats = useBeats(active);
  // The opening waits for the mark to build before it speaks.
  const offset = chapter.id === 'welcome' ? 8 : 0;
  let k = 0;
  const lines = chapter.title.map((line) => line.split(' ').map((word) => ({ word, at: offset + k++ })));
  const after = offset + k;
  const shown = (at: number) => active && beats > at;
  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 z-10 flex flex-col justify-center transition-[opacity,filter] duration-700 ${active ? 'opacity-100' : 'pointer-events-none opacity-0 blur-[8px]'} ${
        gameSide ? 'items-start px-8 text-left sm:px-12 lg:pl-[7vw]' : 'items-center px-8 text-center'
      }`}
    >
      <h2
        className={`exp-kick font-[560] tracking-[-0.05em] ${gameSide ? 'max-w-[32vw] text-[clamp(40px,4.8vw,92px)] leading-[1.04]' : 'text-[clamp(48px,7.2vw,136px)] leading-[1.03]'}`}
      >
        {lines.map((words, li) => (
          <span key={li} className="block whitespace-nowrap">
            {words.map(({ word, at }, wi) => (
              <span key={wi} className={`kin-word ${shown(at) ? 'kin-in' : ''}`}>
                {word}
                {wi < words.length - 1 ? ' ' : ''}
              </span>
            ))}
          </span>
        ))}
      </h2>
      {chapter.punch && (
        <p className={`mt-4 text-[clamp(40px,4.8vw,92px)] leading-[1.04] font-[560] tracking-[-0.05em] text-white/45`}>
          <span className={`kin-word ${shown(after) ? 'kin-in' : ''}`}>{chapter.punch}</span>
        </p>
      )}
      {chapter.line && (
        <p
          className={`mt-8 max-w-[38ch] text-[clamp(16px,1.25vw,20px)] leading-relaxed text-white/55 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            shown(after + (chapter.punch ? 2 : 1)) ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
          }`}
        >
          {chapter.line}
        </p>
      )}
      {children && (
        <div
          className={`mt-12 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${shown(after + (chapter.punch ? 3 : 2)) ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
