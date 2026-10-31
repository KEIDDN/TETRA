import { BOTS, type BotProfile } from '@tetra/bot';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { computeDemoLayout, computeLayout, type Layout } from '../game/layout';

/** A phone held upright: your board fills the screen, the bot's sits small above it. */
const PORTRAIT = typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth < 720;
import { GameRenderer } from '../game/renderer';
import { resolveGrid, SKINS } from '../game/skins';
import { VersusSession, type SideStats, type VersusPhase, type VersusResult } from '../game/versusSession';
import { formatRate } from '../lib/format';
import { useMenuNav } from '../lib/nav';
import { NowPlaying } from '../ui/NowPlaying';
import { getSettings } from '../lib/settings';
import { findBot } from '../lib/customBots';
import { isUnlocked } from '../lib/versus';
import { ActionText } from '../ui/actionText';
import { BotEmblem } from '../ui/BotEmblem';
import { Glyph } from '../ui/Glyph';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** A tournament bout: no rematch, the result goes back to the bracket. */
export interface BoutContext {
  label: string;
  onResult: (score: [number, number]) => void;
}

export function VersusPlay({
  botId,
  profile,
  left,
  bout,
  firstTo,
  onExit,
  onNext,
}: {
  botId: string;
  /** Overrides the bot looked up by id (tournament clones). */
  profile?: BotProfile;
  /** Spectate: this bot plays the left board. */
  left?: BotProfile;
  bout?: BoutContext;
  firstTo: number;
  onExit: () => void;
  onNext?: (botId: string) => void;
}) {
  const bot = profile ?? findBot(botId) ?? BOTS[0];
  const next = bout || botId.startsWith('custom-') ? undefined : BOTS.find((b) => b.level === bot.level + 1);
  const leftName = left?.name ?? 'You';
  const leftColor = left?.color ?? '#edebfa';
  const boutRef = useRef(bout);
  boutRef.current = bout;
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
    let detachTouch: (() => void) | undefined;
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
          ghost: i === 0 && !left && appearance.ghost,
          grid: resolveGrid(appearance.grid, skin),
          ambient: i === 0 && appearance.ambient && appearance.fx !== 'off',
          background: appearance.background,
          reduceFlashing: appearance.reduceFlashing,
          sceneQuality: appearance.sceneQuality,
        });
        const host = hosts[i].current!;
        const relayout = () => {
          // On a phone the bot plays in a small window at the top: board and queue, no hold.
          const l = PORTRAIT && i === 1 ? computeDemoLayout(host.clientWidth, host.clientHeight) : computeLayout(host.clientWidth, host.clientHeight);
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
          result: (r) => {
            setResult(r);
            if (r) boutRef.current?.onResult(r.score);
          },
        },
        () => exitRef.current(),
        { left, tournament: !!bout },
      );
      if (!left && hosts[0].current) detachTouch = sessionRef.current.attachTouch(hosts[0].current, () => layoutRef.current[0]?.cell ?? 24);
    });

    // Each attack is a comet: it arcs from the sender's stack to the receiver's meter and lands with a ring.
    const launchBeam = (from: 0 | 1, lines: number) => {
      const layer = beamsRef.current;
      const src = layoutRef.current[from];
      const dst = layoutRef.current[1 - from];
      const srcHost = hosts[from].current?.getBoundingClientRect();
      const dstHost = hosts[1 - from].current?.getBoundingClientRect();
      if (!layer || !src || !dst || !srcHost || !dstHost) return;
      const sx = srcHost.left + src.boardX + src.boardW / 2;
      const sy = srcHost.top + src.boardY + src.boardH * 0.55;
      const tx = dstHost.left + dst.boardX - dst.cell * 0.5;
      const ty = dstHost.top + dst.boardY + dst.boardH * 0.85;
      const color = lines >= 8 ? '#ff453a' : lines >= 4 ? '#ffb84a' : from === 1 ? bot.color : leftColor;
      const width = 2 + Math.min(lines, 10) * 0.7;
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'comet');
      svg.style.color = color;
      const path = document.createElementNS(ns, 'path');
      const cx = (sx + tx) / 2;
      const cy = Math.min(sy, ty) - 120 - Math.min(lines, 10) * 10;
      path.setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', String(width));
      svg.append(path);
      const head = document.createElement('div');
      head.className = 'comet-head';
      head.style.setProperty('--c', color);
      head.style.width = head.style.height = `${8 + Math.min(lines, 10) * 1.6}px`;
      head.textContent = '';
      const label = document.createElement('div');
      label.className = 'comet-label';
      label.textContent = `+${lines}`;
      layer.append(svg, head, label);
      const length = path.getTotalLength();
      const tail = length * 0.32;
      path.style.strokeDasharray = `${tail} ${length + tail}`;
      const duration = 560;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const e = t * t * (3 - 2 * t);
        const at = e * length;
        path.style.strokeDashoffset = String(tail - at);
        const p = path.getPointAtLength(at);
        head.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        label.style.transform = `translate(${p.x}px, ${p.y - 22}px) translate(-50%, -50%)`;
        label.style.opacity = String(t < 0.15 ? t / 0.15 : 1 - Math.max(0, t - 0.75) / 0.25);
        if (t < 1) requestAnimationFrame(step);
        else {
          svg.remove();
          head.remove();
          label.remove();
          const ring = document.createElement('div');
          ring.className = 'comet-impact';
          ring.style.setProperty('--c', color);
          ring.style.transform = `translate(${tx}px, ${ty}px) translate(-50%, -50%)`;
          layer.append(ring);
          ring.addEventListener('animationend', () => ring.remove());
        }
      };
      requestAnimationFrame(step);
    };

    return () => {
      disposed = true;
      detachTouch?.();
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
          {phase === 'playing' ? 'Pause' : '← Menu'} <Glyph k="pause" className="label ml-2" />
        </button>
        <Scoreboard score={score} firstTo={firstTo} botName={bot.name} botColor={bot.color} leftName={leftName} leftColor={leftColor} />
        <span className="label justify-self-end max-sm:hidden">{bout ? `${bout.label} · ` : ''}First to {firstTo}</span>
      </header>

      <div className={`absolute inset-0 top-16 ${PORTRAIT ? '' : `grid ${left ? 'grid-cols-2' : 'grid-cols-[1.25fr_1fr]'}`}`}>
        <div ref={hosts[0]} className={PORTRAIT ? 'absolute inset-x-0 top-[30%] bottom-0' : 'relative'}>
          {you && (
            <>
              {left && (
                <div className="absolute flex items-center gap-3" style={{ left: you.holdX, top: you.boardY - 58 }}>
                  <BotEmblem bot={left} size={30} glow />
                  <span className="text-[18px] font-medium tracking-[-0.02em]">{left.name}</span>
                  <span className="label">Level {left.level}</span>
                </div>
              )}
              <div className="label absolute" style={{ left: you.holdX, top: you.boardY, width: you.sideW }}>
                Hold
              </div>
              <div className="label absolute" style={{ left: you.nextX, top: you.boardY, width: you.sideW }}>
                Next
              </div>
              <SideStatsColumn layout={you} refs={statRefs} offset={0} row={PORTRAIT} />
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
        {PORTRAIT && (
          <div className="absolute top-0 left-0 flex h-[30%] w-[45%] flex-col justify-center gap-3 pl-5">
            <div className="flex items-center gap-2.5">
              <BotEmblem bot={bot} size={26} glow />
              <span className="text-[17px] font-medium tracking-[-0.02em]">{bot.name}</span>
            </div>
            <div className="flex gap-4">
              {['PPS', 'APM', 'VS'].map((label, i) => (
                <div key={label}>
                  <div className="label mb-1">{label}</div>
                  <span ref={(el) => void (statRefs.current[3 + i] = el)} className="tabular text-[14px] font-medium leading-none">
                    0
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={hosts[1]} className={PORTRAIT ? 'absolute top-0 right-0 h-[30%] w-[55%] overflow-hidden' : 'relative'}>
          {them && !PORTRAIT && (
            <>
              <div className="absolute flex items-center gap-3" style={{ left: them.holdX, top: them.boardY - 58 }}>
                <BotEmblem bot={bot} size={30} glow />
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
            <div className="label">{left ? `${banner.winner === 0 ? left.name : bot.name} takes the round` : banner.winner === 0 ? 'Round won' : 'Round lost'}</div>
            <div className="tabular mt-3 text-[64px] leading-none font-medium tracking-[-0.05em]">
              {score[0]} — {score[1]}
            </div>
          </div>
        </div>
      )}

      {phase === 'paused' && (
        <Overlay>
          <span className="label">{bout?.label ?? 'Versus'} · {left ? `${left.name} vs ${bot.name}` : bot.name}</span>
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
          bot={bot}
          botName={bot.name}
          left={left}
          label={bout?.label}
          onRematch={bout ? undefined : () => sessionRef.current?.rematch()}
          onNext={next && onNext && result.won && isUnlocked(next) ? () => onNext(next.id) : undefined}
          nextName={next?.name}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function Scoreboard({
  score,
  firstTo,
  botName,
  botColor,
  leftName,
  leftColor,
}: {
  score: [number, number];
  firstTo: number;
  botName: string;
  botColor: string;
  leftName: string;
  leftColor: string;
}) {
  const dots = (won: number, color: string) =>
    Array.from({ length: firstTo }, (_, i) => (
      <span
        key={i}
        className="inline-block size-2 rounded-full transition-all duration-300 ease-spring"
        style={{ background: i < won ? color : 'rgba(255,255,255,0.15)', transform: i < won ? 'scale(1.25)' : undefined }}
      />
    ));
  return (
    <div className="flex items-center gap-5">
      <span className="label text-fg max-sm:hidden">{leftName}</span>
      <span className="flex gap-1.5">{dots(score[0], leftColor)}</span>
      <span className="tabular text-[15px] font-medium whitespace-nowrap">
        {score[0]}–{score[1]}
      </span>
      <span className="flex gap-1.5">{dots(score[1], botColor)}</span>
      <span className="label text-fg max-sm:hidden">{botName}</span>
    </div>
  );
}

function SideStatsColumn({
  layout,
  refs,
  offset,
  row = false,
}: {
  layout: Layout;
  refs: React.RefObject<(HTMLSpanElement | null)[]>;
  offset: number;
  /** Under the board in a row (phones) instead of a column beside it. */
  row?: boolean;
}) {
  const labels = ['PPS', 'APM', 'VS'];
  return (
    <div
      className={`absolute flex ${row ? 'flex-row justify-center gap-8 text-left' : 'flex-col items-end gap-4 text-right'}`}
      style={
        row
          ? { left: layout.boardX, top: layout.boardY + layout.boardH + layout.cell * 0.6, width: layout.boardW }
          : { right: layout.width - layout.holdX - layout.sideW, bottom: layout.height - layout.boardY - layout.boardH, width: layout.sideW * 1.6 }
      }
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
      <div className="animate-rise glass-panel w-full max-w-[520px] rounded-[40px] p-8 sm:p-10">{children}</div>
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
        primary ? 'glass-light font-semibold' : 'glass font-medium'
      }`}
    >
      {children} {hint && <span className="ml-1 font-mono text-[12px] opacity-50">{hint}</span>}
    </button>
  );
}

function Results({
  result,
  bot,
  botName,
  left,
  label,
  onRematch,
  onNext,
  nextName,
  onExit,
}: {
  result: VersusResult;
  bot: BotProfile;
  botName: string;
  left?: BotProfile;
  label?: string;
  onRematch?: () => void;
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
        <span className="label">{label ?? 'Versus'} · {left ? `${left.name} vs ${botName}` : botName}</span>
        {result.won && !left && <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-black">Victory</span>}
      </div>
      <div className="mt-6 flex items-center gap-5">
        <BotEmblem bot={left && result.won ? left : bot} size={64} glow />
        <div className="text-[48px] leading-none font-medium tracking-[-0.045em]">
          {left ? `${result.won ? left.name : botName} wins` : result.won ? 'You win' : `${botName} wins`}
        </div>
      </div>
      <div className="tabular mt-3 text-[15px] text-muted">
        {result.score[0]} — {result.score[1]}
      </div>

      <div className="mt-8 grid grid-cols-[1fr_auto_auto] gap-x-8 gap-y-2.5 border-t border-line pt-5">
        <span />
        <span className="label text-right">{left?.name ?? 'You'}</span>
        <span className="label text-right">{botName}</span>
        {rows.map(([label, fmt]) => (
          <Row key={label} label={label} a={fmt(result.stats[0])} b={fmt(result.stats[1])} />
        ))}
      </div>

      <AttackChart timeline={result.timeline} />

      <div className="mt-8 flex flex-wrap gap-3">
        {onRematch ? (
          <Pill primary onClick={onRematch} hint="R">
            Rematch
          </Pill>
        ) : (
          <Pill primary onClick={onExit} hint="Esc">
            Back to bracket
          </Pill>
        )}
        {onNext && <Pill onClick={onNext}>Next · {nextName}</Pill>}
        {onRematch && (
          <Pill onClick={onExit} hint="Esc">
            Menu
          </Pill>
        )}
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
      <NowPlaying />
    </div>
  );
}
