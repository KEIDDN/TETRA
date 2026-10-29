import { SHAPES, type PieceType } from '@tetra/engine';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { AudioBands } from '../../audio/music';

export type Formation = 'welcome' | 'index' | 'sound' | 'rooms' | 'play' | 'versus' | 'focus' | 'design' | 'oxia' | 'mark';

const TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const PIECES = 36;
/** One piece in this many is porcelain; the rest are graphite. */
const PORCELAIN_EVERY = 4;

interface Piece {
  cells: [number, number][];
  porcelain: boolean;
  seed: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
  glow: number;
  /** Each cell's offset within the piece, easing between its own shape and a square. */
  offsets: THREE.Vector2[];
}

interface Pose {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: number;
  glow: number;
  /** Draw the piece as a 2×2 block (for the mark), not its own shape. */
  square?: boolean;
}

const SQUARE: [number, number][] = [
  [-0.5, 0.5],
  [0.5, 0.5],
  [-0.5, -0.5],
  [0.5, -0.5],
];

function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 2 ** 32;
}

/** The T of the TETRA mark, as macro cells. */
const MARK: [number, number][] = [
  [-1, 1],
  [0, 1],
  [1, 1],
  [0, 0],
];

/**
 * A satin material whose per-instance colour is light, not paint: the
 * instance colour feeds emission, so any piece can glow on the beat while
 * keeping its own shading.
 */
function glowMaterial(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', '')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + vColor;');
  };
  return material;
}

/**
 * The Experience's stage: monochrome tetrominoes in graphite and porcelain
 * that settle into a formation per screen and move with the music. Every
 * piece eases toward its pose, so changing screens never jumps or tears.
 */
export class ExperienceScene {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 1, 120);
  private graphite: THREE.InstancedMesh;
  private porcelain: THREE.InstancedMesh;
  private key: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private pieces: Piece[] = [];
  private dummy = new THREE.Object3D();
  private target = new THREE.Quaternion();
  private color = new THREE.Color();
  private scratchPos = new THREE.Vector3();
  private scratchRot = new THREE.Euler();
  private time = 0;
  private raf = 0;
  private last = performance.now();
  private disposed = false;
  private beats = 0;
  private lastBeat = 0;
  formation: Formation = 'welcome';
  /** Focus off: the room reacts to the music. On: everything settles and goes still. */
  reactive = true;
  bands: AudioBands | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor(0x000000, 1);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    this.scene.fog = new THREE.Fog(0x000000, 28, 64);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 0.35));
    // A soft key from the upper left and a cool fill from behind: shading, never hotspots.
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(-8, 10, 12);
    this.fill = new THREE.DirectionalLight(0xdfe3ff, 0.9);
    this.fill.position.set(10, -2, -8);
    this.scene.add(this.key, this.fill);

    const r = rand(11);
    for (let i = 0; i < PIECES; i++) {
      this.pieces.push({
        cells: SHAPES[TYPES[i % TYPES.length]][0].map(([x, y]) => [x, y] as [number, number]),
        porcelain: i % PORCELAIN_EVERY === 1,
        seed: r(),
        pos: new THREE.Vector3((r() - 0.5) * 40, (r() - 0.5) * 24, -30),
        quat: new THREE.Quaternion(),
        scale: 1,
        glow: 0,
        offsets: SHAPES[TYPES[i % TYPES.length]][0].map(([x, y]) => new THREE.Vector2(x - 1, -y + 1)),
      });
    }
    // Generous bevels with enough segments that highlights stay smooth.
    const box = new RoundedBoxGeometry(0.9, 0.9, 0.9, 4, 0.16);
    const count = (porcelain: boolean) => this.pieces.filter((p) => p.porcelain === porcelain).length * 4;
    this.graphite = new THREE.InstancedMesh(box, glowMaterial(0x2c2c31, 0.55, 0.1), count(false));
    this.porcelain = new THREE.InstancedMesh(box, glowMaterial(0xcfcfd4, 0.48, 0), count(true));
    for (const mesh of [this.graphite, this.porcelain]) {
      for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, this.color.setScalar(0));
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    }

    // Multisampled target: the composer would otherwise lose antialiasing and the edges would stair-step.
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), { samples: 4, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Only real light blooms: the threshold sits above anything the lamps can make.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.28, 0.92);
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
    this.graphite.geometry.dispose();
    (this.graphite.material as THREE.Material).dispose();
    (this.porcelain.material as THREE.Material).dispose();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
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

  /** Where piece i wants to be in the current formation, and how much light it gives. */
  private pose(i: number, p: Piece, t: number): Pose {
    const r = rand(i * 97 + 1);
    const a = r();
    const b = r();
    const d = r();
    // Scratch objects: the pose is read at once, so nothing is allocated per frame.
    const pos = this.scratchPos.set(0, 0, 0);
    const rot = this.scratchRot.set(0, 0, 0);
    let scale = 1;
    let glow = 0;
    const kick = this.reactive ? (this.bands?.kick ?? 0) : 0;
    const low = this.reactive ? (this.bands?.low ?? 0) : 0;
    // Text sits left on wide screens, so compositions take the right.
    const side = this.camera.aspect >= 1.2 ? 7 : 0;
    switch (this.formation) {
      case 'welcome': {
        // A slow shell of pieces far behind the words, opening a clear centre.
        const ang = a * Math.PI * 2 + t * 0.035 * (0.6 + b);
        const rad = 11 + b * 8;
        pos.set(Math.cos(ang) * rad * 1.35, Math.sin(ang) * rad * 0.75, -14 - d * 10);
        rot.set(a * 6 + t * 0.08 * (a - 0.5), b * 6 + t * 0.06 * (b - 0.5), d * 6);
        glow = p.porcelain ? 0.05 + kick * 0.25 : 0;
        break;
      }
      case 'index': {
        // A loose, drifting column on the right, like the wheel's echo.
        const y = ((i / PIECES) * 2 - 1) * 9;
        pos.set(side + 2 + Math.sin(t * 0.3 + i) * 1.5 + (a - 0.5) * 6, y + Math.sin(t * 0.2 + d * 6) * 0.6, -6 - b * 8);
        rot.set(t * 0.1 + a * 6, t * 0.07 + b * 6, d * 6);
        glow = p.porcelain ? 0.04 : 0;
        break;
      }
      case 'sound': {
        // A speaker cone: two rings facing you, pumping with the bass.
        const inner = i % 4 === 0;
        const k = inner ? i / 4 : i - Math.floor(i / 4) - 1;
        const n = inner ? PIECES / 4 : PIECES - PIECES / 4;
        const ang = (k / n) * Math.PI * 2 + t * (inner ? -0.18 : 0.1);
        const rad = (inner ? 3.6 : 7) + low * 0.8 + kick * (inner ? 0.6 : 0.3);
        pos.set(side + Math.cos(ang) * rad, Math.sin(ang) * rad, -10 - (inner ? 0 : 2) + kick * (inner ? 0.8 : 0.3));
        rot.set(0, 0, ang + Math.PI / 2);
        glow = inner ? 0.05 + kick * 0.7 : 0;
        break;
      }
      case 'rooms': {
        // An LED wall: pieces locked in a grid, light sweeping across on the beat.
        const cols = 6;
        const x = i % cols;
        const y = Math.floor(i / cols);
        pos.set(side + (x - (cols - 1) / 2) * 3.05, (y - 2.5) * 2.2, -11);
        rot.set(0, 0, (i % 2) * Math.PI);
        const sweep = this.reactive ? (this.beats + x) % cols : -1;
        glow = sweep === 0 ? 1.1 + kick * 0.8 : sweep === 1 ? 0.25 : 0;
        break;
      }
      case 'play': {
        // Pieces falling in columns, endlessly; each lands with a flash.
        const col = (i % 6) - 2.5;
        const speed = 1.2 + a * 0.6;
        const fall = ((t * speed + b * 28) % 28) - 14;
        pos.set(side + col * 2.6, -fall, -10 - d * 4);
        rot.set(0, 0, Math.floor(b * 4) * (Math.PI / 2));
        glow = fall > 9 && this.reactive ? 0.9 : 0;
        break;
      }
      case 'versus': {
        // Two stacks face off; attacks fly across on the beat.
        const sideOf = i % 2 === 0 ? -1 : 1;
        const k = Math.floor(i / 2);
        const col = k % 3;
        const row = Math.floor(k / 3);
        const lean = sideOf * (0.35 + Math.sin(t * 0.4) * 0.05);
        pos.set(side + sideOf * 4.2 + (col - 1) * 2.6 * 0.9, (row - 2.5) * 2.1, -11);
        rot.set(0, lean, 0);
        const turn = this.reactive ? this.beats % 2 : -1;
        glow = (turn === 0 && sideOf < 0) || (turn === 1 && sideOf > 0) ? (row === 5 - (this.beats % 6) ? 1 + kick * 0.6 : 0.08) : 0;
        break;
      }
      case 'design': {
        // A precise, slowly turning lattice: every piece in its place.
        const cols = 6;
        const x = i % cols;
        const y = Math.floor(i / cols);
        pos.set(side + (x - (cols - 1) / 2) * 3.2, (y - 2.5) * 2.3, -12);
        rot.set(0.25 + Math.sin(t * 0.2) * 0.1, -0.5 + Math.sin(t * 0.15) * 0.12, 0);
        glow = p.porcelain ? 0.06 + kick * 0.3 : 0;
        break;
      }
      case 'focus': {
        if (this.reactive) {
          // Experience: the pieces orbit and breathe with the music.
          const ang = (i / PIECES) * Math.PI * 2 + t * 0.25;
          const rad = 5.5 + low * 1.5 + Math.sin(t * 0.7 + i) * 0.6;
          pos.set(side + Math.cos(ang) * rad, Math.sin(ang * 2) * 3.2, -9 + Math.sin(ang) * rad * 0.6);
          rot.set(ang + t * 0.3, ang * 0.5, t * 0.2 * (a - 0.5));
          glow = p.porcelain ? 0.1 + kick * 0.7 : 0;
        } else {
          // Focus: a quiet, ordered stack. Nothing moves, nothing glows.
          const cols = 6;
          const x = i % cols;
          const y = Math.floor(i / cols);
          pos.set(side + (x - (cols - 1) / 2) * 3.05, (y - 2.5) * 2.2, -12);
          rot.set(0, 0, (i % 2) * Math.PI);
        }
        break;
      }
      default: {
        // The mark: the TETRA T built from minos. Every piece folds into a 2×2 block;
        // nine blocks make each of the T's four cells. Centred above the words, or
        // to the right of them on the OXIA page.
        const cell = MARK[Math.floor(i / 9)];
        const k = i % 9;
        const page = this.formation === 'mark';
        const unit = page ? 0.36 : 0.34;
        const block = 2 * unit;
        const macro = 3 * block + unit * 1.2;
        const [cx, cy, cz] = page ? [side ? 11.5 : 0, -0.5, -12] : [0, 4.2, -8];
        pos.set(cx + cell[0] * macro + ((k % 3) - 1) * block, cy + (cell[1] - 0.5) * macro + (Math.floor(k / 3) - 1) * block, cz);
        rot.set(0, 0, 0);
        scale = unit;
        // Each of the T's four cells reads as one solid square of light: all its
        // minos glow together. The cells take the beat in turn, the bass breathes through all.
        const lit = this.reactive && (this.beats + Math.floor(i / 9)) % 4 === 0;
        // Graphite gets extra light so it matches porcelain: one even surface per cell.
        glow = (p.porcelain ? 0.04 : 0.3) + low * 0.12 + (lit ? 0.22 + kick * 0.45 : kick * 0.06);
        return { pos, rot, scale, glow, square: true };
      }
    }
    // Pieces live on four depth layers, so neighbours can never cut through each other.
    pos.z -= (i % 4) * 1.05;
    return { pos, rot, scale, glow };
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    // A hidden tab draws nothing.
    if (document.hidden) {
      this.last = now;
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // Time slows almost to a stop in Focus.
    this.time += dt * (this.reactive ? 1 : 0.15);
    const t = this.time;
    if (this.bands?.beat && this.bands.beat > 0.9 && now - this.lastBeat > 200) {
      this.lastBeat = now;
      this.beats++;
    }
    // Critically damped approach: a fixed fraction per second, never overshooting.
    const follow = 1 - Math.exp(-dt * 3.2);
    const glowFollow = 1 - Math.exp(-dt * 14);
    let gi = 0;
    let pi = 0;
    this.pieces.forEach((p, i) => {
      const pose = this.pose(i, p, t);
      p.pos.lerp(pose.pos, follow);
      this.target.setFromEuler(pose.rot);
      p.quat.slerp(this.target, follow);
      p.scale += (pose.scale - p.scale) * follow;
      p.glow += (pose.glow - p.glow) * glowFollow;
      p.cells.forEach(([cx, cy], k) => {
        const [sx, sy] = pose.square ? SQUARE[k] : [cx - 1, -cy + 1];
        p.offsets[k].x += (sx - p.offsets[k].x) * follow;
        p.offsets[k].y += (sy - p.offsets[k].y) * follow;
      });
      const mesh = p.porcelain ? this.porcelain : this.graphite;
      this.color.setScalar(p.glow);
      for (const o of p.offsets) {
        this.dummy.position.set(o.x, o.y, 0).applyQuaternion(p.quat).multiplyScalar(p.scale).add(p.pos);
        this.dummy.quaternion.copy(p.quat);
        // In the mark the minos close up into solid squares.
        this.dummy.scale.setScalar(p.scale * (pose.square ? 1.1 : 1));
        this.dummy.updateMatrix();
        const index = p.porcelain ? pi++ : gi++;
        mesh.setMatrixAt(index, this.dummy.matrix);
        mesh.setColorAt(index, this.color);
      }
    });
    for (const mesh of [this.graphite, this.porcelain]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const kick = this.reactive ? (this.bands?.kick ?? 0) : 0;
    this.key.intensity = 2 + kick * 0.6;
    this.bloom.strength = this.reactive ? 0.5 + kick * 0.3 : 0.25;

    // The camera floats a little, never still, never far.
    this.camera.position.set(Math.sin(t * 0.13) * 0.5, Math.cos(t * 0.11) * 0.35, 16);
    this.camera.lookAt(0, 0, -6);
    this.composer.render(dt);
    this.raf = requestAnimationFrame(this.frame);
  };
}
