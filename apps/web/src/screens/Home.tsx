import type { ModeId } from '@tetra/engine';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { gamepads } from '../game/gamepad';
import { MODE_CONFIGS, MODE_ORDER } from '../game/modes';
import { PAD_NAMES } from '../lib/labels';
import { useMenuNav } from '../lib/nav';
import { loadBest } from '../lib/storage';

interface Mode {
  title: string;
  description: string;
  stat?: { label: string; value: string };
  onSelect?: () => void;
}

export function Home({ onPlay, onSettings }: { onPlay: (mode: ModeId) => void; onSettings: () => void }) {
  const padKind = useSyncExternalStore(
    (l) => gamepads.onStatus(l),
    () => gamepads.kind,
  );
  const firstRef = useRef<HTMLButtonElement>(null);
  useMenuNav();

  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);

  const solo: Mode[] = MODE_ORDER.map((id) => {
    const config = MODE_CONFIGS[id];
    const best = loadBest(id);
    return {
      title: config.def.name,
      description: config.description,
      stat: { label: 'Best', value: best ? config.formatRecord(best) : '—' },
      onSelect: () => onPlay(id),
    };
  });
  const versus: Mode[] = [{ title: 'Bots', description: 'Ten opponents, from Pebble to Zenith.' }];

  return (
    <div className="flex min-h-full flex-col px-5 sm:px-10">
      <header className="mx-auto flex h-20 w-full max-w-[1120px] items-center justify-between">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">TETRA</span>
        <button
          data-nav
          onClick={onSettings}
          className="hairline rounded-full bg-tile px-5 py-2 text-[14px] font-medium outline-none transition-transform duration-250 ease-spring hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Settings
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center py-10">
        <h1
          aria-label="TETRA"
          className="wordmark -ml-[0.06em] text-[clamp(84px,21vw,272px)] font-[480] leading-[0.82] tracking-[-0.06em]"
        >
          {[...'TETRA'].map((letter, i) => (
            <span key={i} aria-hidden style={{ animationDelay: `${i * 55}ms` }}>
              {letter}
            </span>
          ))}
        </h1>
        <p className="animate-rise mt-7 max-w-[34ch] text-[17px] leading-relaxed text-muted [animation-delay:60ms]">
          A minimal stacker built for practice. Fast, precise, quiet.
        </p>

        <div className="animate-rise mt-14 grid items-start gap-10 [animation-delay:120ms] md:grid-cols-[1fr_1fr] md:gap-6">
          <ModeGroup label="Solo" modes={solo} firstRef={firstRef} />
          <ModeGroup label="Versus" modes={versus} />
        </div>
      </main>

      <footer className="mx-auto flex h-20 w-full max-w-[1120px] items-center justify-between gap-4 border-t border-line">
        <span className="label">
          <span className="text-muted">↑ ↓</span> Choose <span className="ml-3 text-muted">Enter</span> Play
        </span>
        <span className="label text-right">
          {padKind ? (
            <>
              <span className="mr-2 inline-block size-1.5 rounded-full bg-[#30d158] align-middle" />
              {PAD_NAMES[padKind]}
            </>
          ) : (
            'v0.3'
          )}
        </span>
      </footer>
    </div>
  );
}

function ModeGroup({ label, modes, firstRef }: { label: string; modes: Mode[]; firstRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <section>
      <div className="label mb-3 px-1">{label}</div>
      <div className="hairline overflow-hidden rounded-[32px] bg-tile">
        {modes.map((mode, i) => (
          <ModeRow key={mode.title} mode={mode} first={i === 0} buttonRef={i === 0 ? firstRef : undefined} />
        ))}
      </div>
    </section>
  );
}

function ModeRow({ mode, first, buttonRef }: { mode: Mode; first: boolean; buttonRef?: React.Ref<HTMLButtonElement> }) {
  const available = !!mode.onSelect;
  return (
    <button
      ref={buttonRef}
      data-nav={available ? '' : undefined}
      disabled={!available}
      onClick={mode.onSelect}
      className={`group flex w-full items-center gap-6 px-7 py-6 text-left outline-none transition-colors duration-150 ${
        first ? '' : 'border-t border-line'
      } ${available ? 'hover:bg-white/[0.035] focus-visible:bg-white/[0.05]' : 'cursor-default'}`}
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
        <span className="text-[20px] text-muted transition-transform duration-250 ease-spring group-hover:translate-x-1 group-hover:text-fg group-focus-visible:translate-x-1 group-focus-visible:text-fg">
          →
        </span>
      )}
    </button>
  );
}
