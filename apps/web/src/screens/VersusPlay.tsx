import { BOTS } from '@tetra/bot';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { computeLayout, type Layout } from '../game/layout';
import { GameRenderer } from '../game/renderer';
import { resolveGrid, SKINS } from '../game/skins';
import { VersusSession, type SideStats, type VersusPhase, type VersusResult } from '../game/versusSession';
import { formatRate } from '../lib/format';
import { useMenuNav } from '../lib/nav';
import { getSettings } from '../lib/settings';
import { isUnlocked } from '../lib/versus';
import { ActionText } from '../ui/actionText';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

export function VersusPlay({
  botId,
  firstTo,
  onExit,
  onNext,
}: {
  botId: string;
  firstTo: number;
  onExit: () => void;
  onNext: (botId: string) => void;
}) {
  const bot = BOTS.find((b) => b.id === botId) ?? BOTS[0];
  const next = BOTS.find((b) => b.level === bot.level + 1);
  const hosts = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const [layouts, setLayouts] = useState<[Layout | null, Layout | null]>([null, null]);
  const layoutRef = useRef<[Layout | null, Layout | null]>([null, null]);
  const [phase, setPhase] = useState<VersusPhase>('countdown');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [banner, setBanner] = useState<{ winner: 0 | 1; key: number } | null>(null);
  const [result, setResult] = useState<VersusResult | null>(null);
  const sessionRef = useRef<VersusSession | null>(null);
  const beamsRef = useRef<HTMLDivElement>(null);
  const statRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const actionSide = useRef<HTMLDivElement>(null);
  const actionCenter = useRef<HTMLDivElement>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useMenuNav(undefined, phase === 'paused' || phase === 'done');

  useEffect(() => {
    let disposed = false;
    const renderers: GameRenderer[] = [];
    const observers: ResizeObserver[] = [];
    const { appearance } = getSettings();
    const skin = SKINS[appearance.skin];
    let actions: ActionText | null = null;
    const callouts = () => {
      if (!actions && appearance.actionText && actionSide.current && actionCenter.current) actions = new ActionText(actionSide.current, actionCenter.current);
      return actions;
    };

    Promise.all(hosts.map((h) => GameRenderer.create(h.current!))).then((rs) => {
      if (disposed) return rs.forEach((r) => r.destroy());
      renderers.push(...rs);
      rs.forEach((r, i) => {
        r.setOptions({
          skin,
          fx: appearance.fx,
          smoothFall: appearance.smoothFall,
          ghost: i === 0 && appearance.ghost,
          grid: resolveGrid(appearance.grid, skin),
          ambient: i === 0 && appearance.ambient && appearance.fx !== 'off',
        });
        const host = hosts[i].current!;
        const relayout = () => {
          const l = computeLayout(host.clientWidth, host.clientHeight);
          r.setLayout(l);
          layoutRef.current[i] = l;
          setLayouts([...layoutRef.current] as [Layout | null, Layout | null]);
        };
        relayout();
        const o = new ResizeObserver(relayout);
        o.observe(host);
        observers.push(o);
      });
      const setText = (el: HTMLElement | null | undefined, text: string) => {
        if (el && el.textContent !== text) el.textContent = text;
      };
      sessionRef.current = new VersusSession(
        bot,
        firstTo,
        [rs[0], rs[1]],
        {
          reset: () => {
            callouts()?.reset();
            setBanner(null);
          },
          phase: setPhase,
          countdown: setCountdown,
          score: setScore,
          round: (winner, s) => {
            setScore(s);
            setBanner({ winner, key: Date.now() });
          },
          stats: (stats: [SideStats, SideStats]) => {
            stats.forEach((s, i) => {
              setText(statRefs.current[i * 3], formatRate(s.pps));
              setText(statRefs.current[i * 3 + 1], s.apm.toFixed(1));
              setText(statRefs.current[i * 3 + 2], s.vs.toFixed(1));
            });
          },
          attack: (from, lines) => launchBeam(from, lines),
          event: (e, game, player) => {
            if (player !== 0) return;
            if (e.type === 'clear') callouts()?.clear(e.info, skin.palette(game.stats.level)[e.info.piece]);
          },
          result: setResult,
        },
        () => exitRef.current(),
      );
    });

    // A small capsule of light carries each attack across to the opponent's meter.
    const launchBeam = (from: 0 | 1, lines: number) => {
      const layer = beamsRef.current;
      const src = layoutRef.current[from];
      const dst = layoutRef.current[1 - from];
      const srcHost = hosts[from].current?.getBoundingClientRect();
      const dstHost = hosts[1 - from].current?.getBoundingClientRect();
      if (!layer || !src || !dst || !srcHost || !dstHost) return;
      const sx = srcHost.left + src.boardX + src.boardW / 2;
      const sy = srcHost.top + src.boardY + src.boardH * 0.6;
      const tx = dstHost.left + dst.boardX - dst.cell * 0.5;
      const ty = dstHost.top + dst.boardY + dst.boardH * 0.85;
      const el = document.createElement('div');
      el.className = 'beam';
      el.textContent = `+${lines}`;
      layer.append(el);
      const anim = el.animate(
        [
          { transform: `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(0.6)`, opacity: 0 },
          { transform: `translate(${sx}px, ${sy - 30}px) translate(-50%, -50%) scale(1)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(0.7)`, opacity: 0.9 },
        ],
        { duration: 520, easing: 'cubic-bezier(0.55, 0, 0.75, 0.4)' },
      );
      anim.onfinish = () => el.remove();
    };

    return () => {
      disposed = true;
      observers.forEach((o) => o.disconnect());
      sessionRef.current?.dispose();
      sessionRef.current = null;
      renderers.forEach((r) => r.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, firstTo]);

  useEffect(() => {
    if (phase !== 'paused') return;
    const onKey = (e: KeyboardEvent) => e.code === 'KeyQ' && onExit();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onExit]);

  const [you, them] = layouts;

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black">
      <header className="absolute inset-x-0 top-0 z-10 grid h-16 grid-cols-[1fr_auto_1fr] items-center px-6">
        <button
          tabIndex={-1}
          onClick={() => (phase === 'playing' ? sessionRef.current?.pause() : onExit())}
          className="justify-self-start rounded-full px-4 py-2 text-[14px] font-medium text-muted transition-colors hover:text-fg"
        >
          {phase === 'playing' ? 'Pause' : '← Menu'} <span className="label ml-2">Esc</span>
        </button>
        <Scoreboard score={score} firstTo={firstTo} botName={bot.name} />
        <span className="label justify-self-end">First to {firstTo}</span>
      </header>

      <div className="absolute inset-0 top-16 grid grid-cols-[1.25fr_1fr]">
        <div ref={hosts[0]} className="relative">
          {you && (
            <>
              <div className="label absolute" style={{ left: you.holdX, top: you.boardY, width: you.sideW }}>
                Hold
              </div>
              <div className="label absolute" style={{ left: you.nextX, top: you.boardY, width: you.sideW }}>
                Next
              </div>
              <SideStatsColumn layout={you} refs={statRefs} offset={0} />
              <div
                ref={actionSide}
                className="action-stack pointer-events-none absolute"
                style={{ right: you.width - you.holdX - you.sideW, top: you.boardY + you.boardH * 0.24, width: you.sideW * 2 }}
              />
              <div ref={actionCenter} className="pointer-events-none absolute" style={{ left: you.boardX, top: you.boardY, width: you.boardW, height: you.boardH }} />
              {countdown !== null && (
                <div className="pointer-events-none absolute grid place-items-center" style={{ left: you.boardX, top: you.boardY, width: you.boardW, height: you.boardH }}>
                  <span key={countdown} className={`animate-pop font-medium tracking-[-0.04em] ${countdown === 0 ? 'text-[56px] text-accent' : 'tabular text-[80px]'}`}>
                    {countdown === 0 ? 'Go' : countdown}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div ref={hosts[1]} className="relative">
          {them && (
            <>
              <div className="absolute flex items-baseline gap-3" style={{ left: them.boardX, top: them.boardY - 34 }}>
                <span className="text-[18px] font-medium tracking-[-0.02em]">{bot.name}</span>
                <span className="label">Level {bot.level}</span>
              </div>
              <div className="label absolute" style={{ left: them.holdX, top: them.boardY, width: them.sideW }}>
                Hold
              </div>
              <div className="label absolute" style={{ left: them.nextX, top: them.boardY, width: them.sideW }}>
                Next
              </div>
              <SideStatsColumn layout={them} refs={statRefs} offset={3} />
            </>
          )}
        </div>
      </div>

      <div ref={beamsRef} className="pointer-events-none fixed inset-0 z-20" />

      {banner && phase === 'roundOver' && (
        <div key={banner.key} className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="animate-pop text-center">
            <div className="label">{banner.winner === 0 ? 'Round won' : 'Round lost'}</div>
            <div className="tabular mt-3 text-[64px] leading-none font-medium tracking-[-0.05em]">
              {score[0]} — {score[1]}
            </div>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <Overlay>
          <span className="label">Versus · {bot.name}</span>
          <div className="mt-6 text-[44px] leading-none font-medium tracking-[-0.035em]">Paused</div>
          <div className="mt-8 flex flex-col gap-3">
            <Pill primary onClick={() => sessionRef.current?.resume()} hint="Esc">
              Resume
            </Pill>
            <Pill onClick={onExit} hint="Q">
              Menu
            </Pill>
          </div>
        </Overlay>
      )}

      {result && (
        <Results
          result={result}
          botName={bot.name}
          onRematch={() => sessionRef.current?.rematch()}
          onNext={next && result.won && isUnlocked(next) ? () => onNext(next.id) : undefined}
          nextName={next?.name}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function Scoreboard({ score, firstTo, botName }: { score: [number, number]; firstTo: number; botName: string }) {
  const dots = (won: number) =>
    Array.from({ length: firstTo }, (_, i) => (
      <span key={i} className={`inline-block size-2 rounded-full transition-colors duration-300 ${i < won ? 'bg-accent' : 'bg-white/15'}`} />
    ));
  return (
    <div className="flex items-center gap-5">
      <span className="label text-fg">You</span>
      <span className="flex gap-1.5">{dots(score[0])}</span>
      <span className="tabular text-[15px] font-medium">
        {score[0]}–{score[1]}
      </span>
      <span className="flex gap-1.5">{dots(score[1])}</span>
      <span className="label text-fg">{botName}</span>
    </div>
  );
}

function SideStatsColumn({ layout, refs, offset }: { layout: Layout; refs: React.RefObject<(HTMLSpanElement | null)[]>; offset: number }) {
  const labels = ['PPS', 'APM', 'VS'];
  return (
    <div
      className="absolute flex flex-col items-end gap-4 text-right"
      style={{ right: layout.width - layout.holdX - layout.sideW, bottom: layout.height - layout.boardY - layout.boardH, width: layout.sideW * 1.6 }}
    >
      {labels.map((label, i) => (
        <div key={label}>
          <div className="label mb-1">{label}</div>
          <span ref={(el) => void (refs.current[offset + i] = el)} className="tabular text-[17px] font-medium leading-none">
            0
          </span>
        </div>
      ))}
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/80 px-4">
      <div className="animate-rise hairline w-full max-w-[520px] rounded-[40px] bg-[#0c0c0d] p-8 sm:p-10">{children}</div>
    </div>
  );
}

function Pill({ children, onClick, hint, primary }: { children: ReactNode; onClick: () => void; hint?: string; primary?: boolean }) {
  return (
    <button
      tabIndex={-1}
      data-nav
      onClick={onClick}
      className={`flex-1 rounded-full py-3.5 text-[16px] transition-transform duration-250 ease-spring hover:scale-[1.03] active:scale-[0.98] ${focusRing} ${
        primary ? 'bg-accent font-semibold text-black' : 'hairline bg-tile font-medium'
      }`}
    >
      {children} {hint && <span className="ml-1 font-mono text-[12px] opacity-50">{hint}</span>}
    </button>
  );
}

function Results({
  result,
  botName,
  onRematch,
  onNext,
  nextName,
  onExit,
}: {
  result: VersusResult;
  botName: string;
  onRematch: () => void;
  onNext?: () => void;
  nextName?: string;
  onExit: () => void;
}) {
  const rows: [string, (s: SideStats) => string][] = [
    ['PPS', (s) => formatRate(s.pps)],
    ['APM', (s) => s.apm.toFixed(1)],
    ['VS', (s) => s.vs.toFixed(1)],
    ['Attack', (s) => String(s.attack)],
    ['Pieces', (s) => String(s.pieces)],
  ];
  return (
    <Overlay>
      <div className="flex items-center justify-between">
        <span className="label">Versus · {botName}</span>
        {result.won && <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-black">Victory</span>}
      </div>
      <div className="mt-6 text-[52px] leading-none font-medium tracking-[-0.045em]">{result.won ? 'You win' : `${botName} wins`}</div>
      <div className="tabular mt-3 text-[15px] text-muted">
        {result.score[0]} — {result.score[1]}
      </div>

      <div className="mt-8 grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-2.5 border-t border-line pt-5">
        <span />
        <span className="label text-right">You</span>
        <span className="label text-right">{botName}</span>
        {rows.map(([label, fmt]) => (
          <Row key={label} label={label} a={fmt(result.stats[0])} b={fmt(result.stats[1])} />
        ))}
      </div>

      <AttackChart timeline={result.timeline} />

      <div className="mt-8 flex flex-wrap gap-3">
        <Pill primary onClick={onRematch} hint="R">
          Rematch
        </Pill>
        {onNext && <Pill onClick={onNext}>Next · {nextName}</Pill>}
        <Pill onClick={onExit} hint="Esc">
          Menu
        </Pill>
      </div>
    </Overlay>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <>
      <span className="label self-center">{label}</span>
      <span className="tabular text-right text-[16px] font-medium">{a}</span>
      <span className="tabular text-right text-[16px] text-muted">{b}</span>
    </>
  );
}

/** Cumulative attack over the match: you in accent, the bot in grey. */
function AttackChart({ timeline }: { timeline: VersusResult['timeline'] }) {
  if (timeline.length < 2) return null;
  const w = 440;
  const h = 110;
  const maxT = timeline[timeline.length - 1].t;
  const maxA = Math.max(1, ...timeline.map((p) => Math.max(...p.sent)));
  const line = (i: 0 | 1) =>
    timeline.map((p, k) => `${k ? 'L' : 'M'}${((p.t / maxT) * w).toFixed(1)},${(h - (p.sent[i] / maxA) * h).toFixed(1)}`).join(' ');
  return (
    <div className="mt-8">
      <div className="mb-2 flex justify-between">
        <span className="label">Attack over time</span>
        <span className="label tabular">{Math.round(maxT / 1000)}s</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[110px] w-full overflow-visible" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke="rgba(255,255,255,0.06)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={line(1)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={line(0)} fill="none" stroke="#edebfa" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
