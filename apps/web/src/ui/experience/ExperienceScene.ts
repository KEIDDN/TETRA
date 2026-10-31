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
  /** Where its current move started, and when (scene clock, s). */
  from: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  fromScale: number;
  fromOffsets: THREE.Vector2[];
  start: number;
}

interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
  glow: number;
  /** Draw the piece as a 2×2 block (for the mark), not its own shape. */
  square?: boolean;
}

/** How long one piece takes to travel between formations, s. */
const MOVE = 1.15;
/** Depth between layers: neighbours in a formation sit on different layers, so they can never touch. */
const LAYER = 1.15;

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

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
  private color = new THREE.Color();
  private scratchPos = new THREE.Vector3();
  private scratchQuat = new THREE.Quaternion();
  private scratchGroup = new THREE.Quaternion();
  private scratchLocal = new THREE.Vector3();
  private scratchEuler = new THREE.Euler();
  private zAxis = new THREE.Vector3(0, 0, 1);
  private yAxis = new THREE.Vector3(0, 1, 0);
  /** Real seconds since the stage opened (transitions never slow down). */
  private clock = 0;
  /** The formation the pieces were last sent to. */
  private shown = '';
  /** The T's four cells as solid blocks; the pieces merge into them. */
  private markCells: THREE.Mesh[] = [];
  private markLevel = 0;
  private arrivedAt = 0;
  private time = 0;
  private raf = 0;
  private last = performance.now();
  private disposed = false;
  private observer: ResizeObserver;
  private width = 0;
  private height = 0;
  private beats = 0;
  private lastBeat = 0;
  formation: Formation = 'welcome';
  /** Focus off: the room reacts to the music. On: everything settles and goes still. */
  reactive = true;
  /** Text sits in the middle of the screen: compositions stay centred behind it. */
  centered = false;
  /** Seconds over which pieces set off on a formation change: long for the opening, where they fall in one by one. */
  stagger = 0.5;
  /** Nothing is drawn while the stage is covered (the real game is on screen). */
  paused = false;
  bands: AudioBands | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor(0x000000, 1);
    host.appendChild(this.renderer.domElement);
    // The canvas always fills its host in CSS pixels. Its buffer is larger on dense screens,
    // and without this it would show at buffer size, spilling right and down on every Retina display.
    Object.assign(this.renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });

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
        pos: new THREE.Vector3((r() - 0.5) * 30, 15 + r() * 12, -10),
        quat: new THREE.Quaternion(),
        scale: 1,
        glow: 0,
        offsets: SHAPES[TYPES[i % TYPES.length]][0].map(([x, y]) => new THREE.Vector2(x - 1, -y + 1)),
        from: new THREE.Vector3(),
        fromQuat: new THREE.Quaternion(),
        fromScale: 1,
        fromOffsets: [0, 1, 2, 3].map(() => new THREE.Vector2()),
        start: 0,
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

    const slab = new RoundedBoxGeometry(1, 1, 0.55, 5, 0.1);
    for (let c = 0; c < MARK.length; c++) {
      const cell = new THREE.Mesh(slab, new THREE.MeshStandardMaterial({ color: 0xd9d9de, roughness: 0.42, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0 }));
      cell.visible = false;
      this.markCells.push(cell);
      this.scene.add(cell);
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
    // Phones resize the page without a window resize (the toolbar sliding away, rotation settling).
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.observer.disconnect();
    this.graphite.geometry.dispose();
    this.markCells[0]?.geometry.dispose();
    for (const cell of this.markCells) (cell.material as THREE.Material).dispose();
    (this.graphite.material as THREE.Material).dispose();
    (this.porcelain.material as THREE.Material).dispose();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private resize = (): void => {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    // The compositions are framed for a landscape screen. On narrower ones the view widens
    // instead of cropping the sides, so a phone sees the same picture as a desktop, smaller.
    const FRAME = 1.25;
    this.camera.fov = this.camera.aspect >= FRAME ? 34 : (2 * Math.atan((Math.tan((17 * Math.PI) / 180) * FRAME) / this.camera.aspect) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  };

  /** Geometry of the T: unit is one mino, a macro cell is 3×3 two-mino blocks. */
  private markLayout() {
    const page = this.formation === 'mark';
    const side = !this.centered && this.camera.aspect >= 1.2 ? 7 : 0;
    const unit = page ? 0.3 : 0.34;
    const block = 2 * unit;
    const macro = 3 * block + unit * 1.2;
    const [cx, cy, cz] = page ? [side ? 10 : 0, -0.5, -12] : [0, 4.2, -8];
    return { unit, block, macro, cx, cy, cz };
  }

  /** Where piece i wants to be in the current formation, and how much light it gives. */
  private pose(i: number, p: Piece, t: number): Pose {
    const pos = this.scratchPos.set(0, 0, 0);
    const quat = this.scratchQuat.identity();
    let angle = 0;
    let layer = i % 4;
    let scale = 1;
    let glow = 0;
    const kick = this.reactive ? (this.bands?.kick ?? 0) : 0;
    const low = this.reactive ? (this.bands?.low ?? 0) : 0;
    // Text sits left on wide screens, so compositions take the right.
    const side = !this.centered && this.camera.aspect >= 1.2 ? 7 : 0;
    // A grid of pieces in their spawn orientation; neighbours alternate layers.
    const grid = (cols: number, dx: number, dy: number, cx: number, cy: number, z: number) => {
      const x = i % cols;
      const y = Math.floor(i / cols);
      const rows = Math.ceil(PIECES / cols);
      pos.set(cx + (x - (cols - 1) / 2) * dx, cy + ((rows - 1) / 2 - y) * dy, z);
      return { x, y };
    };
    switch (this.formation) {
      case 'welcome': {
        // A slow halo around the words, every piece riding the ring tangentially.
        const ang = (i / PIECES) * Math.PI * 2 + t * 0.03;
        pos.set(Math.cos(ang) * 14, Math.sin(ang) * 7.6, -13);
        angle = ang + Math.PI / 2;
        glow = p.porcelain ? 0.05 + kick * 0.3 : 0;
        break;
      }
      case 'index': {
        // A conveyor on the right: three columns drifting up, endlessly.
        const col = i % 3;
        const row = Math.floor(i / 3);
        const span = 12 * 2.7;
        const y = ((row * 2.7 + t * 0.55) % span) - span / 2;
        pos.set(side + 2 + (col - 1) * 3.7, y, -10);
        glow = p.porcelain ? 0.04 : 0;
        break;
      }
      case 'sound':
      case 'focus': {
        if (this.formation === 'focus' && !this.reactive) {
          // Focus: a quiet, ordered stack. Nothing moves, nothing glows.
          grid(6, 3.0, 2.3, side, 0, -12);
          break;
        }
        // A speaker cone: an inner ring that pumps with the kick, an outer one with the bass.
        const inner = i < 8;
        const k = inner ? i : i - 8;
        const n = inner ? 8 : PIECES - 8;
        const spin = this.formation === 'focus' ? 0.18 : 0.1;
        const ang = (k / n) * Math.PI * 2 + t * (inner ? -spin * 1.6 : spin);
        const rad = (inner ? 4.3 : 8.4) + low * 0.7 + kick * (inner ? 0.55 : 0.25);
        layer = inner ? k % 2 : 2 + (k % 2) + ((k >> 1) % 2) * 2;
        pos.set(side + Math.cos(ang) * rad, Math.sin(ang) * rad, -10);
        angle = ang + Math.PI / 2;
        glow = inner ? 0.05 + kick * 0.8 : p.porcelain ? 0.05 + kick * 0.2 : 0;
        break;
      }
      case 'rooms': {
        // An LED wall: light sweeps across the columns on the beat.
        const { x } = grid(6, 3.0, 2.3, side, 0, -12);
        const sweep = this.reactive ? (this.beats + x) % 6 : -1;
        glow = sweep === 0 ? 0.5 + kick * 0.4 : sweep === 1 ? 0.12 : 0;
        break;
      }
      case 'play': {
        // Rain: six columns, evenly spaced pieces falling at each column's own pace.
        const col = i % 6;
        const k = Math.floor(i / 6);
        const span = 30;
        const fall = ((t * (1.2 + col * 0.11) + k * (span / 6)) % span) - span / 2;
        pos.set(side + (col - 2.5) * 3.1, -fall, -11);
        layer = col % 4;
        glow = this.reactive && fall > span / 2 - 3 ? 0.7 : 0;
        break;
      }
      case 'versus': {
        // Two stacks face each other, each turned toward the other as one rigid block.
        const sideOf = i % 2 === 0 ? -1 : 1;
        const k = Math.floor(i / 2);
        const col = k % 3;
        const row = Math.floor(k / 3);
        layer = (col + row) % 4;
        this.scratchLocal.set((col - 1) * 3.1, (2.5 - row) * 2.2, -layer * LAYER);
        this.scratchGroup.setFromAxisAngle(this.yAxis, -sideOf * 0.42);
        this.scratchLocal.applyQuaternion(this.scratchGroup);
        pos.set(side + sideOf * 5.4, 0, -12).add(this.scratchLocal);
        quat.copy(this.scratchGroup);
        const turn = this.reactive ? this.beats % 2 : -1;
        const attacker = (turn === 0 && sideOf < 0) || (turn === 1 && sideOf > 0);
        glow = attacker && row === this.beats % 6 ? 0.5 + kick * 0.35 : 0;
        return { pos, quat, scale, glow };
      }
      case 'design': {
        // A precise lattice, turning slowly as one body: every piece in its place.
        const cols = 6;
        const x = i % cols;
        const y = Math.floor(i / cols);
        this.scratchLocal.set((x - 2.5) * 3.0, (2.5 - y) * 2.3, -layer * LAYER);
        this.scratchEuler.set(0.28 + Math.sin(t * 0.2) * 0.08, -0.55 + Math.sin(t * 0.15) * 0.1, 0);
        this.scratchGroup.setFromEuler(this.scratchEuler);
        this.scratchLocal.applyQuaternion(this.scratchGroup);
        pos.set(side, 0, -12).add(this.scratchLocal);
        quat.copy(this.scratchGroup);
        glow = p.porcelain ? 0.06 + kick * 0.3 : 0;
        return { pos, quat, scale, glow };
      }
      default: {
        // The mark: the TETRA T built from minos. Every piece folds into a 2×2 block;
        // nine blocks make each of the T's four cells. Centred above the words, or
        // to the right of them on the OXIA page.
        const cell = MARK[Math.floor(i / 9)];
        const k = i % 9;
        const { unit, block, macro, cx, cy, cz } = this.markLayout();
        pos.set(cx + cell[0] * macro + ((k % 3) - 1) * block, cy + (cell[1] - 0.5) * macro + (Math.floor(k / 3) - 1) * block, cz);
        scale = unit;
        // Each of the T's four cells reads as one solid square of light: all its
        // minos glow together. The cells take the beat in turn, the bass breathes through all.
        const lit = this.reactive && (this.beats + Math.floor(i / 9)) % 4 === 0;
        // Graphite gets extra light so it matches porcelain: one even surface per cell.
        glow = (p.porcelain ? 0.04 : 0.3) + low * 0.12 + (lit ? 0.22 + kick * 0.45 : kick * 0.06);
        return { pos, quat, scale, glow, square: true };
      }
    }
    pos.z -= layer * LAYER;
    // With the words in the middle, compositions step back so they frame the text instead of crossing it.
    if (this.centered) pos.z -= 7;
    quat.setFromAxisAngle(this.zAxis, angle);
    return { pos, quat, scale, glow };
  }

  private frame = (now: number): void => {
    if (this.disposed) return;
    // A hidden tab, or a covered stage, draws nothing.
    if (document.hidden || this.paused) {
      this.last = now;
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    // Formations keep moving slowly; in Focus time nearly stops.
    this.time += dt * (this.reactive ? 1 : 0.15);
    const t = this.time;
    if (this.bands?.beat && this.bands.beat > 0.9 && now - this.lastBeat > 200) {
      this.lastBeat = now;
      this.beats++;
    }

    // A new formation: every piece starts its own move, in a staggered cascade.
    const key = this.formation === 'focus' ? `focus-${this.reactive}` : this.formation;
    if (key !== this.shown) {
      this.shown = key;
      this.pieces.forEach((p) => {
        p.from.copy(p.pos);
        p.fromQuat.copy(p.quat);
        p.fromScale = p.scale;
        p.offsets.forEach((o, k) => p.fromOffsets[k].copy(o));
        p.start = this.clock + p.seed * this.stagger;
      });
      this.arrivedAt = this.clock + this.stagger + MOVE;
    }

    // The T: once the pieces have landed in its cells, solid blocks rise through them and take over.
    const marking = this.formation === 'mark' || this.formation === 'oxia';
    const markTarget = marking && this.clock > this.arrivedAt - 0.15 ? 1 : 0;
    this.markLevel += (markTarget - this.markLevel) * (1 - Math.exp(-dt * (markTarget ? 7 : 12)));

    const glowFollow = 1 - Math.exp(-dt * 14);
    let gi = 0;
    let pi = 0;
    this.pieces.forEach((p, i) => {
      const pose = this.pose(i, p, t);
      const e = Math.min(1, Math.max(0, (this.clock - p.start) / MOVE));
      const k = easeInOut(e);
      // On the way, pieces dip back into the room: movers pass behind the pieces at rest, never through them.
      p.pos.copy(p.from).lerp(pose.pos, k);
      p.pos.z -= Math.sin(Math.PI * e) * 7;
      p.quat.copy(p.fromQuat).slerp(pose.quat, k);
      p.scale = p.fromScale + (pose.scale - p.fromScale) * k;
      p.glow += (pose.glow * (e < 1 ? e * e : 1) - p.glow) * glowFollow;
      p.cells.forEach(([cx, cy], c) => {
        const [sx, sy] = pose.square ? SQUARE[c] : [cx - 1, -cy + 1];
        p.offsets[c].set(p.fromOffsets[c].x + (sx - p.fromOffsets[c].x) * k, p.fromOffsets[c].y + (sy - p.fromOffsets[c].y) * k);
      });
      const mesh = p.porcelain ? this.porcelain : this.graphite;
      this.color.setScalar(p.glow);
      for (const o of p.offsets) {
        this.dummy.position.set(o.x, o.y, 0).applyQuaternion(p.quat).multiplyScalar(p.scale).add(p.pos);
        this.dummy.quaternion.copy(p.quat);
        // In the mark the minos close up into solid squares.
        this.dummy.scale.setScalar(p.scale * (pose.square ? 1.1 * (1 - this.markLevel) : 1));
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
    const low = this.reactive ? (this.bands?.low ?? 0) : 0;
    const m = this.markLayout();
    this.markCells.forEach((cell, c) => {
      cell.visible = this.markLevel > 0.01;
      if (!cell.visible) return;
      const [mx, my] = MARK[c];
      // Each cell takes the beat in turn; the bass breathes through the whole mark.
      const lit = this.reactive && (this.beats + c) % 4 === 0;
      const size = 3 * m.block * (0.92 + 0.08 * this.markLevel) * (1 + (lit ? kick * 0.035 : 0));
      cell.position.set(m.cx + mx * m.macro, m.cy + (my - 0.5) * m.macro, m.cz);
      cell.scale.set(size, size, m.unit * 1.6 * this.markLevel);
      const material = cell.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.08 + low * 0.1 + (lit ? 0.16 + kick * 0.3 : 0);
    });
    this.key.intensity = 2 + kick * 0.6;
    this.bloom.strength = this.reactive ? 0.45 + kick * 0.25 : 0.2;

    // The camera floats a little, never still, never far.
    this.camera.position.set(Math.sin(this.clock * 0.13) * 0.5, Math.cos(this.clock * 0.11) * 0.35, 16);
    this.camera.lookAt(0, 0, -6);
    this.composer.render(dt);
    this.raf = requestAnimationFrame(this.frame);
  };
}
