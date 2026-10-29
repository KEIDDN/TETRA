import type { PieceType } from '@tetra/engine';
import { Container, Geometry, Mesh, RenderTexture, Shader, Sprite, type Renderer } from 'pixi.js';
import { fragment, VERTEX } from './common.glsl';
import * as SCENES from './scenes.glsl';

export type SceneId = 'studio' | 'clay' | 'gem' | 'crystal' | 'neon' | 'aurora' | 'ember' | 'bevel' | 'wire' | 'nes' | 'gameboy' | 'mono' | 'glass' | 'brut' | 'corten';

const SOURCES: Record<SceneId, { glsl: string; pixel?: boolean }> = {
  studio: { glsl: SCENES.STUDIO },
  clay: { glsl: SCENES.CLAY },
  gem: { glsl: SCENES.GEM },
  crystal: { glsl: SCENES.CRYSTAL },
  neon: { glsl: SCENES.NEON },
  aurora: { glsl: SCENES.AURORA },
  ember: { glsl: SCENES.EMBER },
  bevel: { glsl: SCENES.BEVEL },
  wire: { glsl: SCENES.WIRE },
  nes: { glsl: SCENES.NES, pixel: true },
  gameboy: { glsl: SCENES.GAMEBOY, pixel: true },
  mono: { glsl: SCENES.MONO },
  glass: { glsl: SCENES.GLASS },
  brut: { glsl: SCENES.BRUT },
  corten: { glsl: SCENES.CORTEN },
};

export function isShaderScene(id: string): id is SceneId {
  return id in SOURCES;
}

const ORDER: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const PULSES = 8;
/** Scenes are soft light: half resolution is indistinguishable and a quarter of the work. */
const SCALE = 0.5;

import type { AudioBands } from '../../audio/music';
export type { AudioBands };

/**
 * A full-screen shader behind the board. It speaks the same language as the
 * lattice (ripple, celebrate, energy, danger), so the renderer can feed
 * either without knowing which one the skin uses.
 */
export class ShaderScene {
  readonly view = new Container();
  palette: Partial<Record<PieceType, number>> = {};
  private mesh: Mesh<Geometry, Shader>;
  private sprite: Sprite;
  private target: RenderTexture | null = null;
  private u: Record<string, unknown>;
  private time = 0;
  private next = 0;
  private energy = 0;
  private energyTarget = 0;
  private danger = 0;
  private dangerTarget = 0;
  private flare = 0;
  private audio: AudioBands = { low: 0, mid: 0, high: 0, beat: 0, kick: 0, hat: 0, beatInBar: 0, phrase: 0, phraseIndex: 0, drop: 0, build: 0, breakdown: false };
  /** Strobes on drops; switched off by Reduce flashing. */
  strobes = true;
  private strobeUntil = -1;
  private size = { w: 1, h: 1 };
  private board = { x: 0, y: 0, w: 0, h: 0 };
  private scale = SCALE;

  constructor(
    readonly id: SceneId,
    private renderer: Renderer,
    /** Brightness ceiling: about 0.2 on Full, 0.11 on Calm. */
    cap: number,
  ) {
    const geometry = new Geometry({
      attributes: { aPosition: [0, 0, 1, 0, 1, 1, 0, 1], aUV: [0, 0, 1, 0, 1, 1, 0, 1] },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const shader = Shader.from({
      gl: { vertex: VERTEX, fragment: fragment(SOURCES[id].glsl), name: `scene-${id}` },
      resources: {
        scene: {
          uRes: { value: [1, 1], type: 'vec2<f32>' },
          uTime: { value: 0, type: 'f32' },
          uBoard: { value: [0, 0, 0, 0], type: 'vec4<f32>' },
          uCell: { value: 30, type: 'f32' },
          uEnergy: { value: 0, type: 'f32' },
          uDanger: { value: 0, type: 'f32' },
          uLevel: { value: 0, type: 'f32' },
          uFlare: { value: 0, type: 'f32' },
          uCap: { value: cap, type: 'f32' },
          uAudio: { value: [0, 0, 0, 0], type: 'vec4<f32>' },
          uPal: { value: new Float32Array(7 * 4), type: 'vec4<f32>', size: 7 },
          uPulse: { value: new Float32Array(PULSES * 4), type: 'vec4<f32>', size: PULSES },
          uPulseCol: { value: new Float32Array(PULSES * 4), type: 'vec4<f32>', size: PULSES },
          uMusic: { value: [0, 0, 0, 0], type: 'vec4<f32>' },
          uClock: { value: [0, 0, 0, 0], type: 'vec4<f32>' },
        },
      },
    });
    this.u = (shader.resources.scene as { uniforms: Record<string, unknown> }).uniforms;
    this.mesh = new Mesh({ geometry, shader });
    this.sprite = new Sprite();
    this.view.addChild(this.sprite);
  }

  setCap(cap: number): void {
    this.u.uCap = cap;
  }

  /** Same arguments as the lattice; the scene covers the whole canvas. */
  layout(w: number, h: number, cell: number, board: { x: number; y: number; w: number; h: number }): void {
    this.size = { w, h };
    this.board = board;
    this.u.uRes = [w, h];
    this.u.uCell = cell;
    this.u.uBoard = [board.x, board.y, board.w, board.h];
    this.mesh.scale.set(w * this.scale, h * this.scale);
    this.target?.destroy(true);
    this.target = RenderTexture.create({ width: Math.max(1, Math.ceil(w * this.scale)), height: Math.max(1, Math.ceil(h * this.scale)), resolution: 1 });
    this.target.source.scaleMode = SOURCES[this.id].pixel ? 'nearest' : 'linear';
    this.sprite.texture = this.target;
    this.sprite.setSize(w, h);
  }

  ripple(x: number, y: number, power: number, color = 0xffffff, kind = 0): void {
    const i = this.next++ % PULSES;
    const p = this.u.uPulse as Float32Array;
    const c = this.u.uPulseCol as Float32Array;
    p.set([x, y, this.time, power], i * 4);
    c.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, kind], i * 4);
  }

  celebrate(x: number, y: number, power: number, color: number, _kinds?: PieceType[], _spread?: number): void {
    this.ripple(x, y, power, color, 1);
    this.flare = Math.min(2, this.flare + 0.35 + power * 0.12);
  }

  setEnergy(e: number): void {
    this.energyTarget = e;
  }

  setDanger(d: number): void {
    this.dangerTarget = d;
  }

  setLevel(progress: number): void {
    this.u.uLevel = Math.max(0, Math.min(1, progress));
  }

  setAudio(bands: AudioBands): void {
    this.audio = bands;
  }

  /** Render resolution as a fraction of the screen (auto quality lowers it on slow devices). */
  setScale(scale: number): void {
    if (scale === this.scale) return;
    this.scale = scale;
    this.layout(this.size.w, this.size.h, this.u.uCell as number, this.board);
  }

  update(dt: number): void {
    const s = Math.min(0.05, dt / 1000);
    this.time += s;
    this.energy += (this.energyTarget - this.energy) * Math.min(1, s * 2);
    this.danger += (this.dangerTarget - this.danger) * Math.min(1, s * 2.5);
    this.flare *= Math.exp(-s * 0.9);
    const pal = this.u.uPal as Float32Array;
    ORDER.forEach((k, i) => {
      const n = this.palette[k] ?? 0xffffff;
      pal.set([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1], i * 4);
    });
    this.u.uTime = this.time;
    this.u.uEnergy = this.energy;
    this.u.uDanger = this.danger;
    this.u.uFlare = this.flare;
    const a = this.audio;
    this.u.uAudio = [a.low, a.mid, a.high, a.beat];
    // Strobes: one bar of flashes on every beat right after a drop, nothing else.
    if (a.drop > 0.97 && this.strobeUntil < this.time) this.strobeUntil = this.time + (4 * 60) / 126;
    const strobe = this.strobes && this.time < this.strobeUntil ? Math.pow(a.beat, 6) : 0;
    this.u.uMusic = [a.kick, a.hat, a.drop, a.build];
    this.u.uClock = [a.beatInBar, a.phrase, a.phraseIndex % 64, strobe];
    if (this.target) this.renderer.render({ container: this.mesh, target: this.target, clear: true });
  }

  destroy(): void {
    this.view.destroy({ children: true });
    this.mesh.destroy();
    this.target?.destroy(true);
  }

  get width(): number {
    return this.size.w;
  }
}
