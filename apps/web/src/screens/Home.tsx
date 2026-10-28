import { useEffect } from 'react';
import { formatTime } from '../lib/format';
import { loadSprintBest } from '../lib/storage';

interface Mode {
  title: string;
  description: string;
  stat?: { label: string; value: string };
  onSelect?: () => void;
}

export function Home({ onPlay }: { onPlay: () => void }) {
  const best = loadSprintBest();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && !e.repeat) onPlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPlay]);

  const solo: Mode[] = [
    {
      title: '40 Lines',
      description: 'Clear forty lines as fast as you can.',
      stat: { label: 'Best', value: best ? formatTime(best.time) : '—' },
      onSelect: onPlay,
    },
    { title: 'Blitz', description: 'Two minutes. Score as much as you can.' },
    { title: 'Marathon', description: 'One hundred fifty lines across fifteen levels.' },
  ];
  const versus: Mode[] = [{ title: 'Bots', description: 'Ten opponents, from Pebble to Zenith.' }];

  return (
    <div className="flex min-h-full flex-col px-5 sm:px-10">
      <header className="mx-auto flex h-20 w-full max-w-[1120px] items-center justify-between">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">TETRA</span>
        <span className="label">v0.1</span>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center py-10">
        <h1 className="animate-rise -ml-[0.06em] text-[clamp(84px,21vw,272px)] font-[480] leading-[0.82] tracking-[-0.06em]">
          TETRA
        </h1>
        <p className="animate-rise mt-7 max-w-[34ch] text-[17px] leading-relaxed text-muted [animation-delay:60ms]">
          A minimal stacker built for practice. Fast, precise, quiet.
        </p>

        <div className="animate-rise mt-14 grid gap-10 [animation-delay:120ms] md:grid-cols-[1fr_1fr] md:gap-6">
          <ModeGroup label="Solo" modes={solo} />
          <ModeGroup label="Versus" modes={versus} />
        </div>
      </main>

      <footer className="mx-auto flex h-20 w-full max-w-[1120px] items-center justify-between border-t border-line">
        <span className="label">
          <span className="text-muted">Enter</span> Play 40 Lines
        </span>
        <span className="label">Keyboard · Controller soon</span>
      </footer>
    </div>
  );
}

function ModeGroup({ label, modes }: { label: string; modes: Mode[] }) {
  return (
    <section>
      <div className="label mb-3 px-1">{label}</div>
      <div className="hairline overflow-hidden rounded-[32px] bg-tile">
        {modes.map((mode, i) => (
          <ModeRow key={mode.title} mode={mode} first={i === 0} />
        ))}
      </div>
    </section>
  );
}

function ModeRow({ mode, first }: { mode: Mode; first: boolean }) {
  const available = !!mode.onSelect;
  return (
    <button
      disabled={!available}
      onClick={mode.onSelect}
      className={`group flex w-full items-center gap-6 px-7 py-6 text-left transition-colors duration-150 ${
        first ? '' : 'border-t border-line'
      } ${available ? 'hover:bg-white/[0.035]' : 'cursor-default'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className={`text-[22px] font-medium tracking-[-0.02em] ${available ? '' : 'text-faint'}`}>{mode.title}</span>
          {!available && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-faint shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
              Soon
            </span>
          )}
        </div>
        <div className={`mt-1 text-[14px] ${available ? 'text-muted' : 'text-faint'}`}>{mode.description}</div>
      </div>
      {mode.stat && (
        <div className="text-right">
          <div className="label">{mode.stat.label}</div>
          <div className="tabular mt-1 text-[17px] font-medium">{mode.stat.value}</div>
        </div>
      )}
      {available && (
        <span className="text-[20px] text-muted transition-transform duration-250 ease-spring group-hover:translate-x-1 group-hover:text-fg">
          →
        </span>
      )}
    </button>
  );
}
