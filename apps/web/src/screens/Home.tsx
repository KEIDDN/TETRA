import type { ModeId, PieceType } from '@tetra/engine';
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
import { ModeWheel } from '../ui/ModeWheel';
import { installed } from '../lib/platform';
import { useAccount } from '../lib/account';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Glyph } from '../ui/Glyph';
import { SkinPicker } from '../ui/SkinPicker';
import { toast } from '../ui/toast';
import { getSettings } from '../lib/settings';
import { skinLocked } from '../lib/tournament';
import { skinUnlockHint } from '../lib/achievements';
import type { ProfileSection } from './Profile';

type SettingsTab = 'appearance' | 'sound' | 'controls';

type Entry = DemoMode | 'cups' | 'multiplayer';
const ENTRIES: Entry[] = [...MODE_ORDER, 'versus', 'cups', 'multiplayer'];
/** On the menu so it is known it is coming, but not playable yet. */
const SOON: Entry[] = ['multiplayer'];
const PIECES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
/** A long, soft ease-out: things glide into place and settle without a bounce. */
const GLIDE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

function entryName(id: Entry): string {
  if (id === 'multiplayer') return 'Multiplayer';
  return id === 'versus' ? 'Versus' : id === 'cups' ? 'Cups' : MODE_CONFIGS[id].def.name;
}

function entryDescription(id: Entry): string {
  if (id === 'cups') return 'Eight-bot brackets. Three cups, or your own.';
  if (id === 'multiplayer') return 'Play people, live. We are building it now.';
  return id === 'versus' ? 'Ten bots that play like people.' : MODE_CONFIGS[id].description;
}

export function Home({
  onPlay,
  onVersus,
  onCups,
  onProfile,
  onExperience,
  onOxia,
  onDownload,
  onSignIn,
  onSettings,
  onLegal,
  onBack,
}: {
  /** Desktop: Esc on the menu goes back to the title screen. */
  onBack?: () => void;
  onLegal: (doc: 'terms' | 'privacy') => void;
  onExperience: () => void;
  onOxia: () => void;
  onDownload: () => void;
  onSignIn: () => void;
  onProfile: (section?: ProfileSection) => void;
  onPlay: (mode: ModeId) => void;
  onVersus: () => void;
  onCups: () => void;
  onSettings: (tab?: SettingsTab) => void;
}) {
  const { appearance } = useSettings();
  const account = useAccount();
  const padKind = useSyncExternalStore(
    (l) => gamepads.onStatus(l),
    () => gamepads.kind,
  );
  const [selected, setSelected] = useState<Entry>('sprint');
  const firstRef = useRef<HTMLButtonElement>(null);
  // Picking a mode opens its setup: the wheel steps aside, the board and the rooms come in.
  const [setup, setSetup] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
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
  // ←→ change the skin only once the skins are on screen.
  useMenuNav(setup ? () => leaveSetup() : onBack, true, setup ? cycleSkin : undefined);

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

  const start = (id: Entry) => {
    if (id === 'versus') onVersus();
    else if (id === 'cups') onCups();
    else if (id !== 'multiplayer') onPlay(id);
  };
  const activate = (id: Entry, pointer = false) => {
    if (id === 'multiplayer') return toast('Multiplayer is coming soon');
    // In the setup only Play (or Enter) starts: a stray click on the wheel never does.
    if (setup) return pointer ? undefined : start(id);
    setSetup(true);
    sfx.ui('select');
  };
  const leaveSetup = () => {
    setSetup(false);
    sfx.ui('back');
    // Keep the keyboard on the wheel.
    document.querySelectorAll<HTMLButtonElement>('[data-wheel-row]')[ENTRIES.indexOf(selected)]?.focus({ preventScroll: true });
  };
  const openRooms = () => SKIN_ORDER.filter((id) => !skinLocked(id) || id === appearance.skin);

  const best = selected === 'versus' || selected === 'cups' || selected === 'multiplayer' ? null : loadBest(selected);

  return (
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto">
      {appearance.ambient && appearance.fx !== 'off' && <AmbientBackground lattice={lattice} />}

      <div className="relative mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-6 sm:px-10">
        <header className="flex h-[min(96px,12vh)] shrink-0 items-center justify-between">
          <Logo large className="animate-rise" />
          <div className="flex items-center gap-5">
            <button
              data-nav
              onClick={onOxia}
              className={`hidden rounded-full px-2 py-2 text-[13px] font-medium text-muted transition-colors hover:text-fg md:block ${focusRing}`}
            >
              <span className="flex items-center gap-2">
                <Icon name="info" size={11} /> Why TETRA
              </span>
            </button>
            <button
              data-nav
              onClick={onExperience}
              className={`exp-pill hidden items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium md:flex ${focusRing}`}
              title="What is the TETRA Experience"
            >
              <span className="exp-dot size-1.5 rounded-full" />
              Experience
            </button>
            {account.mode === 'guest' && (
              <button data-nav onClick={onSignIn} className={`glass rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`} title="Guests don't keep progress">
                Sign in
              </button>
            )}
            <button
              data-nav
              onClick={() => onProfile()}
              className={`-my-1 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-white/[0.06] ${focusRing}`}
              aria-label="Profile"
            >
              <LevelChip />
            </button>
            {padKind && (
              <span className="label hidden sm:inline">
                <span className="mr-2 inline-block size-1.5 rounded-full bg-[#30d158] align-middle" />
                {PAD_NAMES[padKind]}
              </span>
            )}
            {!installed() && (
              <button
                data-nav
                onClick={onDownload}
                className={`glass-light flex items-center gap-2 rounded-full px-5 py-2 text-[14px] font-semibold ${focusRing}`}
              >
                <Icon name="download" size={12} />
                Get the app
              </button>
            )}
            <button
              data-nav
              onClick={() => onSettings()}
              className={`glass flex items-center gap-2 rounded-full px-5 py-2 text-[14px] font-medium ${focusRing}`}
            >
              <Icon name="settings" size={12} />
              Settings
            </button>
          </div>
        </header>

        <main className="relative min-h-[540px] flex-1">
          {/* The wheel: centre stage, then a step to the left once a mode is picked. */}
          <div
            className="absolute top-1/2 left-1/2 flex w-[min(680px,90vw)] flex-col items-center text-center will-change-transform"
            style={{
              transform: setup ? 'translate3d(calc(-50% - min(31vw, 440px)), -50%, 0)' : 'translate3d(-50%, -50%, 0)',
              transition: `transform ${setup ? 1100 : 900}ms ${GLIDE}`,
            }}
          >
            <div className="label animate-rise">Select a mode</div>
            <div className="animate-rise mt-[min(32px,3.5vh)] w-full [animation-delay:80ms]">
              <ModeWheel
                center
                items={ENTRIES}
                selected={selected}
                label={entryName}
                extra={(id) =>
                  id === 'cups' ? (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold tracking-normal text-black">New</span>
                  ) : SOON.includes(id) ? (
                    <span className="glass rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-normal whitespace-nowrap text-muted">Coming soon</span>
                  ) : null
                }
                onSelect={select}
                onActivate={activate}
                dim={(id) => SOON.includes(id)}
                firstRef={firstRef}
              />
            </div>

            <div
              key={selected}
              className={`animate-fade mt-[min(48px,5vh)] flex flex-col items-center transition-[opacity,translate] duration-500 ${setup ? 'pointer-events-none translate-y-3 opacity-0' : ''}`}
            >
              <p className="max-w-[38ch] text-[16px] leading-relaxed text-muted">{entryDescription(selected)}</p>
              <div className="mt-[min(28px,3vh)] flex items-center gap-8">
                {selected === 'multiplayer' ? (
                  <span className="glass rounded-full px-6 py-3 text-[15px] font-semibold text-muted">Coming soon</span>
                ) : (
                  <button
                    data-nav
                    tabIndex={setup ? -1 : 0}
                    onClick={() => activate(selected)}
                    className={`glass-light group flex h-12 items-center gap-3 rounded-full pr-2.5 pl-6 text-[16px] font-semibold ${focusRing}`}
                  >
                    Choose
                    <span className="grid size-8 place-items-center rounded-full bg-black/10 text-black/60">
                      <Glyph k="confirm" />
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Centre: the mode playing live in the chosen room. */}
          <div
            className={`absolute top-1/2 left-1/2 flex flex-col items-center will-change-transform ${setup ? '' : 'pointer-events-none'}`}
            style={{
              opacity: setup ? 1 : 0,
              transform: setup ? 'translate3d(-50%, -50%, 0) scale(1)' : 'translate3d(-50%, calc(-50% + 28px), 0) scale(0.96)',
              transition: `opacity ${setup ? 900 : 350}ms ${GLIDE} ${setup ? 180 : 0}ms, transform ${setup ? 1100 : 450}ms ${GLIDE} ${setup ? 140 : 0}ms`,
            }}
          >
            <div
              ref={boardRef}
              className="relative aspect-[4/5] h-[min(56vh,520px)] overflow-hidden rounded-[44px] bg-gradient-to-b from-[#1b1b1d]/90 to-[#111113]/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),0_40px_120px_-40px_rgba(237,235,250,0.16)]"
            >
              {setup && (
                <DemoBoard
                  mode={selected === 'cups' || selected === 'multiplayer' ? 'versus' : selected}
                  skin={appearance.skin}
                  className="animate-fade absolute inset-0"
                  onClear={(power, y) => {
                    const rect = boardRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const x = rect.left + rect.width * 0.4;
                    const at = rect.top + rect.height * y;
                    const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
                    if (power >= 4) lattice.celebrate(x, at, power, lattice.palette[piece] ?? 0xffffff, [piece]);
                    else lattice.ripple(x, at, power, lattice.palette[piece]);
                  }}
                />
              )}
            </div>
            <div className="mt-7 flex items-center gap-8">
              {best !== null || (selected !== 'versus' && selected !== 'cups') ? (
                <div className="text-left">
                  <div className="label">Best</div>
                  <div className="tabular mt-1.5 text-[18px] font-medium">{best && selected !== 'versus' && selected !== 'cups' && selected !== 'multiplayer' ? MODE_CONFIGS[selected].formatRecord(best) : '—'}</div>
                </div>
              ) : null}
              <PlayButton onClick={() => start(selected)} />
              <button data-nav onClick={leaveSetup} className={`rounded-sm text-[13px] text-muted transition-colors hover:text-fg ${focusRing}`}>
                Back <Glyph k="back" className="ml-1 text-faint" />
              </button>
            </div>
          </div>

          {/* Right: the rooms. */}
          <div
            className={`absolute top-1/2 right-0 w-[min(390px,30vw)] will-change-transform ${setup ? '' : 'pointer-events-none'}`}
            style={{
              opacity: setup ? 1 : 0,
              transform: setup ? 'translate3d(0, -50%, 0)' : 'translate3d(48px, -50%, 0)',
              transition: `opacity ${setup ? 900 : 300}ms ${GLIDE} ${setup ? 300 : 0}ms, transform ${setup ? 1100 : 400}ms ${GLIDE} ${setup ? 260 : 0}ms`,
            }}
          >
            <span className="label">Skin</span>
            <div key={appearance.skin} className="animate-fade mt-3">
              <div className="text-[clamp(28px,2.6vw,40px)] leading-[1.05] font-[560] tracking-[-0.04em]">{skin.name}</div>
              <p className="mt-2 min-h-[3em] text-[15px] leading-relaxed text-muted">{skin.description}</p>
            </div>
            <div className="mt-6">
              <SkinPicker
                skins={SKIN_ORDER}
                value={appearance.skin}
                locked={skinLocked}
                onLocked={(id) => toast(`${SKINS[id].name} · ${skinUnlockHint(id)}`)}
                onChange={(next) => {
                  if (next === appearance.skin) return;
                  updateSettings((st) => ({ ...st, appearance: { ...st.appearance, skin: next } }));
                  sfx.ui('move');
                }}
              />
            </div>
            <p className="mt-5 text-[13px] text-faint">
              Every skin plays its own set.
              {SKIN_ORDER.length - openRooms().length > 0 ? ` ${SKIN_ORDER.length - openRooms().length} more are won through achievements.` : ''}
            </p>
          </div>
        </main>

        <footer className="flex h-16 shrink-0 items-center justify-between gap-6 border-t border-line">
          <div className="label hidden items-center gap-6 md:flex">
            <span className="flex items-center gap-2">
              <Glyph k="vertical" className="text-muted" /> Mode
            </span>
            {setup && (
              <span className="animate-fade flex items-center gap-2">
                <Glyph k="horizontal" className="text-muted" /> Skin
              </span>
            )}
            <span className="flex items-center gap-2">
              <Glyph k="confirm" className="text-muted" /> {setup ? 'Play' : 'Choose'}
            </span>
            {setup && (
              <span className="animate-fade flex items-center gap-2">
                <Glyph k="back" className="text-muted" /> Back
              </span>
            )}
          </div>
          <div className="flex items-center gap-5">
            <button onClick={() => onLegal('terms')} className={`label rounded-sm transition-colors hover:text-fg ${focusRing}`}>
              Terms
            </button>
            <button onClick={() => onLegal('privacy')} className={`label rounded-sm transition-colors hover:text-fg ${focusRing}`}>
              Privacy
            </button>
            <span className="label hidden lg:inline">© {new Date().getFullYear()} OXIA Labs</span>
            <VersionTaps />
          </div>
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
      v{__APP_VERSION__}
    </button>
  );
}

function PlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      data-nav
      onClick={onClick}
      className={`glass-light flex items-center gap-3 rounded-full py-3 pr-3 pl-6 text-[16px] font-semibold ${focusRing}`}
    >
      Play
      <span className="grid size-7 place-items-center rounded-full bg-black/10">
        <Glyph k="confirm" />
      </span>
    </button>
  );
}

