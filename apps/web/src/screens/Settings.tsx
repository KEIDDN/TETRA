import { FRAME_MS, linkMasks, type Handling } from '@tetra/engine';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { SOUND_PACK_NAMES, sfx } from '../audio/sfx';
import type { FxLevel } from '../game/fx';
import { gamepads } from '../game/gamepad';
import { paintBlock, SKIN_ORDER, SKINS, type BlockKind, type Skin, type SoundPackId } from '../game/skins';
import { buttonLabel, keyLabel, PAD_NAMES } from '../lib/labels';
import { useMenuNav } from '../lib/nav';
import {
  bind,
  COMMANDS,
  MAX_BINDINGS,
  resetSettings,
  STICK_LEFT,
  STICK_UP,
  updateSettings,
  useSettings,
  type AppearanceSettings,
  type Command,
  type Device,
} from '../lib/settings';

type Tab = 'appearance' | 'sound' | 'controls';
type Capture = { device: Device; command: Command; slot: number } | null;

function usePadKind() {
  return useSyncExternalStore(
    (l) => gamepads.onStatus(l),
    () => gamepads.kind,
  );
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

export function Settings({ onBack, initialTab = 'appearance' }: { onBack: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [capture, setCapture] = useState<Capture>(null);
  useMenuNav(onBack, capture === null);

  return (
    <div className="min-h-full px-5 pb-24 sm:px-10">
      <header className="mx-auto flex h-20 w-full max-w-[760px] items-center justify-between">
        <button
          data-nav
          onClick={onBack}
          className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted transition-colors duration-150 hover:text-fg focus-visible:text-fg ${focusRing}`}
        >
          ← Back <span className="label ml-2">Esc</span>
        </button>
        <span className="label">Settings</span>
      </header>

      <main className="animate-rise mx-auto w-full max-w-[760px]">
        <h1 className="mt-6 text-[clamp(44px,8vw,72px)] font-[480] leading-none tracking-[-0.045em]">Settings</h1>
        <div className="mt-10">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              ['appearance', 'Appearance'],
              ['sound', 'Sound'],
              ['controls', 'Controls'],
            ]}
          />
        </div>

        <div key={tab} className="animate-fade">
          {tab === 'appearance' && <AppearancePanel />}
          {tab === 'sound' && <SoundPanel />}
          {tab === 'controls' && <ControlsPanel capture={capture} setCapture={setCapture} />}
        </div>

        <div className="mt-10 flex justify-end">
          <button
            data-nav
            onClick={() => {
              if (window.confirm('Reset all settings to their defaults?')) resetSettings();
            }}
            className={`rounded-full px-5 py-2.5 text-[14px] font-medium text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-colors hover:text-fg ${focusRing}`}
          >
            Reset to defaults
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Appearance ──────────────────────────────────────────────────

function AppearancePanel() {
  const { appearance } = useSettings();
  const set = (patch: Partial<AppearanceSettings>) => updateSettings((s) => ({ ...s, appearance: { ...s.appearance, ...patch } }));

  return (
    <>
      <Section label="Skin" note="Pieces, ghost, particles and sound.">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
          {SKIN_ORDER.map((id) => (
            <SkinCard key={id} skin={SKINS[id]} selected={appearance.skin === id} onSelect={() => set({ skin: id })} />
          ))}
        </div>
      </Section>

      <Section label="Effects">
        <Row name="Intensity" hint="Particles, flashes, shake and glow">
          <Segmented<FxLevel>
            small
            value={appearance.fx}
            onChange={(fx) => set({ fx })}
            options={[
              ['off', 'Off'],
              ['subtle', 'Subtle'],
              ['full', 'Full'],
            ]}
          />
        </Row>
        <ToggleRow name="Action text" hint="T-SPIN DOUBLE, B2B, combos" value={appearance.actionText} onChange={(actionText) => set({ actionText })} />
        <ToggleRow name="Smooth falling" hint="Glide between rows instead of stepping" value={appearance.smoothFall} onChange={(smoothFall) => set({ smoothFall })} />
        <ToggleRow name="Ghost piece" hint="Shows where the piece will land" value={appearance.ghost} onChange={(ghost) => set({ ghost })} />
        <ToggleRow name="Grid" hint="Faint cell lines on the board" value={appearance.grid} onChange={(grid) => set({ grid })} />
      </Section>
    </>
  );
}

/** A small stack for the gallery, piece by piece (y-up, 3 rows). */
const PREVIEW: { kind: BlockKind; cells: [number, number][] }[] = [
  { kind: 'J', cells: [[0, 1], [0, 0], [1, 0], [2, 0]] },
  { kind: 'T', cells: [[3, 0], [4, 0], [5, 0], [4, 1]] },
  { kind: 'O', cells: [[6, 0], [7, 0], [6, 1], [7, 1]] },
  { kind: 'L', cells: [[8, 0], [9, 0], [9, 1], [9, 2]] },
  { kind: 'S', cells: [[1, 2], [2, 2], [2, 1], [3, 1]] },
  { kind: 'I', cells: [[4, 2], [5, 2], [6, 2], [7, 2]] },
];

function SkinCard({ skin, selected, onSelect }: { skin: Skin; selected: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cell = 15;
    const px = Math.round(cell * dpr);
    canvas.width = 10 * px;
    canvas.height = 3 * px;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = skin.blend === 'add' ? 'lighter' : 'source-over';
    const palette = skin.palette(1);
    const bleed = Math.ceil(px * skin.bleed);
    for (const { kind, cells } of PREVIEW) {
      const masks = linkMasks(cells);
      cells.forEach(([x, y], i) => ctx.drawImage(paintBlock(skin, px, palette[kind], kind, masks[i]), x * px - bleed, (2 - y) * px - bleed));
    }
  }, [skin]);

  return (
    <button
      data-nav
      onClick={onSelect}
      className={`group relative flex flex-col items-start gap-4 bg-[#0b0b0c] p-5 text-left transition-colors duration-150 hover:bg-[#111113] ${focusRing} focus-visible:ring-inset`}
    >
      <div className="flex h-[56px] w-full items-center justify-center">
        <canvas ref={ref} style={{ width: 150, height: 45 }} className="transition-transform duration-300 ease-spring group-hover:scale-[1.04]" />
      </div>
      <div className="w-full">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-medium tracking-[-0.01em]">{skin.name}</span>
          <span
            className={`size-4 rounded-full transition-all duration-250 ease-spring ${
              selected ? 'scale-100 bg-accent shadow-[0_0_0_3px_rgba(237,235,250,0.18)]' : 'scale-75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]'
            }`}
          />
        </div>
        <div className="mt-1 text-[12px] leading-snug text-faint">{skin.description}</div>
      </div>
    </button>
  );
}

// ── Sound ───────────────────────────────────────────────────────

function SoundPanel() {
  const { audio, appearance } = useSettings();
  const set = (patch: Partial<typeof audio>) => updateSettings((s) => ({ ...s, audio: { ...s.audio, ...patch } }));
  const packs: ['match' | SoundPackId, string][] = [
    ['match', `Match skin · ${SOUND_PACK_NAMES[SKINS[appearance.skin].sound]}`],
    ...(Object.entries(SOUND_PACK_NAMES) as [SoundPackId, string][]),
  ];

  return (
    <>
      <Section label="Output">
        <ToggleRow name="Sound effects" hint="Synthesized, no samples" value={audio.enabled} onChange={(enabled) => set({ enabled })} />
        <SliderRow
          name="Volume"
          hint="Master level"
          min={0}
          max={1}
          step={0.05}
          value={audio.volume}
          display={(v) => `${Math.round(v * 100)}%`}
          onChange={(volume) => set({ volume })}
          onCommit={() => sfx.preview(audio.pack === 'match' ? SKINS[appearance.skin].sound : audio.pack)}
        />
      </Section>

      <Section label="Sound pack" note="Selecting plays a sample.">
        {packs.map(([id, name]) => (
          <button
            key={id}
            data-nav
            onClick={() => {
              set({ pack: id });
              sfx.preview(id === 'match' ? SKINS[appearance.skin].sound : id);
            }}
            className={`flex w-full items-center justify-between border-t border-line px-6 py-4 text-left first:border-t-0 hover:bg-white/[0.03] sm:px-7 ${focusRing} focus-visible:ring-inset`}
          >
            <span className="text-[16px] font-medium tracking-[-0.01em]">{name}</span>
            <span
              className={`size-4 rounded-full transition-all duration-250 ease-spring ${
                audio.pack === id ? 'scale-100 bg-accent' : 'scale-75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]'
              }`}
            />
          </button>
        ))}
      </Section>
    </>
  );
}

// ── Controls ────────────────────────────────────────────────────

function ControlsPanel({ capture, setCapture }: { capture: Capture; setCapture: (c: Capture) => void }) {
  const settings = useSettings();
  const padKind = usePadKind();
  const [device, setDevice] = useState<Device>('keyboard');

  // Keyboard capture: runs before every other listener so the key isn't also handled as navigation.
  useEffect(() => {
    if (capture?.device !== 'keyboard') return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') return setCapture(null);
      const key = e.code === 'Backspace' || e.code === 'Delete' ? null : e.code;
      updateSettings((s) => ({ ...s, keyboard: { ...s.keyboard, bindings: bind(s.keyboard.bindings, capture.command, capture.slot, key) } }));
      setCapture(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [capture, setCapture]);

  useEffect(() => {
    if (capture?.device !== 'gamepad') return;
    const unsubscribe = gamepads.subscribe((e) => {
      if (!e.pressed) return;
      const isStick = e.button >= STICK_LEFT && e.button <= STICK_UP;
      if (isStick && !settings.gamepad.stick) return;
      updateSettings((s) => ({ ...s, gamepad: { ...s.gamepad, bindings: bind(s.gamepad.bindings, capture.command, capture.slot, e.button) } }));
      setCapture(null);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.code !== 'Backspace' && e.code !== 'Delete') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') {
        updateSettings((s) => ({ ...s, gamepad: { ...s.gamepad, bindings: bind(s.gamepad.bindings, capture.command, capture.slot, null) } }));
      }
      setCapture(null);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKey, { capture: true });
    };
  }, [capture, setCapture, settings.gamepad.stick]);

  const handling = settings[device].handling;
  const setHandling = (patch: Partial<Handling>) =>
    updateSettings((s) => ({ ...s, [device]: { ...s[device], handling: { ...s[device].handling, ...patch } } }));
  const label = (key: string | number) => (device === 'keyboard' ? keyLabel(key as string) : buttonLabel(key as number, padKind ?? 'generic'));

  return (
    <>
      <div className="mt-10 flex items-center justify-between gap-4">
        <Segmented
          small
          value={device}
          onChange={setDevice}
          options={[
            ['keyboard', 'Keyboard'],
            ['gamepad', 'Controller'],
          ]}
        />
        <span className="label text-right">
          {padKind ? (
            <>
              <span className="mr-2 inline-block size-1.5 rounded-full bg-[#30d158] align-middle" />
              {PAD_NAMES[padKind]}
            </>
          ) : (
            'No controller · press any button'
          )}
        </span>
      </div>

      <Section label="Handling" note="Same units as TETR.IO. One frame is 16.7 ms.">
        <SliderRow
          name="DAS"
          hint="Delay before a held direction starts repeating"
          min={1}
          max={20}
          step={0.1}
          value={handling.das / FRAME_MS}
          display={(f) => `${f.toFixed(1)}F`}
          sub={(f) => `${Math.round(f * FRAME_MS)} ms`}
          onChange={(f) => setHandling({ das: f * FRAME_MS })}
        />
        <SliderRow
          name="ARR"
          hint="Time between repeated moves. 0 is instant"
          min={0}
          max={5}
          step={0.1}
          value={handling.arr / FRAME_MS}
          display={(f) => `${f.toFixed(1)}F`}
          sub={(f) => `${Math.round(f * FRAME_MS)} ms`}
          onChange={(f) => setHandling({ arr: f * FRAME_MS })}
        />
        <SliderRow
          name="SDF"
          hint="How much faster soft drop falls"
          min={5}
          max={41}
          step={1}
          value={Number.isFinite(handling.sdf) ? handling.sdf : 41}
          display={(v) => (v >= 41 ? '∞' : `${v}×`)}
          sub={(v) => (v >= 41 ? 'instant' : 'gravity')}
          onChange={(v) => setHandling({ sdf: v >= 41 ? Infinity : v })}
        />
        <SliderRow
          name="DCD"
          hint="Pause before a charged DAS moves a new piece"
          min={0}
          max={20}
          step={0.1}
          value={handling.dcd / FRAME_MS}
          display={(f) => `${f.toFixed(1)}F`}
          sub={(f) => `${Math.round(f * FRAME_MS)} ms`}
          onChange={(f) => setHandling({ dcd: f * FRAME_MS })}
        />
        <ToggleRow
          name="Cancel DAS on direction change"
          hint="Pressing the other direction restarts the charge"
          value={handling.cancelDasOnDirectionChange}
          onChange={(v) => setHandling({ cancelDasOnDirectionChange: v })}
        />
      </Section>

      {device === 'gamepad' && (
        <Section label="Stick">
          <ToggleRow
            name="Use left stick"
            hint="Move and soft drop with the analog stick"
            value={settings.gamepad.stick}
            onChange={(stick) => updateSettings((s) => ({ ...s, gamepad: { ...s.gamepad, stick } }))}
          />
          <SliderRow
            name="Deadzone"
            hint="How far the stick travels before it counts"
            min={0.1}
            max={0.9}
            step={0.05}
            value={settings.gamepad.deadzone}
            display={(v) => `${Math.round(v * 100)}%`}
            onChange={(deadzone) => updateSettings((s) => ({ ...s, gamepad: { ...s.gamepad, deadzone } }))}
          />
        </Section>
      )}

      <Section
        label={device === 'keyboard' ? 'Keys' : 'Buttons'}
        note={capture ? 'Waiting for input · Esc cancels · Backspace clears' : 'Select a slot, then press the new input.'}
      >
        {COMMANDS.map(({ id, label: name }) => {
          const keys: (string | number)[] = settings[device].bindings[id].filter(
            (k) => device === 'keyboard' || settings.gamepad.stick || !(typeof k === 'number' && k >= STICK_LEFT && k <= STICK_UP),
          );
          return (
            <Row key={id} name={name}>
              <div className="flex gap-2">
                {Array.from({ length: MAX_BINDINGS }, (_, slot) => {
                  const active = capture?.device === device && capture.command === id && capture.slot === Math.min(slot, keys.length);
                  const key = keys[slot];
                  return (
                    <button
                      key={slot}
                      data-nav
                      onClick={() => setCapture({ device, command: id, slot: Math.min(slot, keys.length) })}
                      className={`tabular h-9 min-w-[88px] rounded-full px-4 text-[13px] font-medium transition-all duration-200 ease-spring ${focusRing} ${
                        active
                          ? 'animate-pulse bg-accent text-black'
                          : key !== undefined
                            ? 'hairline bg-white/[0.06] hover:bg-white/[0.1]'
                            : 'text-faint shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] hover:text-muted'
                      }`}
                    >
                      {active ? 'Press…' : key !== undefined ? label(key) : '+'}
                    </button>
                  );
                })}
              </div>
            </Row>
          );
        })}
      </Section>
    </>
  );
}

// ── Building blocks ─────────────────────────────────────────────

function Segmented<T extends string>({
  value,
  onChange,
  options,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  small?: boolean;
}) {
  return (
    <div className="hairline inline-flex shrink-0 rounded-full bg-tile p-1">
      {options.map(([id, name]) => (
        <button
          key={id}
          data-nav
          onClick={() => onChange(id)}
          className={`rounded-full font-medium transition-all duration-250 ease-spring ${focusRing} ${small ? 'px-4 py-1.5 text-[13px]' : 'px-5 py-2 text-[14px]'} ${
            value === id ? 'bg-fg text-black' : 'text-muted hover:text-fg'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function Section({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
        <span className="label">{label}</span>
        {note && <span className="text-right text-[12px] text-faint">{note}</span>}
      </div>
      <div className="hairline overflow-hidden rounded-[28px] bg-tile">{children}</div>
    </section>
  );
}

function Row({ name, hint, children }: { name: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-6 py-4 first:border-t-0 sm:px-7">
      <div className="min-w-0">
        <div className="text-[16px] font-medium tracking-[-0.01em]">{name}</div>
        {hint && <div className="mt-0.5 text-[13px] text-faint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function SliderRow(props: {
  name: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: (v: number) => string;
  sub?: (v: number) => string;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const { min, max, step, value } = props;
  const rounded = Math.round(value / step) * step;
  const fill = ((rounded - min) / (max - min)) * 100;
  return (
    <Row name={props.name} hint={props.hint}>
      <div className="flex w-full items-center gap-5 sm:w-[320px]">
        <input
          data-nav
          type="range"
          className="slider flex-1"
          min={min}
          max={max}
          step={step}
          value={rounded}
          style={{ '--fill': `${fill}%` } as React.CSSProperties}
          onChange={(e) => props.onChange(Number(e.target.value))}
          onPointerUp={props.onCommit}
          onKeyUp={props.onCommit}
        />
        <div className="w-[64px] text-right">
          <div className="tabular text-[16px] font-medium leading-none">{props.display(rounded)}</div>
          {props.sub && <div className="tabular mt-1 text-[11px] text-faint">{props.sub(rounded)}</div>}
        </div>
      </div>
    </Row>
  );
}

function ToggleRow({ name, hint, value, onChange }: { name: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row name={name} hint={hint}>
      <button
        data-nav
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-200 ${focusRing} ${value ? 'bg-[#30d158]' : 'bg-white/[0.14]'}`}
      >
        <span
          className={`absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-sm transition-transform duration-250 ease-spring ${
            value ? 'translate-x-[22px]' : ''
          }`}
        />
      </button>
    </Row>
  );
}
