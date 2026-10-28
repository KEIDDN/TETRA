import type { ClearInfo, GameEvent } from '@tetra/engine';
import { SKINS, type SoundPackId } from '../game/skins';
import { getSettings } from '../lib/settings';

/** Timbre of a sound pack. Every sound is synthesized; there are no samples. */
interface Pack {
  wave: OscillatorType;
  /** Lowpass cutoff for tones, Hz. */
  bright: number;
  /** Inharmonic bell partial (0–1). */
  bell: number;
  /** Chorus detune between two oscillators, cents. */
  detune: number;
  /** Decay multiplier for tones. */
  decay: number;
  /** Level of the noise transient on movement sounds. */
  click: number;
  /** Reverb send (0–1). */
  reverb: number;
  /** Transposition, semitones. */
  octave: number;
}

const PACKS: Record<SoundPackId, Pack> = {
  soft: { wave: 'triangle', bright: 5200, bell: 0, detune: 0, decay: 1, click: 0.7, reverb: 0.22, octave: 0 },
  glass: { wave: 'sine', bright: 14000, bell: 0.45, detune: 0, decay: 1.7, click: 0.45, reverb: 0.42, octave: 12 },
  click: { wave: 'sine', bright: 9000, bell: 0, detune: 0, decay: 0.55, click: 1, reverb: 0.06, octave: 0 },
  neon: { wave: 'sawtooth', bright: 2400, bell: 0, detune: 9, decay: 1.15, click: 0.55, reverb: 0.3, octave: 0 },
  paper: { wave: 'triangle', bright: 2100, bell: 0, detune: 0, decay: 0.5, click: 0.9, reverb: 0.1, octave: -12 },
};

export const SOUND_PACK_NAMES: Record<SoundPackId, string> = {
  soft: 'Soft',
  glass: 'Glass',
  click: 'Click',
  neon: 'Neon',
  paper: 'Paper',
};

/** Major pentatonic: every combo step lands on a note that sounds good with the last. */
const PENTATONIC = [0, 2, 4, 7, 9];
const ROOT = 72; // C5

const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface ToneOptions {
  gain: number;
  decay: number;
  attack?: number;
  /** Glide target, Hz. */
  to?: number;
  wave?: OscillatorType;
  pan?: number;
  /** Overrides the pack's reverb send. */
  send?: number;
  cutoff?: number;
}

interface NoiseOptions {
  gain: number;
  decay: number;
  freq: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private out!: GainNode;
  private reverb!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private lastMove = 0;
  private hardDropped = false;

  /** Audio can only start after a user gesture; call from input handlers. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.build(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ── Game ──────────────────────────────────────────────────────

  onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'move':
        return this.move();
      case 'rotate':
        return this.rotate(e.spin);
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
    }
  }

  move(): void {
    const now = performance.now();
    if (now - this.lastMove < 22) return;
    this.lastMove = now;
    this.play((t, p) => {
      this.noise(t, { gain: 0.045 * p.click, decay: 0.014, freq: 3600, q: 1.4, type: 'bandpass' });
      this.tone(t, 2600, { gain: 0.012, decay: 0.018, wave: 'sine', send: 0 });
    });
  }

  rotate(spin: boolean): void {
    this.play((t, p) => {
      this.noise(t, { gain: 0.035 * p.click, decay: 0.016, freq: 2600, q: 1.2, type: 'bandpass' });
      this.tone(t, 1500, { gain: 0.03, decay: 0.035, to: 1850, wave: 'sine', send: 0.05 });
      if (spin) this.tone(t + 0.02, midi(ROOT + 24 + p.octave), { gain: 0.035, decay: 0.12, send: 0.4 });
    });
  }

  hold(): void {
    this.play((t, p) => {
      this.noise(t, { gain: 0.05 * p.click, decay: 0.09, freq: 900, to: 3200, q: 2, type: 'bandpass' });
      this.tone(t + 0.01, midi(ROOT + 7 + p.octave), { gain: 0.03, decay: 0.09 });
    });
  }

  hardDrop(distance: number): void {
    const weight = 0.7 + Math.min(distance, 20) / 40;
    this.play((t, p) => {
      this.tone(t, 170, { gain: 0.24 * weight, decay: 0.1, to: 46, wave: 'sine', send: 0.05 });
      this.noise(t, { gain: 0.08 * weight * p.click, decay: 0.045, freq: 1100, type: 'lowpass' });
    });
  }

  lock(): void {
    this.play((t, p) => {
      this.tone(t, 300, { gain: 0.06, decay: 0.05, to: 170, wave: 'sine', send: 0 });
      this.noise(t, { gain: 0.03 * p.click, decay: 0.02, freq: 1800, type: 'lowpass' });
    });
  }

  clear(info: ClearInfo): void {
    this.play((t, p) => {
      const step = Math.max(0, info.combo);
      const base = ROOT + p.octave + PENTATONIC[step % 5] + 12 * Math.min(2, Math.floor(step / 5));
      const g = 0.075;
      const decay = 0.55;
      if (info.perfectClear) {
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(t + i * 0.055, midi(base + n), { gain: g, decay: 1.4 }));
        return;
      }
      if (info.spin !== 'none') {
        const notes = info.spin === 'full' ? [0, 4, 7, 11, 14] : [0, 7, 12];
        notes.forEach((n, i) => this.tone(t + i * 0.03, midi(base + n), { gain: g * (info.lines ? 1 : 0.6), decay: decay * 1.3 }));
        this.noise(t, { gain: 0.03, decay: 0.3, freq: 6000, to: 9000, q: 4, type: 'bandpass' });
      } else {
        const chords = [[0], [0], [0, 7], [0, 4, 7], [0, 4, 7, 12]];
        for (const n of chords[Math.min(info.lines, 4)]) this.tone(t, midi(base + n), { gain: g, decay: info.lines >= 4 ? decay * 1.6 : decay });
      }
      if (info.lines > 0 && info.b2b >= 1) this.tone(t + 0.06, midi(base + 24), { gain: g * 0.5, decay: 0.7, send: 0.6 });
    });
  }

  levelUp(): void {
    this.play((t, p) => {
      [0, 7, 12].forEach((n, i) => this.tone(t + i * 0.07, midi(ROOT + 5 + n + p.octave), { gain: 0.06, decay: 0.4 }));
    });
  }

  countdown(step: number): void {
    this.play((t, p) => this.tone(t, midi(ROOT + 4 + p.octave), { gain: 0.06, decay: 0.12 * (step > 0 ? 1 : 2) }));
  }

  go(): void {
    this.play((t, p) => {
      this.tone(t, midi(ROOT + 16 + p.octave), { gain: 0.06, decay: 0.35 });
      this.tone(t, midi(ROOT + 11 + p.octave), { gain: 0.04, decay: 0.35 });
    });
  }

  end(kind: 'topout' | 'finished'): void {
    this.play((t, p) => {
      if (kind === 'finished') {
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone(t + i * 0.08, midi(ROOT + n + p.octave), { gain: 0.07, decay: 1.2 }));
      } else {
        [7, 3, 0, -5].forEach((n, i) =>
          this.tone(t + i * 0.13, midi(ROOT - 5 + n + p.octave), { gain: 0.06, decay: 0.6, cutoff: 1400 }),
        );
      }
    });
  }

  // ── Menus ─────────────────────────────────────────────────────

  ui(kind: 'move' | 'select' | 'back'): void {
    this.play((t) => {
      if (kind === 'move') this.noise(t, { gain: 0.025, decay: 0.01, freq: 4200, q: 1.5, type: 'bandpass' });
      else this.tone(t, kind === 'select' ? 1320 : 880, { gain: 0.035, decay: 0.06, wave: 'sine', send: 0.1 });
    });
  }

  /** Plays a sample clear with a given pack, for the settings screen. */
  preview(pack: SoundPackId): void {
    this.play(
      (t, p) => [0, 4, 7, 12].forEach((n, i) => this.tone(t + i * 0.06, midi(ROOT + n + p.octave), { gain: 0.07, decay: 0.6 })),
      pack,
    );
  }

  // ── Synthesis ─────────────────────────────────────────────────

  private pack: Pack = PACKS.soft;

  private play(fn: (t: number, pack: Pack) => void, packId?: SoundPackId): void {
    const { audio, appearance } = getSettings();
    if (!audio.enabled || audio.volume <= 0) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.out.gain.setTargetAtTime(audio.volume, ctx.currentTime, 0.01);
    const id = packId ?? (audio.pack === 'match' ? SKINS[appearance.skin].sound : audio.pack);
    this.pack = PACKS[id];
    fn(ctx.currentTime + 0.002, this.pack);
  }

  private build(ctx: AudioContext): void {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.12;
    compressor.connect(ctx.destination);

    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    this.out.connect(compressor);

    // Short airy room: decaying stereo noise.
    const length = Math.floor(ctx.sampleRate * 1.8);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 6500;
    this.reverb = ctx.createGain();
    this.reverb.connect(convolver).connect(tone).connect(this.out);

    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const noise = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  }

  private envelope(t: number, gain: number, attack: number, decay: number): GainNode {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return env;
  }

  private route(node: AudioNode, send: number, pan = 0): void {
    const ctx = this.ctx!;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner).connect(this.out);
    if (send > 0) {
      const wet = ctx.createGain();
      wet.gain.value = send;
      node.connect(wet).connect(this.reverb);
    }
  }

  private tone(t: number, freq: number, o: ToneOptions): void {
    const ctx = this.ctx!;
    const p = this.pack;
    const attack = o.attack ?? 0.004;
    const decay = o.decay * p.decay;
    const env = this.envelope(t, o.gain, attack, decay);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = o.cutoff ?? p.bright;
    filter.Q.value = p.wave === 'sawtooth' ? 4 : 0.7;
    filter.connect(env);

    const voices = p.detune && !o.wave ? [-p.detune, p.detune] : [0];
    for (const cents of voices) {
      const osc = ctx.createOscillator();
      osc.type = o.wave ?? p.wave;
      osc.frequency.setValueAtTime(freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + attack + decay * 0.8);
      osc.detune.value = cents;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + attack + decay + 0.05);
    }
    if (p.bell > 0 && !o.wave) {
      const bell = ctx.createOscillator();
      bell.frequency.value = freq * 2.76;
      const bellEnv = this.envelope(t, o.gain * p.bell, attack, decay * 0.45);
      bell.connect(bellEnv);
      this.route(bellEnv, o.send ?? p.reverb, o.pan);
      bell.start(t);
      bell.stop(t + decay);
    }
    this.route(env, o.send ?? p.reverb, o.pan ?? (Math.random() - 0.5) * 0.2);
  }

  private noise(t: number, o: NoiseOptions): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type ?? 'bandpass';
    filter.frequency.setValueAtTime(o.freq, t);
    if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + o.decay);
    filter.Q.value = o.q ?? 1;
    const env = this.envelope(t, Math.max(0.0002, o.gain), 0.001, o.decay);
    src.connect(filter).connect(env);
    this.route(env, this.pack.reverb * 0.3);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.decay + 0.05);
  }
}

export const sfx = new Sfx();
