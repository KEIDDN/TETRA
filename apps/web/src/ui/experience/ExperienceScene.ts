import { SHAPES, type PieceType } from '@tetra/engine';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioBands } from '../../audio/music';

const TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const PIECES = 35;
/** One in this many pieces is lit; the rest are graphite. */
const LIT_EVERY = 4;

interface Piece {
  type: PieceType;
  cells: [number, number][];
  lit: boolean;
  seed: number;
  color: THREE.Color;
}

interface Pose {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: number;
}

function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 2 ** 32;
}

/** The big T of the TETRA mark, as a grid of macro cells. */
const MARK: [number, number][] = [
  [-1, 1], [0, 1], [1, 1],
  [0, 0],
];

/**
 * The Experience's stage: a few dozen tetrominoes in bevelled graphite and
 * light, that change formation as you scroll (scatter, rain, wall, speaker,
 * tunnel, helix, the TETRA mark) and move with the music.
 */
export class ExperienceScene {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private dark: THREE.InstancedMesh;
  private lit: THREE.InstancedMesh;
  private litMaterial: THREE.MeshBasicMaterial;
  private key: THREE.SpotLight;
  private core: THREE.PointLight;
  private rim: THREE.DirectionalLight;
  private pieces: Piece[] = [];
  private dummy = new THREE.Object3D();
  private time = 0;
  /** Scroll position in chapters (0 = hero). */
  progress = 0;
  bands: AudioBands | null = null;
  private raf = 0;
  private last = performance.now();
  private disposed = false;
  private accents: THREE.Color[];

  constructor(
    private host: HTMLElement,
    palette: string[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.scene.fog = new THREE.FogExp2(0x000000, 0.035);
    this.accents = palette.map((c) => new THREE.Color(c));

    // Lights: a hard key from above, a cold rim from behind, and a core that pumps with the kick.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    this.key = new THREE.SpotLight(0xffffff, 160, 60, 0.55, 0.5, 1.6);
    this.key.position.set(-6, 14, 10);
    this.scene.add(this.key, this.key.target);
    this.rim = new THREE.DirectionalLight(0xe8e8f0, 1.4);
    this.rim.position.set(6, 3, -12);
    this.scene.add(this.rim);
    this.core = new THREE.PointLight(0xedebfa, 20, 30, 2);
    this.core.position.set(0, 0, -4);
    this.scene.add(this.core);

    const r = rand(7);
    for (let i = 0; i < PIECES; i++) {
      const type = TYPES[i % TYPES.length];
      const lit = i % LIT_EVERY === 0;
      this.pieces.push({
        type,
        cells: SHAPES[type][0].map(([x, y]) => [x, y] as [number, number]),
        lit,
        seed: r(),
        color: this.accents[i % this.accents.length] ?? new THREE.Color(0xffffff),
      });
    }
    const darkCount = this.pieces.filter((p) => !p.lit).length * 4;
    const litCount = this.pieces.filter((p) => p.lit).length * 4;
    const box = new RoundedBoxGeometry(0.92, 0.92, 0.92, 3, 0.14);
    // Graphite: dark, satin, catching the key light on its bevels.
    const darkMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1f, roughness: 0.42, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.35 });
    // Lit pieces are pure light in their own color: the bloom does the rest.
    this.litMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.dark = new THREE.InstancedMesh(box, darkMaterial, darkCount);
    this.lit = new THREE.InstancedMesh(box, this.litMaterial, litCount);
    let li = 0;
    for (const p of this.pieces) if (p.lit) for (let k = 0; k < 4; k++) this.lit.setColorAt(li++, p.color);
    this.scene.add(this.dark, this.lit);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.7, 0.62);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.dark.geometry.dispose();
    (this.dark.material as THREE.Material).dispose();
    this.litMaterial.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize = (): void => {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // ── Formations ─────────────────────────────────────────────

  /** Where piece i stands in chapter c (0 hero … 6 the mark). */
  private pose(c: number, i: number, p: Piece, t: number): Pose {
    const r = rand(i * 97 + c * 13 + 1);
    const a = r(), b = r(), d = r();
    const n = PIECES;
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();
    let scale = 1;
    switch (c) {
      case 0: {
        // Scatter: a slow drifting field, deep and wide, around an empty centre.
        const ang = a * Math.PI * 2 + t * 0.04 * (0.5 + b);
        const rad = 6 + b * 9;
        pos.set(Math.cos(ang) * rad * 1.2, (d - 0.5) * 12, -6 - Math.sin(ang) * rad);
        rot.set(t * 0.2 * (a - 0.5) + a * 6, t * 0.15 * (b - 0.5) + b * 6, d * 6);
        break;
      }
      case 1: {
        // Rain: columns falling through the frame, endlessly.
        const col = (i % 9) - 4;
        const fall = ((t * (0.9 + a * 0.8) + b * 30) % 30) - 15;
        pos.set(col * 2.6 + (a - 0.5), -fall, -8 - d * 8);
        rot.set(0, 0, Math.floor(b * 4) * (Math.PI / 2));
        break;
      }
      case 2: {
        // The wall: pieces locked side by side into a stack behind the text.
        const colW = 7;
        const x = (i % colW) - (colW - 1) / 2;
        const y = Math.floor(i / colW);
        pos.set(x * 3.1, y * 2.25 - 5.5, -10);
        rot.set(0, 0, (i % 2) * Math.PI);
        break;
      }
      case 3: {
        // The speaker: a ring facing you, its radius pumping with the bass.
        const ang = (i / n) * Math.PI * 2 + t * 0.12;
        const rad = 6.5 + (this.bands?.low ?? 0) * 1.6 + (this.bands?.kick ?? 0) * 0.8;
        pos.set(Math.cos(ang) * rad, Math.sin(ang) * rad, -9);
        rot.set(0, 0, ang + Math.PI / 2);
        break;
      }
      case 4: {
        // The tunnel: rings of pieces rushing past the camera.
        const ring = i % 7;
        const k = Math.floor(i / 7);
        const ang = (ring / 7) * Math.PI * 2 + k * 0.45;
        const z = ((k * 7 + t * 9) % 35) - 30;
        pos.set(Math.cos(ang) * 5.2, Math.sin(ang) * 5.2, z);
        rot.set(0, 0, ang);
        break;
      }
      case 5: {
        // The helix: a double strand turning slowly.
        const strand = i % 2;
        const ang = (i / n) * Math.PI * 6 + t * 0.35 + strand * Math.PI;
        pos.set(Math.cos(ang) * 4.2, (i / n) * 18 - 9, -8 + Math.sin(ang) * 4.2);
        rot.set(ang, ang * 0.5, 0);
        break;
      }
      default: {
        // The mark: the TETRA T. Each of its four cells is a tight 3×3 block of pieces, lit in the house colors.
        const cell = MARK[i % MARK.length];
        const k = Math.floor(i / MARK.length);
        const off = [(k % 3) - 1, Math.floor(k / 3) % 3 - 1];
        // Right of the text on wide screens, above it on tall ones.
        const wide = this.camera.aspect >= 1;
        pos.set(cell[0] * 6.2 + off[0] * 1.9 + (wide ? 12 : 0), cell[1] * 6.2 + off[1] * 1.3 + (wide ? -1.5 : 9), -12);
        rot.set(0, 0, 0);
        scale = 0.42;
      }
    }
    // The text lives on the left: formations that sit still take the right side of the frame.
    if ((c === 2 || c === 3 || c === 5) && this.camera.aspect >= 1) pos.x += 6;
    // Every piece breathes a little; lit ones swell on the kick.
    const kick = this.bands?.kick ?? 0;
    if (p.lit) scale *= 1 + kick * 0.12;
    return { pos, rot, scale };
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    const t = this.time;
    const bands = this.bands;
    const c0 = Math.max(0, Math.min(6, Math.floor(this.progress)));
    const c1 = Math.min(6, c0 + 1);
    const f = this.progress - c0;
    const blend = f * f * (3 - 2 * f);

    let di = 0;
    let li = 0;
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion();
    this.pieces.forEach((p, i) => {
      const a = this.pose(c0, i, p, t);
      const b = this.pose(c1, i, p, t);
      const pos = a.pos.clone().lerp(b.pos, blend);
      q0.setFromEuler(a.rot);
      q1.setFromEuler(b.rot);
      q0.slerp(q1, blend);
      const scale = a.scale + (b.scale - a.scale) * blend;
      // Hats make the lit pieces shiver a hair.
      if (p.lit && bands) pos.y += Math.sin(t * 40 + p.seed * 10) * bands.hat * 0.04;
      for (const [cx, cy] of p.cells) {
        this.dummy.position.set(cx - 1, -cy + 1, 0).applyQuaternion(q0).multiplyScalar(scale).add(pos);
        this.dummy.quaternion.copy(q0);
        this.dummy.scale.setScalar(scale);
        this.dummy.updateMatrix();
        if (p.lit) this.lit.setMatrixAt(li++, this.dummy.matrix);
        else this.dark.setMatrixAt(di++, this.dummy.matrix);
      }
    });
    this.dark.instanceMatrix.needsUpdate = true;
    this.lit.instanceMatrix.needsUpdate = true;

    // Light follows the music: the core pumps with the kick, everything opens on the drop.
    const kick = bands?.kick ?? 0;
    const drop = bands?.drop ?? 0;
    this.core.intensity = 12 + kick * 60 + drop * 80;
    this.litMaterial.color.setScalar(0.75 + kick * 0.9 + drop * 1.2);
    this.bloom.strength = 0.6 + kick * 0.35 + drop * 0.6;
    this.key.intensity = 120 + (bands?.low ?? 0) * 80;

    // The camera glides between chapters and drifts a little, never still.
    const cams: [number, number, number][] = [
      [0, 0, 14], [2, 3, 12], [0, 1, 11], [0, 0, 10], [0, 0, 6], [5, 2, 12], [0, 0, 18],
    ];
    const ca = cams[c0], cb = cams[c1];
    this.camera.position.set(
      ca[0] + (cb[0] - ca[0]) * blend + Math.sin(t * 0.13) * 0.6,
      ca[1] + (cb[1] - ca[1]) * blend + Math.cos(t * 0.11) * 0.4,
      ca[2] + (cb[2] - ca[2]) * blend,
    );
    this.camera.lookAt(0, 0, -8);
    this.composer.render(dt);
    this.raf = requestAnimationFrame(this.frame);
  };
}
