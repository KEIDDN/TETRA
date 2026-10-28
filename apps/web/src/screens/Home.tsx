import type { GameStats, ModeId, PieceType } from '@tetra/engine';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { sfx } from '../audio/sfx';
import { Lattice } from '../game/ambient';
import { gamepads } from '../game/gamepad';
import { MODE_CONFIGS, MODE_ORDER } from '../game/modes';
import { hexToNumber, SKIN_ORDER, SKINS } from '../game/skins';
import { PAD_NAMES } from '../lib/labels';
import { useMenuNav } from '../lib/nav';
import { updateSettings, useSettings } from '../lib/settings';
import { loadBest } from '../lib/storage';
import { AmbientBackground } from '../ui/AmbientBackground';
import { DemoBoard, type DemoMode } from '../ui/DemoBoard';
import { LevelChip } from '../ui/LevelChip';
import { toast } from '../ui/toast';
import { getSettings } from '../lib/settings';
import { skinLocked } from '../lib/tournament';
import type { ProfileSection } from './Profile';

type SettingsTab = 'appearance' | 'sound' | 'controls';

type Entry = DemoMode | 'cups';
const ENTRIES: Entry[] = [...MODE_ORDER, 'versus', 'cups'];
const PIECES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

function entryName(id: Entry): string {
  return id === 'versus' ? 'Versus' : id === 'cups' ? 'Cups' : MODE_CONFIGS[id].def.name;
}

function entryDescription(id: Entry): string {
  if (id === 'cups') return 'Eight-bot brackets. Three cups, or your own.';
  return id === 'versus' ? 'Ten bots that play like people.' : MODE_CONFIGS[id].description;
}

/** The live stat the showcase shows for each mode. */
function liveStat(id: Entry, s: GameStats): [string, string] {
  switch (id) {
    case 'blitz':
      return ['Score', s.score.toLocaleString('en-US')];
    case 'marathon':
    case 'endless':
      return ['Level', String(s.level)];
    default:
      return ['Lines', String(s.lines)];
  }
}

export function Home({
  onPlay,
  onVersus,
  onCups,
  onProfile,
  onSettings,
}: {
  onProfile: (section?: ProfileSection) => void;
  onPlay: (mode: ModeId) => void;
  onVersus: () => void;
  onCups: () => void;
  onSettings: (tab?: SettingsTab) => void;
}) {
  const { appearance } = useSettings();
  const padKind = useSyncExternalStore(
    (l) => gamepads.onStatus(l),
    () => gamepads.kind,
  );
  const [selected, setSelected] = useState<Entry>('sprint');
  const firstRef = useRef<HTMLButtonElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const statLabelRef = useRef<HTMLSpanElement>(null);
  const statValueRef = useRef<HTMLSpanElement>(null);
  const skin = SKINS[appearance.skin];

  const lattice = useMemo(() => new Lattice(0.9), []);
  useEffect(() => {
    for (const k of PIECES) lattice.palette[k] = hexToNumber(skin.palette(1)[k]);
  }, [lattice, skin]);

  const cycleSkin = (direction: 1 | -1) => {
    const order = SKIN_ORDER.filter((id) => !skinLocked(id) || id === appearance.skin);
    const i = order.indexOf(appearance.skin);
    const next = order[(i + direction + order.length) % order.length];
    updateSettings((s) => ({ ...s, appearance: { ...s.appearance, skin: next } }));
    sfx.ui('move');
    const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
    lattice.ripple(window.innerWidth / 2, window.innerHeight - 40, 4, lattice.palette[piece]);
  };
  useMenuNav(undefined, true, cycleSkin);

  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);

  const select = (id: Entry) => {
    if (id === selected) return;
    setSelected(id);
    // A small ripple from the newly selected entry.
    const el = document.activeElement?.getBoundingClientRect();
    if (el) lattice.ripple(el.left, el.top + el.height / 2, 2.2);
  };

  const activate = (id: Entry) => (id === 'versus' ? onVersus() : id === 'cups' ? onCups() : onPlay(id));

  const best = selected === 'versus' || selected === 'cups' ? null : loadBest(selected);

  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto">
      {appearance.ambient && appearance.fx !== 'off' && <AmbientBackground lattice={lattice} />}

      <div className="relative mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-6 sm:px-10">
        <header className="flex h-[min(96px,12vh)] shrink-0 items-center justify-between">
          <Logo large />
          <div className="flex items-center gap-5">
            <button data-nav onClick={() => onProfile()} className={`-my-1 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-white/[0.06] ${focusRing}`} aria-label="Profile">
              <LevelChip />
            </button>
            {padKind && (
              <span className="label hidden sm:inline">
                <span className="mr-2 inline-block size-1.5 rounded-full bg-[#30d158] align-middle" />
                {PAD_NAMES[padKind]}
              </span>
            )}
            <button
              data-nav
              onClick={() => onSettings()}
              className={`hairline rounded-full bg-tile px-5 py-2 text-[14px] font-medium backdrop-blur-md transition-transform duration-250 ease-spring hover:scale-[1.04] ${focusRing}`}
            >
              Settings
            </button>
          </div>
        </header>

        <main className="grid flex-1 items-center gap-10 py-[min(24px,3vh)] lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
          <div>
            <div className="label animate-rise">Select a mode</div>
            <ul className="mt-[min(24px,2.5vh)]">
              {ENTRIES.map((id, i) => {
                const active = id === selected;
                return (
                  <li key={id} className="animate-rise" style={{ animationDelay: `${60 + i * 50}ms` }}>
                    <button
                      ref={i === 0 ? firstRef : undefined}
                      data-nav
                      onFocus={() => select(id)}
                      onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
                      onClick={() => activate(id)}
                      className="group relative flex w-full items-center gap-6 py-1 text-left outline-none"
                    >
                      <span
                        className={`absolute top-1/2 -left-5 h-[0.5em] w-1 -translate-y-1/2 rounded-full bg-accent text-[clamp(30px,min(5.4vw,7vh),84px)] transition-all duration-300 ease-spring ${
                          active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'
                        }`}
                      />
                      <span
                        className={`text-[clamp(30px,min(5.4vw,7vh),84px)] leading-[1.02] font-[480] tracking-[-0.045em] transition-colors duration-300 ${
                          active ? 'text-fg' : 'text-white/[0.14] group-hover:text-white/30'
                        }`}
                      >
                        {entryName(id)}
                      </span>
                      {id === 'cups' && (
                        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-black">New</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div key={selected} className="animate-fade mt-[min(40px,3.5vh)] flex max-w-[560px] flex-wrap items-end gap-x-10 gap-y-5 border-t border-line pt-[min(24px,3vh)]">
              <p className="min-w-[220px] flex-1 text-[16px] leading-relaxed text-muted">{entryDescription(selected)}</p>
              {selected === 'versus' || selected === 'cups' ? (
                <>
                  <PlayButton onClick={() => activate(selected)} />
                </>
              ) : (
                <>
                  <div>
                    <div className="label">Best</div>
                    <div className="tabular mt-1.5 text-[18px] font-medium">{best ? MODE_CONFIGS[selected].formatRecord(best) : '—'}</div>
                  </div>
                  <PlayButton onClick={() => activate(selected)} />
                </>
              )}
            </div>
          </div>

          <div ref={showcaseRef} className="animate-rise relative mx-auto hidden aspect-[4/5] w-full max-w-[460px] [animation-delay:200ms] lg:block lg:max-h-[min(66vh,620px)]">
            <div className="absolute inset-0 overflow-hidden rounded-[48px] bg-gradient-to-b from-[#1b1b1d]/90 to-[#111113]/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),0_40px_120px_-40px_rgba(237,235,250,0.18)] backdrop-blur-xl">
              <DemoBoard
                mode={selected === 'cups' ? 'versus' : selected}
                skin={appearance.skin}
                className="absolute inset-0"
                onClear={(power, y) => {
                  const rect = showcaseRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const x = rect.left + rect.width * 0.4;
                  const at = rect.top + rect.height * y;
                  const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
                  if (power >= 4) lattice.celebrate(x, at, power, lattice.palette[piece] ?? 0xffffff, [piece]);
                  else lattice.ripple(x, at, power, lattice.palette[piece]);
                }}
                onStats={(stats) => {
                  const [label, value] = liveStat(selected, stats);
                  if (statLabelRef.current) statLabelRef.current.textContent = label;
                  if (statValueRef.current) statValueRef.current.textContent = value;
                }}
              />
            </div>
            <div className="pointer-events-none absolute top-6 right-7 text-right">
              <span ref={statLabelRef} className="label block" />
              <span ref={statValueRef} className="tabular mt-1 block text-[18px] font-medium" />
            </div>
            <div className="pointer-events-none absolute bottom-6 left-7 flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#30d158] opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-[#30d158]" />
              </span>
              <span className="label text-muted">Live · {entryName(selected)}</span>
            </div>
          </div>
        </main>

        <footer className="flex h-16 shrink-0 items-center justify-between gap-6 border-t border-line">
          <div className="flex items-center gap-1">
            <SkinArrow label="Previous skin" onClick={() => cycleSkin(-1)}>
              ‹
            </SkinArrow>
            <button onClick={() => onProfile('skins')} className={`group min-w-[120px] rounded-full px-3 py-1.5 text-center transition-colors hover:bg-white/[0.06] ${focusRing}`} title="All skins">
              <span className="label mr-2">Skin</span>
              <span key={skin.id} className="animate-fade text-[14px] font-medium">
                {skin.name}
              </span>
              <span className="ml-2 text-[12px] text-faint transition-colors group-hover:text-fg">All</span>
            </button>
            <SkinArrow label="Next skin" onClick={() => cycleSkin(1)}>
              ›
            </SkinArrow>
          </div>
          <div className="label hidden gap-5 md:flex">
            <span>
              <span className="text-muted">↑↓</span> Mode
            </span>
            <span>
              <span className="text-muted">←→</span> Skin
            </span>
            <span>
              <span className="text-muted">↵</span> Play
            </span>
          </div>
          <VersionTaps />
        </footer>
      </div>
    </div>
  );
}

/** Five quick taps on the version toggle developer mode, Android style. */
function VersionTaps() {
  const taps = useRef<number[]>([]);
  const onTap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length < 5) return;
    taps.current = [];
    const developer = !getSettings().developer;
    updateSettings((s) => ({ ...s, developer }));
    toast(developer ? 'Developer mode on · everything unlocked' : 'Developer mode off');
  };
  return (
    <button onClick={onTap} className="label select-none">
      v0.8
    </button>
  );
}

function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      data-nav
      onClick={onClick}
      className={`flex items-center gap-3 rounded-full bg-accent py-3 pr-3 pl-6 text-[16px] font-semibold text-black transition-transform duration-250 ease-spring hover:scale-[1.04] active:scale-[0.98] ${focusRing}`}
    >
      Play
      <span className="grid size-7 place-items-center rounded-full bg-black/10 font-mono text-[12px]">↵</span>
    </button>
  );
}

function SkinArrow({ children, label, onClick }: { children: string; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-full text-[18px] text-muted transition-colors hover:bg-white/[0.06] hover:text-fg ${focusRing}`}
    >
      {children}
    </button>
  );
}

function Logo({ large = false }: { large?: boolean }) {
  const mark = large ? 34 : 22;
  return (
    <span className={`animate-rise flex items-center ${large ? 'gap-3.5' : 'gap-2.5'}`}>
      <svg width={mark} height={mark} viewBox="0 0 64 64" aria-hidden>
        <g fill="#fbfbfc">
          <rect x="4" y="12" width="17" height="17" rx="4.5" />
          <rect x="23.5" y="12" width="17" height="17" rx="4.5" />
          <rect x="43" y="12" width="17" height="17" rx="4.5" />
          <rect x="23.5" y="31.5" width="17" height="17" rx="4.5" />
        </g>
      </svg>
      <span className={large ? 'text-[28px] font-semibold tracking-[-0.03em]' : 'text-[15px] font-semibold tracking-[-0.01em]'}>TETRA</span>
    </span>
  );
}
