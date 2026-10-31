import { FRAME_MS, type Handling } from '@tetra/engine';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Row, Section, Segmented, SliderRow, ToggleRow } from '../ui/controls';
import { SOUND_PACK_NAMES, sfx } from '../audio/sfx';
import type { FxLevel } from '../game/fx';
import { gamepads } from '../game/gamepad';
import { skinLocked } from '../lib/tournament';
import { SKIN_ORDER, SKINS, type Skin, type SoundPackId } from '../game/skins';
import { SkinSwatch } from '../ui/SkinSwatch';
import { DemoBoard } from '../ui/DemoBoard';
import { BugReportForm } from '../ui/BugReport';
import { touchDevice } from '../game/touch';
import { TRACKS } from '../audio/catalog';
import { skinUnlockHint } from '../lib/achievements';
import { ControllerPreview, KeyboardPreview, SUPPORTED_PADS } from '../ui/ControlsPreview';
import { Icon, type IconName } from '../ui/Icon';
import { buttonLabel, keyLabel, PAD_NAMES } from '../lib/labels';
import { useMenuNav } from '../lib/nav';
import { Glyph } from '../ui/Glyph';
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
type Category = 'experience' | 'visuals' | 'sound' | 'controls' | 'handling' | 'accessibility' | 'feedback' | 'developer';
type Capture = { device: Device; command: Command; slot: number } | null;

const CATEGORIES: [Category, string, string][] = [
  ['experience', 'Experience', 'How TETRA sounds and feels'],
  ['visuals', 'Visuals', 'Skin, room, effects, grid'],
  ['sound', 'Sound', 'Volumes, music, sound pack'],
  ['controls', 'Controls', 'Keys and buttons'],
  ['handling', 'Handling', 'DAS, ARR, soft drop'],
  ['accessibility', 'Accessibility', 'Flashing and motion'],
  ['feedback', 'Report a bug', 'Bugs, glitches and ideas'],
];

const FROM_TAB: Record<Tab, Category> = { appearance: 'visuals', sound: 'sound', controls: 'controls' };

function usePadKind() {
  return useSyncExternalStore(
    (l) => gamepads.onStatus(l),
    () => gamepads.kind,
  );
}

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

type Preset = 'experience' | 'focus' | 'custom';

function presetOf(s: ReturnType<typeof useSettings>): Preset {
  const parts = [s.experience, s.audio.club, s.audio.dj, s.appearance.ambient];
  if (parts.every(Boolean)) return 'experience';
  if (parts.every((p) => !p)) return 'focus';
  return 'custom';
}

/**
 * Settings: categories on the left, the controls in the middle and, on wide
 * screens, a board on the right that plays in your skin and room so every
 * change is seen (and heard) at once.
 */
export function Settings({
  onBack,
  onMusicLab,
  onExperience,
  initialTab,
}: {
  onBack: () => void;
  onMusicLab?: () => void;
  onExperience?: () => void;
  initialTab?: Tab;
}) {
  const settings = useSettings();
  const [category, setCategory] = useState<Category>(initialTab ? FROM_TAB[initialTab] : 'experience');
  const [capture, setCapture] = useState<Capture>(null);
  const [device, setDevice] = useState<Device>('keyboard');
  useMenuNav(onBack, capture === null);
  const categories = settings.developer ? [...CATEGORIES, ['developer', 'Developer', 'Labs and unlocks'] as [Category, string, string]] : CATEGORIES;
  const preset = presetOf(settings);
  const title = categories.find(([id]) => id === category)!;

  return (
    <div className="fixed inset-0 flex overflow-hidden max-md:flex-col max-md:overflow-y-auto">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-line px-6 py-6 max-md:w-full max-md:border-r-0 max-md:border-b max-md:px-5 max-md:pb-4">
        <button data-nav onClick={onBack} className={`glass -ml-1 self-start rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`}>
          <span className="flex items-center gap-2">
            <Icon name="back" size={12} /> Back <Glyph k="back" className="text-white/40" />
          </span>
        </button>
        <h1 className="mt-10 text-[40px] leading-none font-[520] tracking-[-0.045em] max-md:mt-6 max-md:text-[32px]">Settings</h1>

        <div className="mt-8 max-md:mt-5">
          <div className="label mb-3">Preset</div>
          <div className="glass-panel grid grid-cols-3 rounded-full p-1">
            {(
              [
                ['experience', 'Experience'],
                ['focus', 'Focus'],
                ['custom', 'Custom'],
              ] as [Preset, string][]
            ).map(([id, name]) => (
              <button
                key={id}
                data-nav
                disabled={id === 'custom'}
                onClick={() => setExperience(id === 'experience')}
                className={`rounded-full py-2 text-[13px] font-medium transition-all duration-300 ease-spring disabled:cursor-default ${focusRing} ${
                  preset === id ? 'bg-fg text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]' : 'text-muted enabled:hover:text-fg'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            {preset === 'experience'
              ? 'Sound, light and play as one. How we play TETRA.'
              : preset === 'focus'
                ? 'For training: no rooms, no club, instant restarts.'
                : 'Your own mix of the two.'}
          </p>
        </div>

        <nav className="mt-8 flex flex-col gap-1 max-md:-mx-5 max-md:mt-5 max-md:flex-row max-md:overflow-x-auto max-md:px-5 max-md:pb-1 max-md:[scrollbar-width:none]">
          {categories.map(([id, name, hint]) => (
            <button
              key={id}
              data-nav
              onClick={() => setCategory(id)}
              onFocus={() => setCategory(id)}
              className={`group relative shrink-0 rounded-[16px] px-4 py-2.5 text-left transition-colors duration-200 ${focusRing} ${category === id ? 'glass-panel' : 'hover:bg-white/[0.04]'}`}
            >
              <span className="flex items-center gap-3.5">
                <Icon name={id as IconName} size={14} className={category === id ? 'text-fg' : 'text-faint group-hover:text-muted'} />
                <span>
                  <span
                    className={`block text-[15px] font-medium tracking-[-0.01em] ${category === id ? 'text-fg' : 'text-muted group-hover:text-fg'}`}
                  >
                    {name}
                  </span>
                  <span className="block text-[12px] text-faint max-md:hidden">{hint}</span>
                </span>
              </span>
            </button>
          ))}
        </nav>

        <button
          onClick={() => {
            if (window.confirm('Reset all settings to their defaults?')) resetSettings();
          }}
          className={`mt-auto self-start text-[12px] font-medium text-faint transition-colors hover:text-fg max-md:hidden ${focusRing}`}
        >
          Reset to defaults
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-10 py-10 max-md:overflow-visible max-md:px-5 max-md:py-6">
        <div key={category} className="animate-rise mx-auto w-full max-w-[680px] pb-16">
          <div className="label">{title[1]}</div>
          <p className="mt-2 mb-8 text-[22px] font-[480] tracking-[-0.025em] text-muted">{title[2]}</p>
          {category === 'experience' && <ExperiencePanel onAbout={onExperience} />}
          {category === 'visuals' && <AppearancePanel />}
          {category === 'sound' && <SoundPanel />}
          {category === 'controls' && (
            <ControlsPanel device={device} setDevice={setDevice} capture={capture} setCapture={setCapture} part="bindings" />
          )}
          {category === 'handling' && (
            <ControlsPanel device={device} setDevice={setDevice} capture={capture} setCapture={setCapture} part="handling" />
          )}
          {category === 'accessibility' && <AccessibilityPanel />}
          {category === 'feedback' && <BugReportForm />}
          {category === 'developer' && <DeveloperSection onMusicLab={onMusicLab} />}
        </div>
      </main>

      <LivePreview />
    </div>
  );
}

/** A board that plays itself with every current setting, room included. */
function LivePreview() {
  const { appearance } = useSettings();
  const skin = SKINS[appearance.skin];
  return (
    <section className="relative hidden w-[min(34vw,520px)] shrink-0 border-l border-line xl:block">
      <div className="absolute inset-5 overflow-hidden rounded-[36px] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <DemoBoard mode="endless" skin={appearance.skin} live className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-end p-6">
          <span className="glass-panel rounded-full px-3 py-1.5 text-[12px] font-medium">{skin.name}</span>
        </div>
      </div>
    </section>
  );
}

// ── Experience ──────────────────────────────────────────────────

function ExperiencePanel({ onAbout }: { onAbout?: () => void }) {
  const { audio, experience } = useSettings();
  const set = (patch: Partial<typeof audio>) => updateSettings((s) => ({ ...s, audio: { ...s.audio, ...patch } }));
  return (
    <>
      <section className="glass-panel relative overflow-hidden rounded-[30px] p-7">
        <div
          aria-hidden
          className={`exp-glow pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl transition-opacity duration-700 ${experience ? 'opacity-100' : 'opacity-0'}`}
        />
        <div className="relative flex items-start justify-between gap-6">
          <div>
            <div className="text-[26px] leading-tight font-[520] tracking-[-0.03em]">{experience ? 'TETRA Experience is on.' : 'Focus is on.'}</div>
            <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-muted">
              {experience
                ? 'TETRA the way it is meant to be played: club sound, binaural on headphones, a live DJ on your game, rooms that move with every beat and an intro before each game. Turn it off for Focus.'
                : 'Rooms, backgrounds and motion are off: just the stack, for practice. Turn the TETRA Experience back on to play TETRA the way it is meant to be played.'}
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
            <span
              className={`absolute top-1 left-1 size-6 rounded-full bg-black transition-transform duration-300 ease-spring ${experience ? 'translate-x-6' : ''}`}
            />
          </button>
        </div>
      </section>

      <Section label="Sound of the Experience">
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
        <ToggleRow
          name="Club sound"
          hint="Sub, glue, width and a concrete room around the music"
          value={audio.club}
          onChange={(club) => set({ club })}
        />
        <ToggleRow
          name="Live DJ"
          hint="Your stack, combos and big clears play the music's filter and delay"
          value={audio.dj}
          onChange={(dj) => set({ dj })}
        />
      </Section>
    </>
  );
}

// ── Accessibility ───────────────────────────────────────────────

function AccessibilityPanel() {
  const { appearance } = useSettings();
  const set = (patch: Partial<AppearanceSettings>) => updateSettings((s) => ({ ...s, appearance: { ...s.appearance, ...patch } }));
  return (
    <Section label="Flashing">
      <ToggleRow
        name="Reduce flashing"
        hint="No strobes on drops and softer flashes. Recommended if you are sensitive to flashing lights"
        value={appearance.reduceFlashing}
        onChange={(reduceFlashing) => set({ reduceFlashing })}
      />
      <p className="border-t border-line px-6 py-4 text-[12px] leading-relaxed text-faint sm:px-7">
        Photosensitivity notice: with the room on Full, scenes can flash and pulse with the music, including short strobes on drops. If you or anyone
        watching has epilepsy or is sensitive to flashing lights, turn on Reduce flashing or set the room to Calm. TETRA also follows your system's
        reduced motion setting.
      </p>
    </Section>
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
        <ToggleRow
          name="Action text"
          hint="T-SPIN DOUBLE, B2B, combos"
          value={appearance.actionText}
          onChange={(actionText) => set({ actionText })}
        />
        <ToggleRow
          name="Smooth falling"
          hint="Glide between rows instead of stepping"
          value={appearance.smoothFall}
          onChange={(smoothFall) => set({ smoothFall })}
        />
        <ToggleRow name="Ghost piece" hint="Shows where the piece will land" value={appearance.ghost} onChange={(ghost) => set({ ghost })} />
        <Row name="Room" hint="Each skin's light behind the board, reacting to your play and the music">
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
        <Row
          name="Room quality"
          hint={appearance.sceneQuality === 'auto' ? 'Adapts to your device so the game always runs smooth' : 'Fixed resolution for the rooms'}
        >
          <Segmented
            small
            value={appearance.sceneQuality}
            onChange={(sceneQuality) => set({ sceneQuality })}
            options={[
              ['auto', 'Auto'],
              ['high', 'High'],
              ['medium', 'Med'],
              ['low', 'Low'],
            ]}
          />
        </Row>
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
        <div className="mt-1 text-[12px] leading-snug text-faint">
          {locked ? skinUnlockHint(skin.id) : skin.description}
        </div>
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
        <Row
          name="In game"
          hint={
            audio.musicMode === 'skin'
              ? 'Each skin plays its own track'
              : audio.musicMode === 'shuffle'
                ? 'Any track, one after another'
                : 'Menus only'
          }
        >
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

      <Credits />
    </>
  );
}

/** Who made the music, and under which licence: tucked away at the end of Sound. */
function Credits() {
  const [open, setOpen] = useState(false);
  return (
    <Section label="Music credits" note="Every track, its artist and its licence.">
      <button
        data-nav
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between px-6 py-4 text-left hover:bg-white/[0.03] sm:px-7 ${focusRing} focus-visible:ring-inset`}
      >
        <span className="text-[15px] text-muted">{open ? 'Hide credits' : `Show credits · ${TRACKS.length} tracks`}</span>
        <span className={`text-muted transition-transform duration-300 ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open &&
        TRACKS.map((t) => (
          <div key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line px-6 py-3 text-[13px] sm:px-7">
            <span className="min-w-0">
              <span className="text-fg">{t.title}</span>
              <span className="text-faint">
                {' '}
                · {t.artist}
                {t.album ? ` · ${t.album}` : ''}
              </span>
            </span>
            <span className="flex items-center gap-4">
              {t.source && (
                <a href={t.source} target="_blank" rel="noreferrer" className="text-faint transition-colors hover:text-fg">
                  Source
                </a>
              )}
              {t.licenseUrl ? (
                <a href={t.licenseUrl} target="_blank" rel="noreferrer" className="text-faint transition-colors hover:text-fg">
                  {t.license}
                </a>
              ) : (
                <span className="text-faint">{t.license}</span>
              )}
            </span>
          </div>
        ))}
    </Section>
  );
}

// ── Controls ────────────────────────────────────────────────────

function ControlsPanel({
  device,
  setDevice,
  capture,
  setCapture,
  part,
}: {
  device: Device;
  setDevice: (d: Device) => void;
  capture: Capture;
  setCapture: (c: Capture) => void;
  part: 'bindings' | 'handling';
}) {
  const settings = useSettings();
  const padKind = usePadKind();

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
      <div className="mb-8 flex items-center justify-between gap-4">
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

      {part === 'handling' && (
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
      )}

      {part === 'handling' && device === 'gamepad' && (
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

      {part === 'bindings' && touchDevice && (
        <div className="glass-panel mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-[28px] p-6 sm:grid-cols-4">
          {(
            [
              ['Move', 'Drag sideways'],
              ['Rotate', 'Tap (two fingers: the other way)'],
              ['Drop', 'Flick down · drag down for soft'],
              ['Hold', 'Flick up'],
            ] as const
          ).map(([action, gesture]) => (
            <div key={action}>
              <div className="text-[15px] font-semibold">{action}</div>
              <div className="mt-1 text-[13px] leading-snug text-muted">{gesture}</div>
            </div>
          ))}
        </div>
      )}

      {part === 'bindings' && (
        <div className="glass-panel mb-10 rounded-[28px] px-6 pt-6 pb-5">
          {device === 'keyboard' ? (
            <KeyboardPreview bindings={settings.keyboard.bindings} />
          ) : (
            <>
              <ControllerPreview bindings={settings.gamepad.bindings} kind={padKind ?? 'xbox'} stick={settings.gamepad.stick} />
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {SUPPORTED_PADS.map((name) => (
                  <span key={name} className="rounded-full px-3 py-1 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                    {name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {part === 'bindings' && (
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
      )}
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
