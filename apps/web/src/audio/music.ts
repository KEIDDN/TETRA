import type { Track } from './catalog';
import { Club, type ClubMode } from './club';
import { sfx } from './sfx';

export interface AudioBands {
  low: number;
  mid: number;
  high: number;
  /** 1 on a beat, decaying to 0 before the next. */
  beat: number;
  /** 1 on a kick drum hit, decaying fast. */
  kick: number;
  /** 1 on a hi-hat, decaying very fast. */
  hat: number;
  /** Which beat of the bar (0–3), counted from the last drop. */
  beatInBar: number;
  /** 1 at the start of every 16-bar phrase, decaying over a bar. */
  phrase: number;
  /** Phrases since the music started or last dropped (scenes rotate their looks with it). */
  phraseIndex: number;
  /** The drop: 1 when the kick slams back after a break, easing out over ~8 bars. */
  drop: number;
  /** 0–1 while in a break: the kick has gone and the highs are rising. */
  build: number;
  /** True while the kick is away. */
  breakdown: boolean;
}

const SILENT: AudioBands = { low: 0, mid: 0, high: 0, beat: 0, kick: 0, hat: 0, beatInBar: 0, phrase: 0, phraseIndex: 0, drop: 0, build: 0, breakdown: false };

interface Deck {
  el: HTMLAudioElement;
  gain: GainNode | null;
  /** The deck's low shelf: the DJ's bass knob, for swapping basslines mid-mix. */
  bass: BiquadFilterNode | null;
  track: Track | null;
  /** Has played once inside a user gesture (iOS won't start it otherwise). */
  primed: boolean;
}

/** A tenth of a second of silence, to wake a deck inside a gesture. */
const SILENCE = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Seconds before a track's end at which the next one starts mixing in. */
const MIX_LEAD = 22;

/** Equal-power fade curves: the sum stays at full energy through the whole mix. */
function curve(fadeIn: boolean): Float32Array<ArrayBuffer> {
  const n = 64;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    c[i] = fadeIn ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2);
  }
  return c;
}

/**
 * Streams the music on two decks so tracks can crossfade, and listens to
 * what plays: three bands (normalised to the track's own loudness) and a
 * beat that locks onto the bass and keeps the track's tempo between hits.
 */
class Music {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  /** The Experience: Club master, binaural and live DJ effects. */
  club: Club | null = null;
  private clubMode: ClubMode = 'club';
  private djEnabled = true;
  private analyser: AnalyserNode | null = null;
  private bins: Uint8Array<ArrayBuffer> | null = null;
  private decks: [Deck, Deck] = [this.deck(), this.deck()];
  private active = 0;
  private wanted: { track: Track | null; bpm: number | null; loop: boolean } = { track: null, bpm: null, loop: true };
  private volume = 0.5;
  private listeners = new Set<(track: Track | null) => void>();
  /** Whole files fetched ahead of time (track id → blob URL), so a game's music starts at once. */
  private cache = new Map<string, Promise<string | null>>();
  private cacheOrder: string[] = [];
  private ready = new Map<string, string>();
  private endedListeners = new Set<() => void>();
  private nearEndListeners = new Set<() => void>();
  private mixing = false;
  private mixTimer = 0;

  // Analysis state.
  private bands: AudioBands = { ...SILENT };
  private peaks = [0.05, 0.05, 0.05];
  private lowAvg = 0;
  private lastBeat = -1;
  private analysedAt = 0;
  // Musical structure.
  private prevKickBand = 0;
  private prevHatBand = 0;
  private kickAvg = 0;
  private hatAvg = 0;
  private lastKick = -10;
  private lastHat = -10;
  private beatCount = 0;
  private kickPresence = 1;
  private breakBeats = 0;

  constructor() {
    sfx.onUnlock((ctx) => this.attach(ctx));
  }

  /**
   * Call from every user gesture. iOS lets an audio element start on its own only once it
   * has played inside a gesture, so both decks get a silent first play; and anything the
   * browser refused to start before now starts.
   */
  gesture(): void {
    if (!this.ctx) return;
    for (const deck of this.decks) {
      if (deck.primed) continue;
      if (deck === this.decks[this.active] && deck.track) {
        // The playing deck was refused before: start it now.
        if (deck.el.paused) void deck.el.play().catch(() => {});
        continue;
      }
      if (!deck.el.paused) continue;
      deck.el.src = SILENCE;
      void deck.el.play().then(
        () => {
          deck.primed = true;
          // Unless a track has been loaded onto it meanwhile, back to quiet.
          if (deck.el.src === SILENCE) deck.el.pause();
        },
        () => {},
      );
    }
  }

  get current(): Track | null {
    return this.decks[this.active].track;
  }

  /** Plays `track` (null fades out), crossfading over `fade` seconds. Safe to call before audio unlocks. */
  play(track: Track | null, { bpm = track?.bpm ?? null, loop = false, fade = 1.6, mix = false, restart = false } = {}): void {
    if (!restart && track?.id === this.wanted.track?.id && loop === this.wanted.loop) {
      this.wanted.bpm = bpm;
      return;
    }
    this.wanted = { track, bpm, loop };
    clearTimeout(this.mixTimer);
    this.mixing = false;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const out = this.decks[this.active];
    if (out.gain) {
      out.gain.gain.cancelScheduledValues(now);
      out.gain.gain.setValueAtTime(out.gain.gain.value, now);
      if (mix) out.gain.gain.setValueCurveAtTime(curve(false).map((v) => v * out.gain!.gain.value), now + 0.005, fade);
      else out.gain.gain.linearRampToValueAtTime(0, now + fade);
    }
    // Bass swap: halfway through a mix the outgoing bassline is cut as the incoming one comes in.
    if (mix && out.bass) {
      out.bass.gain.cancelScheduledValues(now);
      out.bass.gain.setValueAtTime(0, now + fade * 0.45);
      out.bass.gain.linearRampToValueAtTime(-26, now + fade * 0.55);
    }
    const leaving = out;
    setTimeout(() => {
      if (leaving !== this.decks[this.active]) leaving.el.pause();
    }, fade * 1000 + 50);

    this.active = 1 - this.active;
    const deck = this.decks[this.active];
    deck.track = track;
    // A DJ mix keeps the room's clock running; a fresh start resets it.
    if (!mix) {
      this.lastBeat = -1;
      this.beatCount = 0;
      this.breakBeats = 0;
      this.kickPresence = 1;
      this.bands.phraseIndex = 0;
    }
    this.peaks = [0.05, 0.05, 0.05];
    this.listeners.forEach((l) => l(track));
    if (!track) return;
    // In memory already: no network wait. Otherwise stream it, and switch to the download if it lands before playback starts.
    deck.el.src = this.ready.get(track.id) ?? track.url;
    if (!this.ready.has(track.id)) {
      void this.cache.get(track.id)?.then((blob) => {
        if (blob && deck.track === track && deck.el.readyState < 3) {
          deck.el.src = blob;
          void deck.el.play().catch(() => {});
        }
      });
    }
    deck.el.loop = loop;
    deck.el.currentTime = 0;
    deck.gain!.gain.cancelScheduledValues(now);
    deck.gain!.gain.setValueAtTime(0, now);
    if (mix) deck.gain!.gain.setValueCurveAtTime(curve(true), now + 0.005, fade);
    else deck.gain!.gain.linearRampToValueAtTime(1, now + fade);
    deck.bass!.gain.cancelScheduledValues(now);
    deck.bass!.gain.setValueAtTime(mix ? -26 : 0, now);
    if (mix) {
      deck.bass!.gain.setValueAtTime(-26, now + fade * 0.45);
      deck.bass!.gain.linearRampToValueAtTime(0, now + fade * 0.55);
    }
    void deck.el.play().catch(() => {});
  }

  /**
   * Mixes into `track` like a DJ would: on the next downbeat, over eight bars
   * of the current tempo, equal-power, swapping basslines halfway. Mixing
   * into the track that's playing loops it from the top on the other deck.
   */
  mixTo(track: Track, bpm: number | null): void {
    if (!this.ctx || this.mixing) return;
    this.mixing = true;
    const period = this.wanted.bpm ? 60 / this.wanted.bpm : 0.48;
    const now = this.ctx.currentTime;
    const el = this.decks[this.active].el;
    const left = Number.isFinite(el.duration) ? el.duration - el.currentTime : MIX_LEAD;
    // Wait for the top of the next bar so the incoming track lands on the one.
    let wait = 0;
    if (this.lastBeat > 0) {
      const beatsToBar = (4 - this.bands.beatInBar) % 4 || 4;
      wait = Math.max(0, this.lastBeat + beatsToBar * period - now);
    }
    const fade = Math.max(4, Math.min(period * 32, left - wait - 1));
    this.prefetch(track);
    this.mixTimer = window.setTimeout(() => this.play(track, { bpm, fade, mix: true, restart: true }), wait * 1000);
  }

  /** Fires once per track, ~20 s before its end: time to choose what comes next. */
  onNearEnd(l: () => void): () => void {
    this.nearEndListeners.add(l);
    return () => this.nearEndListeners.delete(l);
  }

  /** Downloads `track` in the background (kept for the next few plays). */
  prefetch(track: Track | null): void {
    if (!track || this.cache.has(track.id)) return;
    const job = fetch(track.url, { mode: 'cors' })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b) return null;
        const url = URL.createObjectURL(b);
        if (this.cache.has(track.id)) this.ready.set(track.id, url);
        return url;
      })
      .catch(() => null);
    this.cache.set(track.id, job);
    this.cacheOrder.push(track.id);
    // Keep memory bounded: a handful of tracks is plenty.
    while (this.cacheOrder.length > 5) {
      const old = this.cacheOrder.shift()!;
      if (old === this.current?.id) continue;
      void this.cache.get(old)?.then((u) => u && URL.revokeObjectURL(u));
      this.cache.delete(old);
      this.ready.delete(old);
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.08);
  }

  /** Club, binaural or plain; and whether the game may play DJ on the music. */
  setExperience(mode: ClubMode, dj: boolean): void {
    this.clubMode = mode;
    this.djEnabled = dj;
    this.club?.setMode(mode);
    this.club?.setDjEnabled(dj);
  }

  /** The current track's tempo, for effects that follow it. */
  get bpm(): number | null {
    return this.wanted.bpm;
  }

  /** Seconds to the next beat and where it falls in the bar, from the live beat clock; null without a steady pulse. */
  nextBeat(): { in: number; beatInBar: number; period: number } | null {
    const bpm = this.bpm;
    if (!bpm || !this.ctx || this.lastBeat < 0) return null;
    const period = 60 / bpm;
    const since = this.ctx.currentTime - this.lastBeat;
    if (since < 0 || since > period * 16) return null;
    const passed = Math.floor(since / period);
    return { in: (passed + 1) * period - since, beatInBar: (this.beatCount + passed + 1) % 4, period };
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

    // Kick and hats: onsets in their own bands, against a running average.
    const kickBand = band(40, 110);
    const hatBand = band(6000, 12000);
    const kickFlux = kickBand - this.prevKickBand;
    const hatFlux = hatBand - this.prevHatBand;
    this.prevKickBand = kickBand;
    this.prevHatBand = hatBand;
    this.kickAvg += (kickBand - this.kickAvg) * Math.min(1, dt * 2);
    this.hatAvg += (hatBand - this.hatAvg) * Math.min(1, dt * 2);
    const bpm = this.wanted.bpm;
    const period = bpm ? 60 / bpm : 0.48;
    const kickHit = kickFlux > 0.045 && kickBand > this.kickAvg * 1.05 && t - this.lastKick > period * 0.55;
    if (kickHit) this.lastKick = t;
    const hatHit = hatFlux > 0.02 && hatBand > this.hatAvg * 1.1 && t - this.lastHat > period * 0.2;
    if (hatHit) this.lastHat = t;
    this.bands.kick = kickHit ? 1 : this.bands.kick * Math.exp(-dt * 9);
    this.bands.hat = hatHit ? 1 : this.bands.hat * Math.exp(-dt * 18);

    // The beat clock: locked to the kick, and keeping time through breaks when the tempo is known.
    let beat = false;
    // Beats that went by since the last call (a slow frame can skip several).
    let elapsedBeats = 1;
    if (kickHit && t - this.lastBeat > period * 0.55) beat = true;
    else if (bpm && this.lastBeat > 0 && t - this.lastBeat >= period * 0.98) {
      beat = true;
      elapsedBeats = Math.max(1, Math.floor((t - this.lastBeat) / period + 0.02));
    } else if (!bpm) {
      const flux = raw[0] - this.lowAvg;
      if (flux > 0.06 && t - this.lastBeat > 0.25) beat = true;
    }
    this.lowAvg += (raw[0] - this.lowAvg) * Math.min(1, dt * 3);
    this.bands.phrase *= Math.exp(-dt / (period * 2));
    this.bands.drop *= Math.exp(-dt / (period * 16));
    if (beat) {
      // On a kick, lock to it; on the grid, keep exact time so the clock never drifts.
      this.lastBeat = kickHit || !bpm ? t : this.lastBeat + elapsedBeats * period;
      this.bands.beat = 1;
      const before = this.beatCount;
      this.beatCount += elapsedBeats;
      // Is the kick still there? A short memory of hits per beat.
      this.kickPresence += ((t - this.lastKick < period * 1.5 ? 1 : 0) - this.kickPresence) * 0.25;
      if (this.kickPresence < 0.3) this.breakBeats++;
      else {
        // The kick is back after a real break: that's the drop. Bars and phrases count from here.
        if (this.breakBeats >= 12 && kickHit) {
          this.bands.drop = 1;
          this.beatCount = 0;
          this.bands.phraseIndex++;
          this.bands.phrase = 1;
        }
        this.breakBeats = 0;
      }
      this.bands.beatInBar = this.beatCount % 4;
      if (Math.floor(this.beatCount / 64) > Math.floor(before / 64)) {
        this.bands.phrase = 1;
        this.bands.phraseIndex++;
      }
    } else this.bands.beat *= Math.exp(-dt * 7);
    this.bands.breakdown = this.breakBeats >= 8;
    const buildTarget = this.bands.breakdown ? Math.min(1, this.bands.high * 0.6 + Math.min(1, this.breakBeats / 32) * 0.6) : 0;
    this.bands.build += (buildTarget - this.bands.build) * Math.min(1, dt * 2);
    return this.bands;
  }

  private deck(): Deck {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.addEventListener('ended', () => {
      if (el === this.decks[this.active].el) this.endedListeners.forEach((l) => l());
    });
    el.addEventListener('playing', () => (deck.primed = true));
    const deck: Deck = { el, gain: null, bass: null, track: null, primed: false };
    return deck;
  }

  private attach(ctx: AudioContext): void {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = this.volume * this.volume;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.35;
    this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    // The analyser listens to the track itself, before any effect, so the scenes follow the music.
    this.bus.connect(this.analyser);
    this.club = new Club(ctx, ctx.destination);
    this.club.setMode(this.clubMode);
    this.club.setDjEnabled(this.djEnabled);
    this.bus.connect(this.club.input);
    for (const deck of this.decks) {
      deck.gain = ctx.createGain();
      deck.gain.gain.value = 0;
      deck.bass = ctx.createBiquadFilter();
      deck.bass.type = 'lowshelf';
      deck.bass.frequency.value = 180;
      deck.bass.gain.value = 0;
      ctx.createMediaElementSource(deck.el).connect(deck.bass).connect(deck.gain);
      deck.gain.connect(this.bus);
    }
    // Watch the playing track's clock: near its end, ask what comes next.
    let warned: HTMLAudioElement | null = null;
    let warnedSrc = '';
    setInterval(() => {
      const deck = this.decks[this.active];
      const el = deck.el;
      if (!deck.track || el.paused || !Number.isFinite(el.duration) || el.loop) return;
      if (warned === el && warnedSrc === el.src) return;
      if (el.duration - el.currentTime <= MIX_LEAD) {
        warned = el;
        warnedSrc = el.src;
        this.nearEndListeners.forEach((l) => l());
      }
    }, 250);
    // Whatever was asked for before the first gesture starts now.
    const wanted = this.wanted;
    this.wanted = { track: null, bpm: null, loop: true };
    this.play(wanted.track, { bpm: wanted.bpm, loop: wanted.loop, fade: 2.5 });
  }
}

export const music = new Music();

// Lets browser tests inspect the decks; stripped from production builds.
if (import.meta.env.DEV) (window as unknown as { __music: unknown }).__music = music;
