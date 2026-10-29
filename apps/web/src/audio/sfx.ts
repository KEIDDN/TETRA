import type { ClearInfo, GameEvent } from '@tetra/engine';
import { SKINS, type SoundPackId } from '../game/skins';
import { getSettings } from '../lib/settings';

/**
 * Modal synthesis: a struck object rings at a few inharmonic frequencies
 * (its modes), each decaying at its own rate. A handful of sine partials
 * plus a tiny noise transient reads as a real material, which is what
 * makes interface sounds feel crafted rather than synthetic.
 */
interface Material {
  /** [frequency ratio, relative gain, decay seconds] */
  modes: readonly (readonly [number, number, number])[];
  /** Level of the click at the start of the strike. */
  transient: number;
}

const WOOD: Material = {
  modes: [
    [1, 1, 0.045],
    [2.57, 0.45, 0.022],
    [4.21, 0.2, 0.012],
  ],
  transient: 0.9,
};
const CERAMIC: Material = {
  modes: [
    [1, 1, 0.09],
    [2.32, 0.4, 0.05],
    [4.25, 0.18, 0.03],
    [6.63, 0.08, 0.02],
  ],
  transient: 0.6,
};
const GLASS: Material = {
  modes: [
    [1, 1, 0.55],
    [2.76, 0.42, 0.3],
    [5.4, 0.2, 0.15],
    [8.93, 0.08, 0.08],
  ],
  transient: 0.35,
};
const MARIMBA: Material = {
  modes: [
    [1, 1, 0.42],
    [3.93, 0.3, 0.12],
    [9.24, 0.08, 0.04],
  ],
  transient: 0.5,
};
const PURE: Material = {
  modes: [
    [1, 1, 0.32],
    [2, 0.12, 0.12],
  ],
  transient: 0.15,
};

interface Pack {
  /** Movement detents. */
  tick: Material;
  /** Rotations, locks, menu taps. */
  tap: Material;
  /** Line clears and cues. */
  chime: Material;
  /** Transposition of the chimes, semitones. */
  register: number;
  /** Reverb send for chimes. */
  room: number;
}

const PACKS: Record<SoundPackId, Pack> = {
  studio: { tick: WOOD, tap: CERAMIC, chime: GLASS, register: 0, room: 0.14 },
  glass: { tick: CERAMIC, tap: CERAMIC, chime: GLASS, register: 12, room: 0.22 },
  wood: { tick: WOOD, tap: WOOD, chime: MARIMBA, register: -12, room: 0.1 },
  pure: { tick: PURE, tap: PURE, chime: PURE, register: 0, room: 0.08 },
};

export const SOUND_PACK_NAMES: Record<SoundPackId, string> = {
  studio: 'Studio',
  glass: 'Glass',
  wood: 'Wood',
  pure: 'Pure',
};

/** Major pentatonic: each combo step lands on a note that agrees with the last. */
const PENTATONIC = [0, 2, 4, 7, 9];
const ROOT = 76; // E5
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
/** A little pitch scatter so repeated ticks don't sound machine-identical. */
const humanize = (f: number) => f * (1 + (Math.random() - 0.5) * 0.03);

interface StrikeOptions {
  gain: number;
  /** Decay multiplier. */
  length?: number;
  send?: number;
  pan?: number;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private room!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private lastTick = 0;
  private hardDropped = false;
  private pack: Pack = PACKS.studio;

  private unlockListeners = new Set<(ctx: AudioContext) => void>();

  /** Audio can only start after a user gesture; call from input handlers. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.build(this.ctx);
      const ctx = this.ctx;
      this.unlockListeners.forEach((l) => l(ctx));
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** The shared audio context, once a gesture has unlocked it (music plays through it too). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Calls back with the context as soon as audio is unlocked (right away if it already is). */
  onUnlock(listener: (ctx: AudioContext) => void): void {
    if (this.ctx) listener(this.ctx);
    else this.unlockListeners.add(listener);
  }

  // ── Game ──────────────────────────────────────────────────────

  onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'move':
        return this.move();
      case 'rotate':
        return this.rotate();
      case 'hold':
        return this.hold();
      case 'hardDrop':
        this.hardDropped = true;
        return this.hardDrop(e.distance);
      case 'lock':
        if (!this.hardDropped) this.lock();
        this.hardDropped = false;
        return;
      case 'clear':
        return this.clear(e.info);
      case 'levelUp':
        return this.levelUp();
      case 'garbageRise':
        return this.play((t) => {
          this.strike(t, WOOD, 105, { gain: 0.16 + Math.min(e.lines, 8) * 0.015, length: 2.6 });
          this.noise(t, 0.04, 0.06, 500, 200, 'lowpass');
        });
      case 'attack':
        // A soft breath as lines leave toward the opponent.
        return this.play((t) => this.noise(t, 0.028, 0.16, 1400, 5200, 'bandpass'));
    }
  }

  move(): void {
    const now = performance.now();
    if (now - this.lastTick < 24) return;
    this.lastTick = now;
    // A soft, breathy click: pitched ticks get tiring at DAS speed.
    this.play((t) => this.softClick(t, getSettings().audio.movement));
  }

  /** Filtered noise with a whisper of tone; easy on the ear even when repeated fast. */
  private softClick(t: number, level: number): void {
    this.noise(t, 0.032 * level, 0.014, 3600, 0, 'bandpass');
    this.strike(t, PURE, 2600, { gain: 0.012 * level, length: 0.06 });
  }

  /** Rotations make exactly the move click: one soft family for every input. */
  rotate(): void {
    this.move();
  }

  hold(): void {
    this.play((t, p) => {
      this.noise(t, 0.03, 0.05, 2400, 5200, 'bandpass');
      this.strike(t + 0.02, p.tick, humanize(1300), { gain: 0.035 });
    });
  }

  hardDrop(distance: number): void {
    const weight = 0.75 + Math.min(distance, 20) / 50;
    this.play((t) => {
      this.strike(t, WOOD, 150, { gain: 0.22 * weight, length: 2.2 });
      this.strike(t, CERAMIC, 520, { gain: 0.03 * weight, length: 0.5 });
      this.noise(t, 0.06 * weight, 0.03, 700, 300, 'lowpass');
    });
  }

  lock(): void {
    this.play((t, p) => this.strike(t, p.tap, humanize(430), { gain: 0.06, length: 0.7 }));
  }

  clear(info: ClearInfo): void {
    this.play((t, p) => {
      const step = Math.max(0, info.combo);
      const base = ROOT + p.register + PENTATONIC[step % 5] + 12 * Math.min(1, Math.floor(step / 5));
      const chime = (notes: number[], gap: number, gain: number, length = 1) =>
        notes.forEach((n, i) => this.strike(t + i * gap, p.chime, midi(base + n), { gain, length, send: p.room, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.3 }));

      if (info.perfectClear) return chime([0, 4, 7, 11, 14, 19, 24], 0.045, 0.045, 1.6);
      if (info.spin !== 'none') {
        const notes = info.lines === 0 ? [0, 12] : info.spin === 'mini' ? [0, 7, 12] : [0, 7, 14, 19].slice(0, info.lines + 1);
        chime(notes, 0.03, info.lines ? 0.05 : 0.03, 1.2);
        this.noise(t, 0.012, 0.25, 7000, 11000, 'bandpass');
      } else {
        const notes = [[], [0], [0, 7], [0, 4, 7], [0, 4, 7, 12]][Math.min(info.lines, 4)];
        chime(notes, 0.028, 0.055, info.lines >= 4 ? 1.4 : 1);
      }
      // Back-to-back adds weight underneath rather than more notes on top.
      if (info.lines > 0 && info.b2b >= 1) this.strike(t, PURE, midi(base - 12), { gain: 0.035, length: 1.2 });
    });
  }

  levelUp(): void {
    this.play((t, p) => [0, 7, 12].forEach((n, i) => this.strike(t + i * 0.06, p.chime, midi(ROOT + 5 + n + p.register), { gain: 0.04, send: p.room })));
  }

  countdown(_step: number): void {
    this.play((t, p) => this.strike(t, p.tap, midi(ROOT + 7), { gain: 0.06, length: 1.2 }));
  }

  go(): void {
    this.play((t, p) => {
      this.strike(t, p.chime, midi(ROOT + 12 + p.register), { gain: 0.05, send: p.room });
      this.strike(t + 0.03, p.chime, midi(ROOT + 19 + p.register), { gain: 0.035, send: p.room });
    });
  }

  end(kind: 'topout' | 'finished'): void {
    this.play((t, p) => {
      if (kind === 'finished') {
        [0, 4, 7, 12, 16].forEach((n, i) => this.strike(t + i * 0.07, p.chime, midi(ROOT + n + p.register), { gain: 0.05, length: 1.6, send: p.room }));
      } else {
        [7, 4, 0].forEach((n, i) => this.strike(t + i * 0.12, WOOD, midi(ROOT - 24 + n), { gain: 0.08, length: 3 }));
      }
    });
  }

  /** A personal best: a bright, rising chord that hangs in the room. */
  personalBest(): void {
    this.play((t, p) => {
      [0, 7, 12, 16, 19, 24].forEach((n, i) => this.strike(t + i * 0.055, p.chime, midi(ROOT + 12 + n + p.register), { gain: 0.04, length: 2.2, send: p.room }));
      this.strike(t + 0.33, PURE, midi(ROOT + p.register), { gain: 0.03, length: 2.4 });
    });
  }

  // ── Menus ─────────────────────────────────────────────────────

  ui(kind: 'move' | 'select' | 'back'): void {
    this.play((t, p) => {
      if (kind === 'move') this.softClick(t, 0.7);
      else this.strike(t, p.tap, kind === 'select' ? 1760 : 1175, { gain: 0.04, length: 0.8 });
    });
  }

  /** A sample of a pack, for the settings screen. */
  preview(pack: SoundPackId): void {
    this.play((t, p) => {
      this.strike(t, p.tick, 2300, { gain: 0.05, length: 0.7 });
      this.strike(t + 0.08, p.tick, 2300, { gain: 0.05, length: 0.7 });
      [0, 4, 7, 12].forEach((n, i) => this.strike(t + 0.22 + i * 0.028, p.chime, midi(ROOT + n + p.register), { gain: 0.05, length: 1.4, send: p.room }));
    }, pack);
  }

  // ── Synthesis ─────────────────────────────────────────────────

  private play(fn: (t: number, pack: Pack) => void, packId?: SoundPackId): void {
    const { audio, appearance } = getSettings();
    if (!audio.enabled || audio.volume <= 0) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.out.gain.setTargetAtTime(audio.volume, ctx.currentTime, 0.01);
    const id = packId ?? (audio.pack === 'match' ? SKINS[appearance.skin].sound : audio.pack);
    this.pack = PACKS[id] ?? PACKS.studio;
    fn(ctx.currentTime + 0.002, this.pack);
  }

  private build(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    limiter.connect(ctx.destination);

    this.out = ctx.createGain();
    this.out.gain.value = 0.7;
    this.out.connect(limiter);

    // A small, bright room: just enough air around the chimes.
    const length = Math.floor(ctx.sampleRate * 0.7);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 4;
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 7000;
    this.room = ctx.createGain();
    this.room.connect(convolver).connect(damp).connect(this.out);

    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const noise = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  }

  private output(node: AudioNode, send: number, pan: number): void {
    const ctx = this.ctx!;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner).connect(this.out);
    if (send > 0) {
      const wet = ctx.createGain();
      wet.gain.value = send;
      node.connect(wet).connect(this.room);
    }
  }

  /** Strikes a material at `freq`. */
  private strike(t: number, material: Material, freq: number, o: StrikeOptions): void {
    const ctx = this.ctx!;
    const bus = ctx.createGain();
    bus.gain.value = o.gain;
    const length = o.length ?? 1;
    for (const [ratio, gain, decay] of material.modes) {
      const f = freq * ratio;
      if (f > 18000) continue;
      const d = decay * length;
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(gain, t + 0.0015);
      env.gain.setTargetAtTime(0, t + 0.0015, d / 4);
      osc.connect(env).connect(bus);
      osc.start(t);
      osc.stop(t + d * 1.5 + 0.02);
    }
    if (material.transient > 0) this.noise(t, material.transient * 0.5, 0.004, Math.min(9000, freq * 3), 0, 'highpass', bus);
    this.output(bus, o.send ?? 0, o.pan ?? 0);
  }

  /** Filtered noise burst; `to` sweeps the filter. Routed to `into` or the output. */
  private noise(t: number, gain: number, decay: number, freq: number, to: number, type: BiquadFilterType, into?: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (to > 0) filter.frequency.exponentialRampToValueAtTime(to, t + decay);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.001);
    env.gain.setTargetAtTime(0, t + 0.001, decay / 3);
    src.connect(filter).connect(env);
    if (into) env.connect(into);
    else this.output(env, 0, 0);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay * 2 + 0.02);
  }
}

export const sfx = new Sfx();
