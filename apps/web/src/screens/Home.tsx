import type { ModeId } from '@tetra/engine';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { gamepads } from '../game/gamepad';
import { MODE_CONFIGS, MODE_ORDER } from '../game/modes';
import { SKINS } from '../game/skins';
import { PAD_NAMES } from '../lib/labels';
import { useMenuNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { loadBest } from '../lib/storage';
import { DemoBoard } from '../ui/DemoBoard';

type SettingsTab = 'appearance' | 'sound' | 'controls';

const NUMERALS: Record<ModeId, string> = { sprint: '40', blitz: '2:00', marathon: '150', endless: '∞' };
const BOTS = ['Pebble', 'Drift', 'Stack', 'Tempo', 'Pivot', 'Rift', 'Vector', 'Prism', 'Apex', 'Zenith'];

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

export function Home({ onPlay, onSettings }: { onPlay: (mode: ModeId) => void; onSettings: (tab?: SettingsTab) => void }) {
  const padKind = useSyncExternalStore(
    (l) => gamepads.onStatus(l),
    () => gamepads.kind,
  );
  const { appearance } = useSettings();
  const ctaRef = useRef<HTMLButtonElement>(null);
  const modesRef = useRef<HTMLElement>(null);
  useMenuNav();

  useEffect(() => {
    ctaRef.current?.focus({ preventScroll: true });
  }, []);

  const sprintBest = loadBest('sprint');

  return (
    <div className="min-h-full px-5 sm:px-10">
      <header className="mx-auto flex h-20 w-full max-w-[1200px] items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          {padKind && (
            <span className="label hidden sm:inline">
              <span className="mr-2 inline-block size-1.5 rounded-full bg-[#30d158] align-middle" />
              {PAD_NAMES[padKind]}
            </span>
          )}
          <button
            data-nav
            onClick={() => onSettings()}
            className={`hairline rounded-full bg-tile px-5 py-2 text-[14px] font-medium transition-transform duration-250 ease-spring hover:scale-[1.04] ${focusRing}`}
          >
            Settings
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-[1200px] items-center gap-12 pt-6 pb-20 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[1.1fr_0.9fr] lg:pt-0">
        <div>
          <div className="label animate-rise">A stacker built for practice</div>
          <h1
            aria-label="TETRA"
            className="wordmark mt-5 -ml-[0.05em] text-[clamp(88px,14vw,200px)] font-[480] leading-[0.84] tracking-[-0.022em]"
          >
            {[...'TETRA'].map((letter, i) => (
              <span key={i} aria-hidden style={{ animationDelay: `${i * 55}ms` }}>
                {letter}
              </span>
            ))}
          </h1>
          <p className="animate-rise mt-8 max-w-[36ch] text-[18px] leading-relaxed text-muted [animation-delay:120ms]">
            Modern rotation, honest handling, zero noise. Every mode you need to get faster, and soon, opponents to beat.
          </p>
          <div className="animate-rise mt-10 flex flex-wrap items-center gap-3 [animation-delay:180ms]">
            <button
              ref={ctaRef}
              data-nav
              onClick={() => onPlay('sprint')}
              className={`group flex items-center gap-3 rounded-full bg-accent py-4 pr-4 pl-7 text-[17px] font-semibold text-black transition-transform duration-250 ease-spring hover:scale-[1.04] active:scale-[0.98] ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
            >
              Play 40 Lines
              <span className="grid size-8 place-items-center rounded-full bg-black/10 font-mono text-[13px] transition-transform duration-250 ease-spring group-hover:translate-x-0.5">
                ↵
              </span>
            </button>
            <button
              data-nav
              onClick={() => modesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className={`hairline rounded-full bg-tile px-6 py-4 text-[17px] font-medium transition-transform duration-250 ease-spring hover:scale-[1.04] ${focusRing}`}
            >
              All modes
            </button>
          </div>
          <dl className="animate-rise mt-14 flex gap-10 [animation-delay:240ms]">
            <Fact label="40 Lines best" value={sprintBest ? MODE_CONFIGS.sprint.formatRecord(sprintBest) : '—'} />
            <Fact label="Skin" value={SKINS[appearance.skin].name} />
            <Fact label="Input" value={padKind ? 'Controller' : 'Keyboard'} />
          </dl>
        </div>

        <Showcase skinName={SKINS[appearance.skin].name} />
      </section>

      {/* Modes */}
      <section ref={modesRef} className="mx-auto w-full max-w-[1200px] scroll-mt-6 pb-24">
        <SectionTitle title="Solo" note="Four modes" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {MODE_ORDER.map((id) => (
            <ModeTile key={id} id={id} onPlay={() => onPlay(id)} />
          ))}
        </div>

        <SectionTitle className="mt-24" title="Versus" note="Coming next" />
        <div className="mt-8 hairline relative overflow-hidden rounded-[40px] bg-gradient-to-b from-[#19191b] to-[#121214] p-8 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[30px] font-medium tracking-[-0.03em]">Bots</span>
                <Chip>Soon</Chip>
              </div>
              <p className="mt-2 max-w-[42ch] text-[15px] text-muted">
                Ten opponents that play like people, from first steps to the top of the ladder. Plus one you tune yourself.
              </p>
            </div>
            <span className="tabular text-[64px] leading-none font-medium tracking-[-0.06em] text-white/[0.08]">1v1</span>
          </div>
          <ol className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
            {BOTS.map((name, i) => (
              <li key={name} className="flex items-baseline gap-3 border-t border-line pt-3">
                <span className="tabular text-[12px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[15px] font-medium text-white/50">{name}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Footer onPlay={onPlay} onSettings={onSettings} />
    </div>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
        <g fill="#fbfbfc">
          <rect x="4" y="12" width="17" height="17" rx="4.5" />
          <rect x="23.5" y="12" width="17" height="17" rx="4.5" />
          <rect x="43" y="12" width="17" height="17" rx="4.5" />
          <rect x="23.5" y="31.5" width="17" height="17" rx="4.5" />
        </g>
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">TETRA</span>
    </span>
  );
}

function Showcase({ skinName }: { skinName: string }) {
  return (
    <div className="animate-rise relative mx-auto aspect-[4/5] w-full max-w-[480px] [animation-delay:200ms] lg:max-h-[min(78vh,640px)]">
      <div className="absolute inset-0 overflow-hidden rounded-[48px] bg-gradient-to-b from-[#1b1b1d] to-[#111113] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),0_40px_120px_-40px_rgba(237,235,250,0.18)]">
        <DemoBoard className="absolute inset-0" />
      </div>
      <div className="pointer-events-none absolute bottom-6 left-7 flex items-center gap-2">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#30d158] opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-[#30d158]" />
        </span>
        <span className="label text-muted">Live</span>
      </div>
      <div className="pointer-events-none absolute right-7 bottom-6 label">{skinName}</div>
    </div>
  );
}

function ModeTile({ id, onPlay }: { id: ModeId; onPlay: () => void }) {
  const config = MODE_CONFIGS[id];
  const best = loadBest(id);
  return (
    <button
      data-nav
      onClick={onPlay}
      className={`group hairline relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-[40px] bg-gradient-to-b from-[#1b1b1d] to-[#131315] p-8 text-left transition-[transform,box-shadow] duration-500 ease-spring hover:-translate-y-1 hover:shadow-[0_30px_80px_-30px_rgba(237,235,250,0.16)] sm:p-10 ${focusRing}`}
    >
      <span className="tabular block text-[clamp(88px,11vw,136px)] leading-[0.85] font-medium tracking-[-0.07em] text-white/[0.07] transition-colors duration-500 group-hover:text-white/[0.9] group-focus-visible:text-white/[0.9]">
        {NUMERALS[id]}
      </span>
      <span className="mt-10 block">
        <span className="flex items-center justify-between gap-4">
          <span className="text-[28px] font-medium tracking-[-0.03em]">{config.def.name}</span>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[16px] transition-all duration-300 ease-spring group-hover:translate-x-1 group-hover:bg-accent group-hover:text-black">
            →
          </span>
        </span>
        <span className="mt-1.5 block text-[15px] text-muted">{config.description}</span>
        <span className="mt-6 flex items-baseline gap-3 border-t border-line pt-4">
          <span className="label">Best</span>
          <span className="tabular text-[15px] font-medium">{best ? config.formatRecord(best) : '—'}</span>
        </span>
      </span>
    </button>
  );
}

function SectionTitle({ title, note, className = '' }: { title: string; note: string; className?: string }) {
  return (
    <div className={`flex items-end justify-between gap-6 border-b border-line pb-5 ${className}`}>
      <h2 className="text-[clamp(40px,6vw,64px)] leading-none font-[480] tracking-[-0.045em]">{title}</h2>
      <span className="label pb-1.5">{note}</span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tabular mt-1.5 text-[16px] font-medium">{value}</dd>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-faint shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">{children}</span>
  );
}

function Footer({ onPlay, onSettings }: { onPlay: (mode: ModeId) => void; onSettings: (tab?: SettingsTab) => void }) {
  const link = `text-left text-[14px] font-medium text-white/70 transition-colors duration-150 hover:text-white ${focusRing} rounded`;
  return (
    <footer className="mx-auto grid w-full max-w-[1200px] gap-10 border-t border-line py-14 sm:grid-cols-4">
      <div>
        <Logo />
        <p className="mt-4 max-w-[24ch] text-[14px] leading-relaxed text-faint">A minimal stacker built for practice.</p>
      </div>
      <FooterColumn title="Play">
        {MODE_ORDER.map((id) => (
          <button key={id} onClick={() => onPlay(id)} className={link}>
            {MODE_CONFIGS[id].def.name}
          </button>
        ))}
      </FooterColumn>
      <FooterColumn title="Settings">
        <button onClick={() => onSettings('appearance')} className={link}>
          Appearance
        </button>
        <button onClick={() => onSettings('sound')} className={link}>
          Sound
        </button>
        <button onClick={() => onSettings('controls')} className={link}>
          Controls
        </button>
      </FooterColumn>
      <FooterColumn title="About">
        <span className="text-[14px] text-faint">Version 0.4</span>
        <span className="text-[14px] text-faint">Keyboard & controller</span>
        <span className="flex items-center gap-2 text-[14px] text-faint">
          Bots <Chip>Soon</Chip>
        </span>
      </FooterColumn>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="label mb-4">{title}</div>
      <div className="flex flex-col items-start gap-2.5">{children}</div>
    </div>
  );
}
