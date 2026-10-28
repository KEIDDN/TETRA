import { FRAME_MS, type Handling } from '@tetra/engine';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { gamepads } from '../game/gamepad';
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
  type Command,
  type Device,
} from '../lib/settings';

type Capture = { device: Device; command: Command; slot: number } | null;

function usePadKind() {
  return useSyncExternalStore(
    (l) => gamepads.onStatus(l),
    () => gamepads.kind,
  );
}

export function Settings({ onBack }: { onBack: () => void }) {
  const settings = useSettings();
  const padKind = usePadKind();
  const [device, setDevice] = useState<Device>('keyboard');
  const [capture, setCapture] = useState<Capture>(null);

  useMenuNav(onBack, capture === null);

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
  }, [capture]);

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
  }, [capture, settings.gamepad.stick]);

  const handling = settings[device].handling;
  const setHandling = (patch: Partial<Handling>) =>
    updateSettings((s) => ({ ...s, [device]: { ...s[device], handling: { ...s[device].handling, ...patch } } }));

  const label = (key: string | number) =>
    device === 'keyboard' ? keyLabel(key as string) : buttonLabel(key as number, padKind ?? 'generic');

  return (
    <div className="min-h-full px-5 pb-24 sm:px-10">
      <header className="mx-auto flex h-20 w-full max-w-[760px] items-center justify-between">
        <button
          data-nav
          onClick={onBack}
          className="-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted outline-none transition-colors duration-150 hover:text-fg focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          ← Back <span className="label ml-2">Esc</span>
        </button>
        <span className="label">Settings</span>
      </header>

      <main className="animate-rise mx-auto w-full max-w-[760px]">
        <h1 className="mt-6 text-[clamp(44px,8vw,72px)] font-[480] leading-none tracking-[-0.045em]">Settings</h1>

        <div className="mt-10 flex items-center justify-between gap-4">
          <Segmented value={device} onChange={setDevice} />
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
                    const active = capture?.device === device && capture.command === id && capture.slot === slot;
                    const key = keys[slot];
                    return (
                      <button
                        key={slot}
                        data-nav
                        onClick={() => setCapture({ device, command: id, slot: Math.min(slot, keys.length) })}
                        className={`tabular h-9 min-w-[88px] rounded-full px-4 text-[13px] font-medium outline-none transition-all duration-200 ease-spring focus-visible:ring-2 focus-visible:ring-accent/60 ${
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

        <div className="mt-10 flex justify-end">
          <button
            data-nav
            onClick={() => {
              if (window.confirm('Reset all settings to their defaults?')) resetSettings();
            }}
            className="rounded-full px-5 py-2.5 text-[14px] font-medium text-muted outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Reset to defaults
          </button>
        </div>
      </main>
    </div>
  );
}

function Segmented({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  const options: [Device, string][] = [
    ['keyboard', 'Keyboard'],
    ['gamepad', 'Controller'],
  ];
  return (
    <div className="hairline inline-flex rounded-full bg-tile p-1">
      {options.map(([id, name]) => (
        <button
          key={id}
          data-nav
          onClick={() => onChange(id)}
          className={`rounded-full px-5 py-2 text-[14px] font-medium outline-none transition-all duration-250 ease-spring focus-visible:ring-2 focus-visible:ring-accent/60 ${
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
        className={`relative h-[30px] w-[52px] shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/60 ${
          value ? 'bg-[#30d158]' : 'bg-white/[0.14]'
        }`}
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
