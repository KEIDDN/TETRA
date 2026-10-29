import { FRAME_MS, type Handling } from '@tetra/engine';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Row, Section, Segmented, SliderRow, ToggleRow } from '../ui/controls';
import { SOUND_PACK_NAMES, sfx } from '../audio/sfx';
import type { FxLevel } from '../game/fx';
import { gamepads } from '../game/gamepad';
import { CUPS, skinLocked } from '../lib/tournament';
import { SKIN_ORDER, SKINS, type Skin, type SoundPackId } from '../game/skins';
import { SkinSwatch } from '../ui/SkinSwatch';
import { buttonLabel, keyLabel, PAD_NAMES } from '../lib/labels';
import { useMenuNav } from '../lib/nav';
import {
  bind,
  COMMANDS,
  MAX_BINDINGS,
  resetSettings,
  setExperience,
  STICK_LEFT,
  STICK_UP,
  updateSettings,
  useSettings,
  type AppearanceSettings,
  type GridMode,
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

export function Settings({ onBack, onMusicLab, onExperience, initialTab = 'appearance' }: { onBack: () => void; onMusicLab?: () => void; onExperience?: () => void; initialTab?: Tab }) {
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
        <ExperienceCard onAbout={onExperience} />
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

        <DeveloperSection onMusicLab={onMusicLab} />

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

// ── TETRA Experience ────────────────────────────────────────────

/** The master switch, on top of everything. */
function ExperienceCard({ onAbout }: { onAbout?: () => void }) {
  const { experience } = useSettings();
  return (
    <section
      className="relative mt-10 overflow-hidden rounded-[32px] p-7 transition-[box-shadow] duration-500"
      style={{
        background: 'linear-gradient(135deg, #17171b 0%, #0e0e10 60%)',
        boxShadow: experience ? 'inset 0 0 0 1px rgba(237,235,250,0.22), 0 40px 100px -60px rgba(237,235,250,0.5)' : 'inset 0 0 0 1px rgba(255,255,255,0.07)',
      }}
    >
      <div aria-hidden className={`exp-glow pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl transition-opacity duration-700 ${experience ? 'opacity-100' : 'opacity-0'}`} />
      <div className="relative flex items-start justify-between gap-6">
        <div>
          <div className="label">TETRA Experience</div>
          <div className="mt-2 text-[28px] leading-tight font-medium tracking-[-0.03em]">{experience ? 'Sound and light, all in.' : 'Practice room.'}</div>
          <p className="mt-2 max-w-[440px] text-[14px] leading-relaxed text-muted">
            Club sound, binaural on headphones, the game playing DJ on the music, and scenes that live with every beat.
          </p>
          {onAbout && (
            <button data-nav onClick={onAbout} className={`mt-4 text-[13px] font-medium text-fg underline-offset-4 hover:underline ${focusRing}`}>
              What is the Experience →
            </button>
          )}
        </div>
        <button
          data-nav
          role="switch"
          aria-checked={experience}
          onClick={() => setExperience(!experience)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 ${experience ? 'bg-accent' : 'bg-white/15'} ${focusRing}`}
        >
          <span className={`absolute top-1 left-1 size-6 rounded-full bg-black transition-transform duration-300 ease-spring ${experience ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </section>
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
            <SkinCard key={id} skin={SKINS[id]} selected={appearance.skin === id} locked={skinLocked(id)} onSelect={() => set({ skin: id })} />
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
        <Row name="Background" hint="Each skin's scene behind the board, reacting to your play">
          <Segmented
            small
            value={appearance.ambient ? appearance.background : 'off'}
            onChange={(v) => set(v === 'off' ? { ambient: false } : { ambient: true, background: v })}
            options={[
              ['off', 'Off'],
              ['calm', 'Calm'],
              ['full', 'Full'],
            ]}
          />
        </Row>
        <ToggleRow
          name="Reduce flashing"
          hint="No strobes on drops and softer flashes. Recommended if you are sensitive to flashing lights"
          value={appearance.reduceFlashing}
          onChange={(reduceFlashing) => set({ reduceFlashing })}
        />
        <p className="border-t border-line px-6 py-4 text-[12px] leading-relaxed text-faint sm:px-7">
          Photosensitivity notice: with Background on Full, scenes can flash and pulse with the music, including short strobes on drops. If you or
          anyone watching has epilepsy or is sensitive to flashing lights, turn on Reduce flashing or set Background to Calm.
        </p>
        <Row name="Grid" hint="Auto lets each skin choose">
          <Segmented<GridMode>
            small
            value={appearance.grid}
            onChange={(grid) => set({ grid })}
            options={[
              ['auto', 'Auto'],
              ['lines', 'Lines'],
              ['dots', 'Dots'],
              ['off', 'Off'],
            ]}
          />
        </Row>
      </Section>
    </>
  );
}

/** A small stack for the gallery, piece by piece (y-up, 3 rows). */
function SkinCard({ skin, selected, locked, onSelect }: { skin: Skin; selected: boolean; locked: boolean; onSelect: () => void }) {

  return (
    <button
      data-nav
      disabled={locked && !selected}
      onClick={onSelect}
      className={`group relative flex flex-col items-start gap-4 bg-[#0b0b0c] p-5 disabled:cursor-default [&:disabled_canvas]:opacity-25 [&:disabled_canvas]:grayscale text-left transition-colors duration-150 hover:bg-[#111113] ${focusRing} focus-visible:ring-inset`}
    >
      <div className="flex h-[56px] w-full items-center justify-center">
        <SkinSwatch skin={skin} className="transition-transform duration-300 ease-spring group-hover:scale-[1.04]" />
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
        <div className="mt-1 text-[12px] leading-snug text-faint">{locked ? `Win ${CUPS.find((c) => c.reward === skin.id)?.name} to unlock` : skin.description}</div>
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
        <SliderRow
          name="Movement sounds"
          hint="Moves and rotations, on top of the master level"
          min={0}
          max={1}
          step={0.05}
          value={audio.movement}
          display={(v) => (v === 0 ? 'Off' : `${Math.round(v * 100)}%`)}
          onChange={(movement) => set({ movement })}
          onCommit={() => sfx.move()}
        />
      </Section>

      <Section label="Experience sound" note="Part of the TETRA Experience.">
        <Row name="Listening on" hint={audio.output === 'headphones' ? 'Binaural: the room around you' : 'Stereo, wide, club master'}>
          <Segmented
            small
            value={audio.output}
            onChange={(output) => set({ output })}
            options={[
              ['headphones', 'Headphones'],
              ['speakers', 'Speakers'],
            ]}
          />
        </Row>
        <ToggleRow name="Club sound" hint="Sub, glue, width and a concrete room around the music" value={audio.club} onChange={(club) => set({ club })} />
        <ToggleRow name="Live DJ" hint="Your stack, combos and big clears play the music's filter and delay" value={audio.dj} onChange={(dj) => set({ dj })} />
      </Section>

      <Section label="Music" note="Hypnotic techno for the game, deep ambient for the menus.">
        <SliderRow
          name="Music volume"
          hint="On its own fader, under the effects"
          min={0}
          max={1}
          step={0.05}
          value={audio.music}
          display={(v) => (v === 0 ? 'Off' : `${Math.round(v * 100)}%`)}
          onChange={(music) => set({ music })}
        />
        <Row name="In game" hint={audio.musicMode === 'skin' ? "Each skin plays its own track" : audio.musicMode === 'shuffle' ? 'Any track, one after another' : 'Menus only'}>
          <Segmented
            small
            value={audio.musicMode}
            onChange={(musicMode) => set({ musicMode })}
            options={[
              ['skin', 'Skin'],
              ['shuffle', 'Shuffle'],
              ['off', 'Off'],
            ]}
          />
        </Row>
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

/** Only visible once developer mode was switched on from the home screen. */
function DeveloperSection({ onMusicLab }: { onMusicLab?: () => void }) {
  const { developer } = useSettings();
  if (!developer) return null;
  return (
    <Section label="Developer">
      {onMusicLab && (
        <Row name="Music lab" hint="Audition the shortlist while playing and assign tracks to the menu and each skin">
          <button data-nav onClick={onMusicLab} className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-black">
            Open
          </button>
        </Row>
      )}
      <ToggleRow
        name="Developer mode"
        hint="Every bot, cup and skin unlocked. Tap the version five times on the home screen to bring this back."
        value={developer}
        onChange={(on) => updateSettings((s) => ({ ...s, developer: on }))}
      />
    </Section>
  );
}

