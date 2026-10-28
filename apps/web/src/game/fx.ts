import { Container, Sprite, type Texture } from 'pixi.js';
import type { Blend } from './skins';

export type FxLevel = 'off' | 'subtle' | 'full';

export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/** Reuses sprites between redraws instead of allocating per frame. */
export class SpritePool {
  private sprites: Sprite[] = [];
  private used = 0;

  constructor(readonly layer: Container) {}

  begin(): void {
    this.used = 0;
  }

  draw(texture: Texture, x: number, y: number, w: number, h = w, alpha = 1, tint = 0xffffff, blend: Blend = 'normal'): Sprite {
    let sprite = this.sprites[this.used];
    if (!sprite) {
      sprite = new Sprite();
      this.layer.addChild(sprite);
      this.sprites.push(sprite);
    }
    sprite.texture = texture;
    sprite.position.set(x, y);
    sprite.setSize(w, h);
    sprite.alpha = alpha;
    sprite.tint = tint;
    sprite.blendMode = blend;
    sprite.visible = true;
    this.used++;
    return sprite;
  }

  end(): void {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }
}

interface Tween {
  start: number;
  duration: number;
  apply(progress: number): void;
  done?(): void;
}

/** Time-based one-shot animations (flashes, trails, pops). */
export class Tweens {
  private list: Tween[] = [];

  add(tween: Tween): void {
    this.list.push(tween);
  }

  update(now: number): void {
    this.list = this.list.filter((t) => {
      const p = Math.min(1, Math.max(0, (now - t.start) / t.duration));
      t.apply(p);
      if (p < 1) return true;
      t.done?.();
      return false;
    });
  }

  clear(): void {
    for (const t of this.list) {
      t.apply(1);
      t.done?.();
    }
    this.list = [];
  }
}

/** Short-lived sprite effects that remove themselves when finished. */
export function spriteTween(
  tweens: Tweens,
  layer: Container,
  sprite: Sprite,
  now: number,
  duration: number,
  apply: (s: Sprite, p: number) => void,
): void {
  layer.addChild(sprite);
  apply(sprite, 0);
  tweens.add({ start: now, duration, apply: (p) => apply(sprite, p), done: () => sprite.destroy() });
}

interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  spin: number;
  gravity: number;
  drag: number;
}

export interface EmitOptions {
  x: number;
  y: number;
  /** Spawn area around (x, y). */
  w?: number;
  h?: number;
  count: number;
  color: number;
  texture: Texture;
  blend: Blend;
  /** px/s */
  speed: number;
  /** Extra upward kick, px/s. */
  lift?: number;
  /** Horizontal bias, -1..1, pushes particles away from a center. */
  bias?: number;
  life: [number, number];
  size: [number, number];
  /** px/s² */
  gravity?: number;
  drag?: number;
  spin?: number;
}

const MAX_PARTICLES = 900;

export class Particles {
  private live: Particle[] = [];
  private spare: Sprite[] = [];

  constructor(private layer: Container) {}

  emit(o: EmitOptions): void {
    for (let i = 0; i < o.count && this.live.length < MAX_PARTICLES; i++) {
      const sprite = this.spare.pop() ?? this.layer.addChild(new Sprite());
      sprite.texture = o.texture;
      sprite.anchor.set(0.5);
      sprite.tint = o.color;
      sprite.blendMode = o.blend;
      sprite.visible = true;
      const angle = Math.random() * Math.PI * 2;
      const speed = o.speed * (0.35 + Math.random() * 0.65);
      const rand = (range: [number, number]) => range[0] + Math.random() * (range[1] - range[0]);
      this.live.push({
        sprite,
        x: o.x + (Math.random() - 0.5) * (o.w ?? 0),
        y: o.y + (Math.random() - 0.5) * (o.h ?? 0),
        vx: Math.cos(angle) * speed + (o.bias ?? 0) * o.speed * 0.8,
        vy: Math.sin(angle) * speed * 0.6 - (o.lift ?? 0) * (0.5 + Math.random() * 0.5),
        age: 0,
        life: rand(o.life),
        size: rand(o.size),
        spin: (Math.random() - 0.5) * (o.spin ?? 0),
        gravity: o.gravity ?? 0,
        drag: o.drag ?? 2.5,
      });
    }
  }

  update(dt: number): void {
    const s = dt / 1000;
    this.live = this.live.filter((p) => {
      p.age += s;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        this.spare.push(p.sprite);
        return false;
      }
      const k = Math.exp(-p.drag * s);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      const t = p.age / p.life;
      const size = p.size * (1 - t * 0.6);
      p.sprite.position.set(p.x, p.y);
      p.sprite.setSize(size, size);
      p.sprite.rotation += p.spin * s;
      p.sprite.alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      return true;
    });
  }

  clear(): void {
    for (const p of this.live) {
      p.sprite.visible = false;
      this.spare.push(p.sprite);
    }
    this.live = [];
  }
}

interface Mote {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
}

export interface FlowBurst {
  /** Where the light comes from: a row's horizontal span. */
  x0: number;
  x1: number;
  y: number;
  count: number;
  colors: number[];
  /** Outward speed, px/s. */
  speed: number;
  /** Strength of the swirling current. */
  swirl: number;
  life: [number, number];
  size: [number, number];
}

const MAX_MOTES = 1400;

/**
 * Flowing light, after Tetris Effect: tiny additive points that burst out
 * of a cleared row, then get carried by a slowly changing curl field into
 * soft swirls, stretching into silk-like streaks while they move fast.
 */
export class FlowLight {
  private live: Mote[] = [];
  private spare: Sprite[] = [];
  private time = 0;

  constructor(
    private layer: Container,
    private texture: () => Texture,
  ) {}

  burst(b: FlowBurst): void {
    const cx = (b.x0 + b.x1) / 2;
    const half = (b.x1 - b.x0) / 2;
    for (let i = 0; i < b.count && this.live.length < MAX_MOTES; i++) {
      const sprite = this.spare.pop() ?? this.layer.addChild(new Sprite());
      sprite.texture = this.texture();
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.tint = b.colors[i % b.colors.length];
      sprite.visible = true;
      const x = b.x0 + Math.random() * (b.x1 - b.x0);
      const side = (x - cx) / half || (Math.random() - 0.5);
      const speed = b.speed * (0.4 + Math.random() * 0.8);
      this.live.push({
        sprite,
        x,
        y: b.y + (Math.random() - 0.5) * 6,
        vx: side * speed + (Math.random() - 0.5) * speed * 0.3,
        vy: (Math.random() - 0.5) * speed * 0.35 - speed * 0.15,
        age: 0,
        life: b.life[0] + Math.random() * (b.life[1] - b.life[0]),
        size: b.size[0] + Math.random() * (b.size[1] - b.size[0]),
        seed: b.swirl * (0.6 + Math.random() * 0.8),
      });
    }
  }

  update(dt: number): void {
    const s = Math.min(0.05, dt / 1000);
    this.time += s;
    const t = this.time;
    this.live = this.live.filter((m) => {
      m.age += s;
      if (m.age >= m.life) {
        m.sprite.visible = false;
        this.spare.push(m.sprite);
        return false;
      }
      // Divergence-free-ish swirl from a few sines: smooth, never jittery.
      const fx = Math.sin(m.y * 0.013 + t * 0.7) + Math.cos(m.y * 0.007 - t * 0.4);
      const fy = Math.cos(m.x * 0.011 - t * 0.6) - Math.sin(m.x * 0.017 + t * 0.3);
      const drag = Math.exp(-s * 2.2);
      m.vx = m.vx * drag + fx * m.seed * s;
      m.vy = m.vy * drag + (fy * m.seed - 12) * s;
      m.x += m.vx * s;
      m.y += m.vy * s;
      const p = m.age / m.life;
      const speed = Math.hypot(m.vx, m.vy);
      const length = m.size * (1 + Math.min(6, speed / 45));
      const sp = m.sprite;
      sp.position.set(m.x, m.y);
      sp.rotation = Math.atan2(m.vy, m.vx);
      sp.setSize(length, m.size);
      sp.alpha = (p < 0.08 ? p / 0.08 : 1) * (1 - p) ** 1.3 * (0.75 + 0.25 * Math.sin(m.age * 9 + m.seed));
      return true;
    });
  }

  clear(): void {
    for (const m of this.live) {
      m.sprite.visible = false;
      this.spare.push(m.sprite);
    }
    this.live = [];
  }
}
