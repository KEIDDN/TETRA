/**
 * Ambient light: slow-drifting motes of dust and a few large out-of-focus
 * orbs. Shared by the home screen (Canvas 2D) and the game (Pixi), so both
 * feel like the same space. It reacts to play without ever asking for
 * attention: line clears push it outward, chains brighten and quicken it,
 * danger tints it red.
 */
export interface Mote {
  x: number;
  y: number;
  /** Slow base drift, px/s. */
  bx: number;
  by: number;
  /** Impulse velocity, px/s, decays over time. */
  ix: number;
  iy: number;
  size: number;
  /** 0–1: nearer motes are bigger, brighter and faster. */
  depth: number;
  bokeh: boolean;
  /** Index into the palette. */
  color: number;
  phase: number;
}

export interface MoteStyle {
  x: number;
  y: number;
  size: number;
  /** Stretch along `angle`: fast motes become streaks. */
  stretch: number;
  angle: number;
  alpha: number;
  color: number;
}

/** An expanding ring that pushes motes outward as its front passes. */
export interface Wave {
  x: number;
  y: number;
  radius: number;
  /** px/s */
  speed: number;
  power: number;
  color: number;
  /** 0–1, fades as it travels. */
  life: number;
}

function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

const DANGER_RGB = [255, 69, 58];

function rgb(color: number): [number, number, number] {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

export class AmbientSim {
  motes: Mote[] = [];
  waves: Wave[] = [];
  private tint = { color: 0xffffff, amount: 0 };
  private w = 0;
  private h = 0;
  private time = 0;
  private energy = 0;
  private energyTarget = 0;
  private danger = 0;
  private dangerTarget = 0;
  private pulse = 0;

  constructor(
    private count: number,
    /** Overall brightness, 0–1. */
    private intensity = 1,
    public palette: number[] = [0xffffff],
  ) {}

  resize(w: number, h: number): void {
    const first = this.w === 0;
    // Keep motes where they are, proportionally.
    if (!first) for (const m of this.motes) ((m.x *= w / this.w), (m.y *= h / this.h));
    this.w = w;
    this.h = h;
    if (first) for (let i = 0; i < this.count; i++) this.motes.push(this.spawn(Math.random() * h));
  }

  /** Pushes motes away from (x, y). `power` ~1 for a single, ~6 for a quad or T-spin. */
  impulse(x: number, y: number, power: number): void {
    for (const m of this.motes) {
      const dx = m.x - x;
      const dy = m.y - y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (power * 140 * (0.4 + m.depth)) / (1 + d / 260);
      m.ix += (dx / d) * f;
      m.iy += (dy / d) * f;
    }
    this.pulse = Math.min(1, this.pulse + power * 0.06);
  }

  /** 0–1: how charged the field is (combo, back-to-back). */
  setEnergy(e: number): void {
    this.energyTarget = e;
  }

  setDanger(d: number): void {
    this.dangerTarget = d;
  }

  /**
   * A big moment (quad, T-spin, all clear): a ring of `color` light sweeps
   * outward from (x, y), shoving motes as it passes, and the field takes on
   * the color for a while.
   */
  shockwave(x: number, y: number, power: number, color: number): void {
    this.waves.push({ x, y, radius: 0, speed: 420 + power * 60, power, color, life: 1 });
    this.impulse(x, y, power * 0.5);
    this.tint = { color, amount: Math.min(0.85, 0.35 + power * 0.06) };
    this.pulse = Math.min(1, this.pulse + power * 0.1);
  }

  /** A soft wash of light, e.g. on level up. */
  flash(amount = 0.6): void {
    this.pulse = Math.min(1, this.pulse + amount);
  }

  update(dt: number): void {
    const s = Math.min(0.05, dt / 1000);
    this.time += s;
    this.energy += (this.energyTarget - this.energy) * Math.min(1, s * 1.5);
    this.danger += (this.dangerTarget - this.danger) * Math.min(1, s * 2);
    this.pulse *= Math.exp(-s * 1.6);
    this.tint.amount *= Math.exp(-s * 0.7);
    const reach = Math.hypot(this.w, this.h);
    this.waves = this.waves.filter((wave) => {
      wave.radius += wave.speed * s;
      wave.life = Math.max(0, 1 - wave.radius / reach);
      for (const m of this.motes) {
        const dx = m.x - wave.x;
        const dy = m.y - wave.y;
        const d = Math.hypot(dx, dy) || 1;
        const front = Math.abs(d - wave.radius);
        if (front < 60) {
          const f = wave.power * 120 * wave.life * (1 - front / 60) * (0.4 + m.depth) * s * 10;
          m.ix += (dx / d) * f;
          m.iy += (dy / d) * f;
        }
      }
      return wave.life > 0.02;
    });
    const speed = 1 + this.energy * 2.2 + this.pulse;
    const drag = Math.exp(-s * 1.8);
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.ix *= drag;
      m.iy *= drag;
      const sway = Math.sin(this.time * 0.4 + m.phase) * 6 * m.depth;
      const jitter = this.danger * 30 * m.depth;
      m.x += (m.bx * speed + m.ix + sway + (Math.random() - 0.5) * jitter) * s;
      m.y += (m.by * speed + m.iy + (Math.random() - 0.5) * jitter) * s;
      const margin = m.size * 2;
      if (m.y < -margin || m.y > this.h + margin || m.x < -margin || m.x > this.w + margin) {
        this.motes[i] = this.spawn(m.y < -margin ? this.h + margin : Math.random() * this.h);
      }
    }
  }

  /** Where and how to draw a mote this frame. */
  style(m: Mote): MoteStyle {
    const twinkle = 0.75 + 0.25 * Math.sin(this.time * (0.6 + m.depth) + m.phase * 3);
    const lift = 1 + this.energy * 1.1 + this.pulse * 1.5;
    const base = m.bokeh ? 0.035 + 0.035 * m.depth : 0.06 + 0.16 * m.depth;
    let color = this.palette[m.color % this.palette.length];
    if (this.tint.amount > 0.01) color = mix(color, this.tint.color, this.tint.amount);
    if (this.danger > 0.01) {
      const [r, g, b] = rgb(color);
      const t = this.danger * 0.85;
      color =
        (Math.round(r + (DANGER_RGB[0] - r) * t) << 16) |
        (Math.round(g + (DANGER_RGB[1] - g) * t) << 8) |
        Math.round(b + (DANGER_RGB[2] - b) * t);
    }
    const speed = Math.hypot(m.ix, m.iy);
    return {
      x: m.x,
      y: m.y,
      size: m.size * (1 + this.pulse * 0.15),
      stretch: m.bokeh ? 1 : 1 + Math.min(4, speed / 90),
      angle: Math.atan2(m.iy, m.ix),
      alpha: Math.min(0.7, base * twinkle * lift * this.intensity * (1 + Math.min(1.5, speed / 200))),
      color,
    };
  }

  private spawn(y: number): Mote {
    const depth = Math.random();
    const bokeh = Math.random() < 0.14;
    return {
      x: Math.random() * this.w,
      y,
      bx: (Math.random() - 0.5) * 4,
      by: -(3 + depth * 9),
      ix: 0,
      iy: 0,
      size: bokeh ? 50 + Math.random() * 90 : 2 + depth * 5,
      depth,
      bokeh,
      color: Math.floor(Math.random() * 7),
      phase: Math.random() * Math.PI * 2,
    };
  }
}
