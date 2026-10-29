/**
 * The TETRA Experience sound: what happens to the music after the decks.
 *
 *   input ─ DJ filter ─ DJ air ─┬─────────────── chain ─ limiter ─ out
 *                               └─ throw delay ─┘   │
 *                                                   └ room (send)
 *
 * The chain is either a plain path, the Club master (EQ, glue, width, a
 * concrete room) or the same master played on four virtual speakers through
 * HRTF for headphones: two in front for the track, two behind for the room.
 */
export type ClubMode = 'off' | 'club' | 'binaural';

/** A small concrete club: a few hard early reflections, then a dark 1.4 s tail. */
function concreteRoom(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * 1.6);
  const buffer = ctx.createBuffer(2, length, rate);
  const early = [0.011, 0.017, 0.023, 0.031, 0.043, 0.057];
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const noise = Math.random() * 2 - 1;
      // A one-pole lowpass that closes as the tail decays: concrete eats the highs last.
      const k = 0.55 - 0.4 * Math.min(1, t / 1.2);
      lp += (noise - lp) * k;
      data[i] = t < 0.012 ? 0 : lp * Math.exp(-t * 4.2) * 0.9;
    }
    early.forEach((at, n) => {
      const i = Math.floor((at + (c ? 0.0017 : 0)) * rate);
      if (i < length) data[i] += (0.55 - n * 0.07) * (n % 2 ? -1 : 1);
    });
  }
  return buffer;
}

export class Club {
  readonly input: GainNode;
  private filter: BiquadFilterNode;
  private air: BiquadFilterNode;
  private post: GainNode;
  private delay: DelayNode;
  private feedback: GainNode;
  private throwSend: GainNode;
  private limiter: DynamicsCompressorNode;
  private room: AudioBuffer;
  private chain: AudioNode[] = [];
  private mode: ClubMode | null = null;
  private dj = { danger: 0, combo: 0, paused: false, enabled: true };

  constructor(
    private ctx: AudioContext,
    out: AudioNode,
  ) {
    this.input = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.9;
    this.air = ctx.createBiquadFilter();
    this.air.type = 'highshelf';
    this.air.frequency.value = 7000;
    this.air.gain.value = 0;
    this.post = ctx.createGain();
    this.input.connect(this.filter).connect(this.air).connect(this.post);

    // Throws: a dotted-eighth delay that feeds itself and the room.
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = 0.36;
    this.feedback = ctx.createGain();
    this.feedback.gain.value = 0.42;
    this.throwSend = ctx.createGain();
    this.throwSend.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = 1400;
    tone.Q.value = 0.6;
    this.air.connect(this.throwSend).connect(this.delay).connect(tone).connect(this.feedback).connect(this.delay);
    tone.connect(this.post);

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.limiter.connect(out);
    this.room = concreteRoom(ctx);
    this.setMode('club');
  }

  setMode(mode: ClubMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.post.disconnect();
    this.chain.forEach((n) => n.disconnect());
    this.chain = [];
    if (mode === 'off') {
      this.post.connect(this.limiter);
      return;
    }
    const ctx = this.ctx;
    const node = <T extends AudioNode>(n: T) => (this.chain.push(n), n);
    const eq = (type: BiquadFilterType, f: number, gain: number, q = 0.7) => {
      const b = node(ctx.createBiquadFilter());
      b.type = type;
      b.frequency.value = f;
      b.gain.value = gain;
      b.Q.value = q;
      return b;
    };
    // The PA: weight in the sub, less mud, a little air, glued together.
    const sub = eq('lowshelf', 60, 3.5);
    const mud = eq('peaking', 320, -2, 0.9);
    const top = eq('highshelf', 11000, 1.5);
    const glue = node(ctx.createDynamicsCompressor());
    glue.threshold.value = -20;
    glue.knee.value = 8;
    glue.ratio.value = 2.4;
    glue.attack.value = 0.012;
    glue.release.value = 0.22;
    this.post.connect(sub).connect(mud).connect(top).connect(glue);

    // The room, fed from the glued signal.
    const roomSend = node(ctx.createGain());
    roomSend.gain.value = mode === 'binaural' ? 0.2 : 0.13;
    const conv = node(ctx.createConvolver());
    conv.buffer = this.room;
    const roomHp = eq('highpass', 180, 0);
    glue.connect(roomSend).connect(roomHp).connect(conv);

    if (mode === 'club') {
      // Wider than the record: mid/side with the sides lifted.
      const split = node(ctx.createChannelSplitter(2));
      const merge = node(ctx.createChannelMerger(2));
      const k = 1.3;
      const g = (v: number) => {
        const n = node(ctx.createGain());
        n.gain.value = v;
        return n;
      };
      const ll = g((1 + k) / 2), rl = g((1 - k) / 2), rr = g((1 + k) / 2), lr = g((1 - k) / 2);
      glue.connect(split);
      split.connect(ll, 0).connect(merge, 0, 0);
      split.connect(rl, 1).connect(merge, 0, 0);
      split.connect(rr, 1).connect(merge, 0, 1);
      split.connect(lr, 0).connect(merge, 0, 1);
      merge.connect(this.limiter);
      conv.connect(this.limiter);
      return;
    }

    // Headphones: the track on two speakers ahead, the room on two behind, all through HRTF.
    const speaker = (x: number, z: number) => {
      const p = node(ctx.createPanner());
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1;
      p.rolloffFactor = 0;
      p.positionX.value = x;
      p.positionY.value = 0;
      p.positionZ.value = z;
      p.connect(this.limiter);
      return p;
    };
    const split = node(ctx.createChannelSplitter(2));
    glue.connect(split);
    split.connect(speaker(-0.9, -1.1), 0);
    split.connect(speaker(0.9, -1.1), 1);
    // Keep the kick and bass centred and solid: HRTF smears the lows.
    const low = eq('lowpass', 140, 0);
    glue.connect(low).connect(this.limiter);
    const roomSplit = node(ctx.createChannelSplitter(2));
    conv.connect(roomSplit);
    roomSplit.connect(speaker(-1.4, 1.0), 0);
    roomSplit.connect(speaker(1.4, 1.0), 1);
  }

  // ── Live DJ ────────────────────────────────────────────────

  setDjEnabled(on: boolean): void {
    this.dj.enabled = on;
    this.applyFilter();
  }

  /** 0–1: the higher the stack, the more the music sinks under a lowpass. */
  setDanger(d: number): void {
    if (Math.abs(d - this.dj.danger) < 0.02) return;
    this.dj.danger = d;
    this.applyFilter();
  }

  /** Each combo step lifts the highs a little. */
  setCombo(c: number): void {
    if (c === this.dj.combo) return;
    this.dj.combo = c;
    const gain = this.dj.enabled ? Math.min(5, Math.max(0, c) * 0.9) : 0;
    this.air.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.12);
  }

  setPaused(p: boolean): void {
    if (p === this.dj.paused) return;
    this.dj.paused = p;
    this.applyFilter();
  }

  /** The game intro: the music opens from a muffled lowpass to full, landing on `seconds`. */
  sweep(seconds: number): void {
    if (!this.dj.enabled || seconds <= 0.2) return;
    const f = this.filter.frequency;
    const now = this.ctx.currentTime;
    f.cancelScheduledValues(now);
    f.setValueAtTime(Math.max(400, Math.min(20000, f.value)), now);
    f.exponentialRampToValueAtTime(380, now + 0.15);
    f.exponentialRampToValueAtTime(2600, now + seconds * 0.88);
    f.exponentialRampToValueAtTime(20000, now + seconds);
  }

  /** Ends an intro sweep early. */
  endSweep(): void {
    const f = this.filter.frequency;
    f.cancelScheduledValues(this.ctx.currentTime);
    f.setTargetAtTime(20000, this.ctx.currentTime, 0.06);
  }

  /** A delay throw on the beat for big moments (quads, spins, all clears). */
  throw(power: number, bpm: number | null): void {
    if (!this.dj.enabled) return;
    const now = this.ctx.currentTime;
    const beat = bpm ? 60 / bpm : 0.48;
    this.delay.delayTime.setTargetAtTime(beat * 0.75, now, 0.01);
    const level = Math.min(0.8, 0.35 + power * 0.07);
    this.throwSend.gain.cancelScheduledValues(now);
    this.throwSend.gain.setValueAtTime(level, now);
    this.throwSend.gain.setTargetAtTime(0, now + beat * 0.5, beat * 0.4);
  }

  reset(): void {
    this.dj.danger = 0;
    this.dj.combo = 0;
    this.dj.paused = false;
    this.air.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    this.applyFilter();
  }

  private applyFilter(): void {
    const { danger, paused, enabled } = this.dj;
    let f = 20000;
    if (enabled) {
      // Log-scaled: barely there until the stack gets high, then it closes fast.
      const d = Math.max(0, (danger - 0.35) / 0.65);
      f = 20000 * Math.pow(550 / 20000, d * d);
      if (paused) f = Math.min(f, 750);
    }
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, paused ? 0.25 : 0.18);
    this.input.gain.setTargetAtTime(enabled && paused ? 0.55 : 1, this.ctx.currentTime, 0.25);
  }
}
