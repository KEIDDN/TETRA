import { useEffect, useRef, useState } from 'react';
import { computeLayout, type Layout } from '../game/layout';
import { GameRenderer } from '../game/renderer';
import { SprintSession, type LiveStats, type SessionResult } from '../game/session';
import { formatRate, formatTime } from '../lib/format';

export function Play({ onExit }: { onExit: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const sessionRef = useRef<SprintSession | null>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLSpanElement>(null);
  const piecesRef = useRef<HTMLSpanElement>(null);
  const ppsRef = useRef<HTMLSpanElement>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    const host = hostRef.current!;
    let disposed = false;
    let renderer: GameRenderer | null = null;
    let observer: ResizeObserver | null = null;

    const setText = (el: HTMLElement | null, text: string) => {
      if (el && el.textContent !== text) el.textContent = text;
    };
    const showStats = (s: LiveStats) => {
      setText(timeRef.current, formatTime(s.time));
      setText(linesRef.current, String(s.lines));
      setText(piecesRef.current, String(s.pieces));
      setText(ppsRef.current, formatRate(s.pps));
    };

    GameRenderer.create(host).then((r) => {
      if (disposed) return r.destroy();
      renderer = r;
      const relayout = () => {
        const next = computeLayout(host.clientWidth, host.clientHeight);
        r.setLayout(next);
        setLayout(next);
      };
      relayout();
      observer = new ResizeObserver(relayout);
      observer.observe(host);
      sessionRef.current = new SprintSession(
        r,
        { countdown: setCountdown, stats: showStats, result: setResult },
        () => exitRef.current(),
      );
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      sessionRef.current?.dispose();
      sessionRef.current = null;
      renderer?.destroy();
    };
  }, []);

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
            style={{ right: layout.width - layout.holdX - layout.sideW, bottom: layout.height - layout.boardY - layout.boardH, width: layout.sideW * 1.6 }}
          >
            <Stat label="Lines">
              <span ref={linesRef}>0</span>
              <span className="text-faint">/40</span>
            </Stat>
            <Stat label="Pieces">
              <span ref={piecesRef}>0</span>
            </Stat>
            <Stat label="PPS">
              <span ref={ppsRef}>0.00</span>
            </Stat>
            <div>
              <div className="label mb-1">Time</div>
              <div ref={timeRef} className="tabular text-[clamp(22px,2.4vw,34px)] font-medium leading-none tracking-[-0.03em]">
                0:00.000
              </div>
            </div>
          </div>

          {countdown !== null && (
            <div
              className="pointer-events-none absolute grid place-items-center"
              style={{ left: layout.boardX, top: layout.boardY, width: layout.boardW, height: layout.boardH }}
            >
              <span key={countdown} className="animate-pop tabular text-[clamp(56px,7vw,96px)] font-medium tracking-[-0.04em]">
                {countdown}
              </span>
            </div>
          )}
        </>
      )}

      <header className="absolute inset-x-0 top-0 flex h-16 items-center justify-between px-6">
        <button tabIndex={-1}
          onClick={onExit}
          className="rounded-full px-4 py-2 text-[14px] font-medium text-muted transition-colors duration-150 hover:text-fg"
        >
          ← Menu <span className="label ml-2">Esc</span>
        </button>
        <span className="label">40 Lines</span>
        <span className="label">
          Retry <span className="text-muted">R</span>
        </span>
      </header>

      {result && <Result result={result} onRetry={() => sessionRef.current?.restart()} onExit={onExit} />}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="tabular text-[18px] font-medium leading-none">{children}</div>
    </div>
  );
}

function Result({ result, onRetry, onExit }: { result: SessionResult; onRetry: () => void; onExit: () => void }) {
  const pps = result.time > 0 ? result.pieces / (result.time / 1000) : 0;
  const kpp = result.pieces > 0 ? result.inputs / result.pieces : 0;
  const delta = result.previousBest !== null ? result.time - result.previousBest : null;

  return (
    <div className="absolute inset-0 grid place-items-center bg-black/80 px-4">
      <div className="animate-rise hairline w-full max-w-[440px] rounded-[40px] bg-[#0c0c0d] p-8 sm:p-10">
        <div className="flex items-center justify-between">
          <span className="label">40 Lines</span>
          {result.personalBest && (
            <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-black">Personal best</span>
          )}
        </div>

        {result.finished ? (
          <>
            <div className="tabular mt-6 text-[clamp(48px,12vw,72px)] font-medium leading-none tracking-[-0.045em]">
              {formatTime(result.time)}
            </div>
            {delta !== null && !result.personalBest && (
              <div className="tabular mt-3 text-[14px] text-muted">
                +{formatTime(delta)} <span className="text-faint">from best</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mt-6 text-[44px] font-medium leading-none tracking-[-0.035em]">Topped out</div>
            <div className="tabular mt-3 text-[14px] text-muted">
              {result.lines}/{result.lineGoal} lines
            </div>
          </>
        )}

        <dl className="mt-8 grid grid-cols-3 border-t border-line pt-5">
          <ResultStat label="PPS" value={formatRate(pps)} />
          <ResultStat label="Pieces" value={String(result.pieces)} />
          <ResultStat label="KPP" value={formatRate(kpp)} />
        </dl>

        <div className="mt-8 flex gap-3">
          <button tabIndex={-1}
            onClick={onRetry}
            className="flex-1 rounded-full bg-accent py-3.5 text-[16px] font-semibold text-black transition-transform duration-250 ease-spring hover:scale-[1.03] active:scale-[0.98]"
          >
            Retry <span className="ml-1 font-mono text-[12px] opacity-50">R</span>
          </button>
          <button tabIndex={-1}
            onClick={onExit}
            className="hairline flex-1 rounded-full bg-tile py-3.5 text-[16px] font-medium transition-transform duration-250 ease-spring hover:scale-[1.03] active:scale-[0.98]"
          >
            Menu <span className="ml-1 font-mono text-[12px] opacity-50">Esc</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tabular mt-1.5 text-[20px] font-medium">{value}</dd>
    </div>
  );
}
