import type { ModeId } from '@tetra/engine';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { computeLayout, type Layout } from '../game/layout';
import { MODE_CONFIGS, type StatKey } from '../game/modes';
import { GameRenderer } from '../game/renderer';
import { resolveGrid, SKINS } from '../game/skins';
import { ActionText } from '../ui/actionText';
import { getSettings } from '../lib/settings';
import { GameSession, type LiveStats, type Phase, type SessionResult } from '../game/session';
import { formatRate, formatTime } from '../lib/format';
import { useMenuNav } from '../lib/nav';
import { NowPlaying } from '../ui/NowPlaying';
import { music } from '../audio/music';
import { LevelRing } from '../ui/LevelRing';
import { Sparkline } from '../ui/Sparkline';
import { levelFor } from '../lib/profile';
import { loadHistory } from '../lib/storage';
import { Glyph } from '../ui/Glyph';

const STAT_LABELS: Record<StatKey, string> = { lines: 'Lines', pieces: 'Pieces', pps: 'PPS', score: 'Score', level: 'Level' };

function statText(key: StatKey, s: LiveStats): string {
  switch (key) {
    case 'pps':
      return formatRate(s.pps);
    case 'score':
      return s.score.toLocaleString('en-US');
    default:
      return String(s[key]);
  }
}

export function Play({ mode, onExit, intro = true }: { mode: ModeId; onExit: () => void; intro?: boolean }) {
  const config = MODE_CONFIGS[mode];
  const lineGoal = config.def.rules.lineGoal ?? null;
  const hostRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [result, setResult] = useState<SessionResult | null>(null);
  const [introCard, setIntroCard] = useState(false);
  const sessionRef = useRef<GameSession | null>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const statRefs = useRef<Partial<Record<StatKey, HTMLSpanElement | null>>>({});
  const actionSideRef = useRef<HTMLDivElement>(null);
  const actionCenterRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useMenuNav(undefined, phase === 'paused' || phase === 'done');

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let renderer: GameRenderer | null = null;
    let observer: ResizeObserver | null = null;

    const setText = (el: HTMLElement | null | undefined, text: string) => {
      if (el && el.textContent !== text) el.textContent = text;
    };
    const showStats = (s: LiveStats) => {
      setText(clockRef.current, formatTime(s.clock));
      for (const key of config.stats) setText(statRefs.current[key], statText(key, s));
    };

    const { appearance } = getSettings();
    const skin = SKINS[appearance.skin];
    let actions: ActionText | null = null;

    GameRenderer.create(host).then((r) => {
      if (disposed) return r.destroy();
      renderer = r;
      r.setOptions({
        skin,
        fx: appearance.fx,
        smoothFall: appearance.smoothFall,
        ghost: appearance.ghost,
        grid: resolveGrid(appearance.grid, skin),
        ambient: appearance.ambient && appearance.fx !== 'off',
        background: appearance.background,
        reduceFlashing: appearance.reduceFlashing,
        sceneQuality: appearance.sceneQuality,
      });
      const relayout = () => {
        const next = computeLayout(host.clientWidth, host.clientHeight);
        r.setLayout(next);
        setLayout(next);
      };
      relayout();
      observer = new ResizeObserver(relayout);
      observer.observe(host);
      // The overlay containers mount with the first layout, so create the callouts on first use.
      const callouts = () => {
        if (!actions && appearance.actionText && actionSideRef.current && actionCenterRef.current) {
          actions = new ActionText(actionSideRef.current, actionCenterRef.current);
        }
        return actions;
      };
      sessionRef.current = new GameSession(
        mode,
        r,
        {
          reset: () => callouts()?.reset(),
          event: (e, game) => {
            if (e.type === 'clear') callouts()?.clear(e.info, skin.palette(game.stats.level)[e.info.piece]);
            else if (e.type === 'levelUp') callouts()?.levelUp(e.level);
          },
          countdown: setCountdown,
          intro: setIntroCard,
          phase: setPhase,
          stats: showStats,
          result: setResult,
        },
        () => exitRef.current(),
        intro,
      );
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      sessionRef.current?.dispose();
      sessionRef.current = null;
      renderer?.destroy();
    };
  }, [mode, config]);

  useEffect(() => {
    if (phase !== 'paused') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onExit]);

  const retry = () => sessionRef.current?.restart();

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <div ref={hostRef} className="absolute inset-0" />

      {layout && (
        <>
          <div className="label absolute" style={{ left: layout.holdX, top: layout.boardY, width: layout.sideW }}>
            Hold
          </div>
          <div className="label absolute" style={{ left: layout.nextX, top: layout.boardY, width: layout.sideW }}>
            Next
          </div>

          <div
            className="absolute flex flex-col items-end gap-5 text-right"
            style={{
              right: layout.width - layout.holdX - layout.sideW,
              bottom: layout.height - layout.boardY - layout.boardH,
              width: layout.sideW * 1.8,
            }}
          >
            {config.stats.map((key) => (
              <Stat key={key} label={STAT_LABELS[key]}>
                <span ref={(el) => void (statRefs.current[key] = el)}>0</span>
                {key === 'lines' && lineGoal !== null && <span className="text-faint">/{lineGoal}</span>}
              </Stat>
            ))}
            <div>
              <div className="label mb-1">{config.clock === 'down' ? 'Time left' : 'Time'}</div>
              <div ref={clockRef} className="tabular text-[clamp(22px,2.4vw,34px)] font-medium leading-none tracking-[-0.03em]">
                0:00.000
              </div>
            </div>
          </div>

          <div
            ref={actionSideRef}
            className="action-stack pointer-events-none absolute"
            style={{ right: layout.width - layout.holdX - layout.sideW, top: layout.boardY + layout.boardH * 0.24, width: layout.sideW * 2 }}
          />
          <div
            ref={actionCenterRef}
            className="pointer-events-none absolute"
            style={{ left: layout.boardX, top: layout.boardY, width: layout.boardW, height: layout.boardH }}
          />

          {countdown !== null && (
            <div
              className="pointer-events-none absolute grid place-items-center"
              style={{ left: layout.boardX, top: layout.boardY, width: layout.boardW, height: layout.boardH }}
            >
              <span
                key={countdown}
                className={`animate-pop font-medium tracking-[-0.04em] ${
                  countdown === 0 ? 'text-[clamp(44px,5.5vw,76px)] text-accent' : 'tabular text-[clamp(56px,7vw,96px)]'
                }`}
              >
                {countdown === 0 ? 'Go' : countdown}
              </span>
            </div>
          )}
        </>
      )}

      <header className="absolute inset-x-0 top-0 flex h-16 items-center justify-between px-6">
        <button
          tabIndex={-1}
          onClick={() => (phase === 'playing' ? sessionRef.current?.pause() : onExit())}
          className="rounded-full px-4 py-2 text-[14px] font-medium text-muted transition-colors duration-150 hover:text-fg"
        >
          {phase === 'playing' ? 'Pause' : '← Menu'} <Glyph k="pause" className="label ml-2" />
        </button>
        <span className="label">{config.def.name}</span>
        <span className="label">
          Retry <Glyph k="retry" className="text-muted" />
        </span>
      </header>

      {phase === 'paused' && (
        <Overlay>
          <span className="label">{config.def.name}</span>
          <div className="mt-6 text-[44px] font-medium leading-none tracking-[-0.035em]">Paused</div>
          <div className="mt-8 flex flex-col gap-3">
            <PillButton primary onClick={() => sessionRef.current?.resume()} hint="Esc">
              Resume
            </PillButton>
            <PillButton onClick={retry} hint="R">
              Retry
            </PillButton>
            <PillButton onClick={onExit} hint="Q">
              Menu
            </PillButton>
          </div>
        </Overlay>
      )}

      <IntroCard title={config.def.name} on={introCard} />
      {result && <Result result={result} onRetry={retry} onExit={onExit} />}
    </div>
  );
}

/**
 * The opening of a game: the mode's name and the set about to drop, centred
 * over the board as it assembles, breathing with the kick.
 */
function IntroCard({ title, on }: { title: string; on: boolean }) {
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (on) {
      setShown(true);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    setLeaving(true);
    const t = setTimeout(() => setShown(false), 420);
    return () => clearTimeout(t);
    // Only on/off edges matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  useEffect(() => {
    if (!shown) return;
    let raf = 0;
    const tick = () => {
      ref.current?.style.setProperty('--kick', music.analyse().kick.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown]);
  if (!shown) return null;
  const track = music.current;
  return (
    <div className={`intro-card pointer-events-none absolute inset-0 z-10 grid place-items-center ${leaving ? 'intro-card-out' : ''}`}>
      <div ref={ref} className="intro-card-body text-center">
        <div className="intro-kicker label">Now entering</div>
        <div className="intro-title mt-3 text-[clamp(56px,8vw,128px)] leading-[1.02] font-[560] tracking-[-0.05em]">{title}</div>
        {track && (
          <div className="intro-track glass-panel mt-8 inline-flex items-center gap-3 rounded-full px-5 py-2.5">
            <span className="now-playing-bars" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="text-[14px] font-medium tracking-[-0.01em]">{track.title}</span>
            <span className="text-[13px] text-faint">{track.artist}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="tabular text-[18px] font-medium leading-none">{children}</div>
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/80 px-4">
      <div className="animate-rise glass-panel w-full max-w-[440px] rounded-[40px] p-8 sm:p-10">{children}</div>
      <NowPlaying />
    </div>
  );
}

function PillButton({ children, onClick, hint, primary }: { children: ReactNode; onClick: () => void; hint: string; primary?: boolean }) {
  return (
    <button
      tabIndex={-1}
      data-nav
      onClick={onClick}
      className={`flex-1 rounded-full py-3.5 text-[16px] transition-transform duration-250 ease-spring outline-none hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-accent/70 active:scale-[0.98] ${
        primary ? 'glass-light font-semibold' : 'glass font-medium'
      }`}
    >
      {children} <span className="ml-1 font-mono text-[12px] opacity-50">{hint}</span>
    </button>
  );
}

/** Counts from 0 up to `target` with an ease-out, once. */
function useCountUp(target: number, ms: number, delay = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return value;
}

/** XP pours into the level ring; a level up fills it, flips the number and starts again. */
function XpRing({ before, gained }: { before: number; gained: number }) {
  const total = useCountUp(gained, 1100, 700);
  const now = levelFor(before + total);
  return (
    <div className="flex items-center gap-4">
      <LevelRing level={now.level} progress={now.into / now.needed} size={52} />
      <div>
        <div className="tabular text-[18px] font-medium">+{Math.round(total)} XP</div>
        <div className="label mt-0.5">{now.needed - Math.round(now.into)} to level {now.level + 1}</div>
      </div>
    </div>
  );
}

function Result({ result, onRetry, onExit }: { result: SessionResult; onRetry: () => void; onExit: () => void }) {
  const config = MODE_CONFIGS[result.mode];
  const r = result.record;
  const pps = r.time > 0 ? r.pieces / (r.time / 1000) : 0;
  const kpp = r.pieces > 0 ? r.inputs / r.pieces : 0;
  const timed = result.mode === 'sprint';
  const lineGoal = config.def.rules.lineGoal;
  const counted = useCountUp(timed ? r.time : r.score, 900);
  const history = loadHistory(result.mode);
  const values = history.map((h) => (timed ? h.time : h.score));
  const prev = result.previousBest;

  let headline: string;
  let subline: string | null = null;
  if (timed) {
    headline = result.finished ? formatTime(counted) : 'Topped out';
    if (!result.finished) subline = `${r.lines}/${lineGoal} lines`;
  } else {
    headline = Math.round(counted).toLocaleString('en-US');
    const status = result.finished ? (result.mode === 'marathon' ? 'Complete' : "Time's up") : 'Topped out';
    subline = `${status} · Level ${r.level} · ${r.lines} lines`;
  }
  // The delta against the best before this run: negative time and positive score are good.
  let delta: { text: string; good: boolean } | null = null;
  if (prev && (!timed || result.finished)) {
    if (timed) {
      const d = r.time - prev.time;
      delta = { text: `${d < 0 ? '−' : '+'}${formatTime(Math.abs(d))}`, good: d < 0 };
    } else {
      const d = r.score - prev.score;
      delta = { text: `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('en-US')}`, good: d > 0 };
    }
  }

  const stats: [string, string][] = timed
    ? [
        ['PPS', formatRate(pps)],
        ['Pieces', String(r.pieces)],
        ['KPP', formatRate(kpp)],
      ]
    : [
        ['Time', formatTime(r.time)],
        ['PPS', formatRate(pps)],
        ['Best', result.personalBest ? 'New' : prev ? config.formatRecord(prev) : '—'],
      ];

  return (
    <Overlay>
      <div className="flex items-center justify-between">
        <span className="label">{config.def.name}</span>
        {result.personalBest && <span className="glass-light animate-pop rounded-full px-3 py-1 text-[12px] font-semibold [animation-delay:700ms]">Personal best</span>}
      </div>
      <div
        className={`mt-6 font-medium leading-none ${
          timed && !result.finished ? 'text-[44px] tracking-[-0.035em]' : 'tabular text-[clamp(44px,11vw,68px)] tracking-[-0.045em]'
        }`}
      >
        {headline}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {subline && <span className="tabular text-[14px] text-muted">{subline}</span>}
        {delta && (
          <span className={`animate-rise tabular shrink-0 rounded-full px-2.5 py-0.5 text-[12px] whitespace-nowrap font-semibold [animation-delay:900ms] ${delta.good ? 'bg-[#30d158]/15 text-[#30d158]' : 'bg-white/[0.06] text-muted'}`}>
            {delta.text} vs best
          </span>
        )}
      </div>

      {values.length >= 2 && (
        <div className="animate-fade [animation-delay:500ms]">
          <Sparkline values={values} lowerIsBetter={timed} mark={values.length - 1} height={56} />
        </div>
      )}

      <dl className="mt-6 grid grid-cols-3 border-t border-line pt-5">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="label">{label}</dt>
            <dd className="tabular mt-1.5 text-[18px] font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {result.xp > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <XpRing before={result.xpBefore} gained={result.xp} />
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <PillButton primary onClick={onRetry} hint="R">
          Retry
        </PillButton>
        <PillButton onClick={onExit} hint="Esc">
          Menu
        </PillButton>
      </div>
    </Overlay>
  );
}
