import type { Track } from './catalog';
import { sfx } from './sfx';

export interface AudioBands {
  low: number;
  mid: number;
  high: number;
  /** 1 on a beat, decaying to 0 before the next. */
  beat: number;
}

const SILENT: AudioBands = { low: 0, mid: 0, high: 0, beat: 0 };

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode | null;
  track: Track | null;
}

/**
 * Streams the music on two decks so tracks can crossfade, and listens to
 * what plays: three bands (normalised to the track's own loudness) and a
 * beat that locks onto the bass and keeps the track's tempo between hits.
 */
class Music {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  private decks: [Deck, Deck] = [this.deck(), this.deck()];
  private active = 0;
  private wanted: { track: Track | null; bpm: number | null; loop: boolean } = { track: null, bpm: null, loop: true };
  private volume = 0.5;
  private listeners = new Set<(track: Track | null) => void>();
  private endedListeners = new Set<() => void>();

  // Analysis state.
  private bands: AudioBands = { ...SILENT };
  private peaks = [0.05, 0.05, 0.05];
  private lowAvg = 0;
  private lastBeat = -1;
  private lastOnset = -10;
  private analysedAt = 0;

  constructor() {
    sfx.onUnlock((ctx) => this.attach(ctx));
  }

  get current(): Track | null {
    return this.decks[this.active].track;
  }

  /** Plays `track` (null fades out), crossfading over `fade` seconds. Safe to call before audio unlocks. */
  play(track: Track | null, { bpm = track?.bpm ?? null, loop = true, fade = 1.6 } = {}): void {
    if (track?.id === this.wanted.track?.id && loop === this.wanted.loop) {
      this.wanted.bpm = bpm;
      return;
    }
    this.wanted = { track, bpm, loop };
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const out = this.decks[this.active];
    if (out.gain) {
      out.gain.gain.cancelScheduledValues(now);
      out.gain.gain.setValueAtTime(out.gain.gain.value, now);
      out.gain.gain.linearRampToValueAtTime(0, now + fade);
    }
    const leaving = out;
    setTimeout(() => {
      if (leaving !== this.decks[this.active]) leaving.el.pause();
    }, fade * 1000 + 50);

    this.active = 1 - this.active;
    const deck = this.decks[this.active];
    deck.track = track;
    this.lastBeat = -1;
    this.peaks = [0.05, 0.05, 0.05];
    this.listeners.forEach((l) => l(track));
    if (!track) return;
    deck.el.src = track.url;
    deck.el.loop = loop;
    deck.el.currentTime = 0;
    deck.gain!.gain.cancelScheduledValues(now);
    deck.gain!.gain.setValueAtTime(0, now);
    deck.gain!.gain.linearRampToValueAtTime(1, now + fade);
    void deck.el.play().catch(() => {});
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.08);
  }

  /** Called when the playing track changes (now playing). */
  subscribe(l: (track: Track | null) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** A non-looping track finished (shuffle moves on). */
  onEnded(l: () => void): () => void {
    this.endedListeners.add(l);
    return () => this.endedListeners.delete(l);
  }

  /** Position in the current track, for the lab. */
  get position(): { time: number; duration: number } {
    const el = this.decks[this.active].el;
    return { time: el.currentTime || 0, duration: el.duration || this.current?.duration || 0 };
  }

  /** What the music is doing right now; cheap to call every frame. */
  analyse(): AudioBands {
    if (!this.analyser || !this.bins || !this.ctx || !this.current) return SILENT;
    const t = this.ctx.currentTime;
    if (t === this.analysedAt) return this.bands;
    const dt = Math.min(0.1, t - this.analysedAt || 0.016);
    this.analysedAt = t;
    this.analyser.getByteFrequencyData(this.bins);
    const hz = this.ctx.sampleRate / this.analyser.fftSize;
    const band = (lo: number, hi: number) => {
      let sum = 0;
      const a = Math.max(1, Math.floor(lo / hz));
      const b = Math.min(this.bins!.length - 1, Math.ceil(hi / hz));
      for (let i = a; i <= b; i++) sum += this.bins![i];
      return sum / ((b - a + 1) * 255);
    };
    const raw = [band(30, 150), band(150, 2000), band(2000, 8000)];
    // Each band is measured against its own recent peak, so quiet and loud tracks both move the scene.
    const out = raw.map((v, i) => {
      this.peaks[i] = Math.max(v, this.peaks[i] * Math.exp(-dt * 0.25), 0.02);
      return Math.min(1, v / this.peaks[i]);
    });
    const smooth = (prev: number, next: number) => prev + (next - prev) * Math.min(1, dt * (next > prev ? 18 : 4));
    this.bands.low = smooth(this.bands.low, out[0] ** 2);
    this.bands.mid = smooth(this.bands.mid, out[1] ** 2);
    this.bands.high = smooth(this.bands.high, out[2] ** 2);

    // Beat: a bass onset, or the tempo's next tick after the last onset when the track has one.
    const bpm = this.wanted.bpm;
    const period = bpm ? 60 / bpm : 0;
    const flux = raw[0] - this.lowAvg;
    this.lowAvg += (raw[0] - this.lowAvg) * Math.min(1, dt * 3);
    let hit = false;
    if (flux > 0.06 && t - this.lastOnset > (period ? period * 0.6 : 0.25)) {
      this.lastOnset = t;
      hit = true;
    } else if (period && this.lastOnset > 0) {
      const k = Math.round((t - this.lastOnset) / period);
      const tick = this.lastOnset + k * period;
      if (k > 0 && k < 32 && t >= tick && tick > this.lastBeat) hit = true;
    }
    if (hit) {
      this.lastBeat = t;
      this.bands.beat = 1;
    } else this.bands.beat *= Math.exp(-dt * 7);
    return this.bands;
  }

  private deck(): Deck {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.addEventListener('ended', () => {
      if (el === this.decks[this.active].el) this.endedListeners.forEach((l) => l());
    });
    return { el, gain: null, track: null };
  }

  private attach(ctx: AudioContext): void {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = this.volume * this.volume;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    this.bus.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    for (const deck of this.decks) {
      deck.gain = ctx.createGain();
      deck.gain.gain.value = 0;
      ctx.createMediaElementSource(deck.el).connect(deck.gain);
      deck.gain.connect(this.bus);
    }
    // Whatever was asked for before the first gesture starts now.
    const wanted = this.wanted;
    this.wanted = { track: null, bpm: null, loop: true };
    this.play(wanted.track, { bpm: wanted.bpm, loop: wanted.loop, fade: 2.5 });
  }
}

export const music = new Music();

// Lets browser tests inspect the decks; stripped from production builds.
if (import.meta.env.DEV) (window as unknown as { __music: unknown }).__music = music;
