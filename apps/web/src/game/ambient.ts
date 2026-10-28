import { linkMasks, SHAPES, type PieceType } from '@tetra/engine';

/**
 * The ambient layer is a lattice: the board's grid continued across the
 * whole screen as a field of faint dots. Play sends ripples through it —
 * a single barely touches the cells around it, a quad crosses the screen —
 * and big moments release a few echoes: thin tetromino outlines drifting
 * away. It accompanies play without competing with it.
 */

export interface Dot {
  x: number;
  y: number;
  alpha: number;
  /** Radius, px. */
  size: number;
  color: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  /** px/s */
  speed: number;
  strength: number;
  /** The ripple dies out at this radius. */
  reach: number;
  color: number;
}

export interface Echo {
  kind: PieceType;
  color: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  scale: number;
  age: number;
  life: number;
}

const DANGER = 0xff453a;
const BASE_ALPHA = 0.05;

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Lattice {
  ripples: Ripple[] = [];
  echoes: Echo[] = [];
  /** Echo colors per piece. */
  palette: Partial<Record<PieceType, number>> = {};
  private points: { x: number; y: number }[] = [];
  private time = 0;
  private energy = 0;
  private energyTarget = 0;
  private danger = 0;
  private dangerTarget = 0;
  private focus: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    /** Overall strength, 0–1. */
    private intensity = 1,
  ) {}

  /**
   * Lays dots every `spacing` px aligned to (ox, oy), so they continue the
   * board grid; `exclude` (the board) stays empty.
   */
  layout(w: number, h: number, spacing: number, ox: number, oy: number, exclude?: Rect): void {
    this.points = [];
    const startX = ox - Math.ceil(ox / spacing) * spacing;
    const startY = oy - Math.ceil(oy / spacing) * spacing;
    for (let y = startY; y <= h + 1; y += spacing) {
      for (let x = startX; x <= w + 1; x += spacing) {
        if (exclude && x >= exclude.x - 1 && x <= exclude.x + exclude.w + 1 && y >= exclude.y - 1 && y <= exclude.y + exclude.h + 1) continue;
        this.points.push({ x, y });
      }
    }
    this.focus = exclude ? { x: exclude.x + exclude.w / 2, y: exclude.y + exclude.h / 2 } : { x: w / 2, y: h / 2 };
  }

  /** A ripple from (x, y). `power` ~1 for a single, ~6+ for a quad or T-spin. */
  ripple(x: number, y: number, power: number, color = 0xffffff): void {
    const reach = Math.min(2400, 90 + power * power * 40);
    this.ripples.push({ x, y, radius: 0, speed: 260 + power * 70, strength: Math.min(1, 0.25 + power * 0.1), reach, color });
  }

  /** A big moment: a wide ripple plus a few echoes leaving the board. */
  /** `spread`: half-width of what the echoes are born beside (the board), so they never cross it. */
  celebrate(x: number, y: number, power: number, color: number, kinds: PieceType[], spread = 40): void {
    this.ripple(x, y, power, color);
    const count = Math.min(6, 2 + Math.floor(power / 2));
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      const side = i % 2 ? 1 : -1;
      this.echoes.push({
        kind,
        color: this.palette[kind] ?? color,
        x: x + side * (spread + 20 + Math.random() * 50),
        y: y + (Math.random() - 0.5) * 60,
        vx: side * (50 + Math.random() * 70),
        vy: -(15 + Math.random() * 35),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.6,
        scale: 1,
        age: 0,
        life: 2.6 + Math.random() * 1.2,
      });
    }
  }

  setEnergy(e: number): void {
    this.energyTarget = e;
  }

  setDanger(d: number): void {
    this.dangerTarget = d;
  }

  /** True while something is changing and the lattice needs redrawing. */
  get active(): boolean {
    return this.ripples.length > 0 || Math.abs(this.energy - this.energyTarget) > 0.002 || this.danger > 0.002 || this.dangerTarget > 0;
  }

  update(dt: number): void {
    const s = Math.min(0.05, dt / 1000);
    this.time += s;
    this.energy += (this.energyTarget - this.energy) * Math.min(1, s * 2);
    this.danger += (this.dangerTarget - this.danger) * Math.min(1, s * 2.5);
    this.ripples = this.ripples.filter((r) => (r.radius += r.speed * s) < r.reach + 60);
    this.echoes = this.echoes.filter((e) => {
      e.age += s;
      e.x += e.vx * s;
      e.y += e.vy * s;
      e.vx *= Math.exp(-s * 0.6);
      e.vy *= Math.exp(-s * 0.6);
      e.rotation += e.spin * s;
      // Drifting into depth: shrink as it goes.
      e.scale = 1 - 0.45 * (e.age / e.life);
      return e.age < e.life;
    });
  }

  /** Visits every dot with its current brightness, size and color. */
  forEachDot(visit: (dot: Dot) => void): void {
    const band = 32;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
    for (const p of this.points) {
      let alpha = BASE_ALPHA;
      let size = 1;
      let color = 0xffffff;
      const dFocus = Math.hypot(p.x - this.focus.x, p.y - this.focus.y);
      if (this.energy > 0.01) alpha += this.energy * 0.07 * Math.exp(-dFocus / 380);
      for (const r of this.ripples) {
        const d = Math.hypot(p.x - r.x, p.y - r.y);
        if (d > r.reach) continue;
        const k = (d - r.radius) / band;
        if (k > 3 || k < -3) continue;
        const amp = r.strength * Math.exp(-k * k) * (1 - d / r.reach);
        alpha += amp * 0.7;
        size += amp;
        color = mix(color, r.color, Math.min(1, amp * 1.6));
      }
      if (this.danger > 0.01) {
        const near = Math.exp(-dFocus / 520);
        color = mix(color, DANGER, Math.min(1, this.danger * near * 1.4));
        alpha += this.danger * near * 0.06 * pulse;
      }
      visit({ x: p.x, y: p.y, alpha: Math.min(0.6, alpha * this.intensity), size, color });
    }
  }

  /** Outline segments of a tetromino centred on (0,0), in cell units. */
  static outline(kind: PieceType): [number, number, number, number][] {
    const cells = SHAPES[kind][0];
    const masks = linkMasks(cells);
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const segments: [number, number, number, number][] = [];
    cells.forEach(([x, y], i) => {
      const left = x - cx;
      const top = cy - y - 1;
      const m = masks[i];
      if (!(m & 1)) segments.push([left, top, left + 1, top]);
      if (!(m & 2)) segments.push([left + 1, top, left + 1, top + 1]);
      if (!(m & 4)) segments.push([left, top + 1, left + 1, top + 1]);
      if (!(m & 8)) segments.push([left, top, left, top + 1]);
    });
    return segments;
  }

  echoAlpha(e: Echo): number {
    const t = e.age / e.life;
    const fadeIn = Math.min(1, e.age / 0.25);
    return 0.75 * fadeIn * (1 - t) ** 1.4 * this.intensity;
  }
}
