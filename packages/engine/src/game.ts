import { attackFor, marginMultiplier, surgeFor, type AttackRules } from './attack';
import { Board, BOARD_WIDTH } from './board';
import { levelForLines, levelGravity, type LevelCurve } from './levels';
import { linkMasks } from './links';
import { getKicks } from './kicks';
import { GARBAGE_CODE, PIECE_CODE, SHAPES, spawnPosition, type Cell, type PieceType, type Rotation } from './pieces';
import { Bag, Rng } from './rng';
import { clearScore, HARD_DROP_POINTS, SOFT_DROP_POINTS } from './scoring';

/** One logic frame at 60 Hz, in ms. Gravity is expressed in G (rows per frame). */
export const FRAME_MS = 1000 / 60;

export type Action =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateCW'
  | 'rotateCCW'
  | 'rotate180'
  | 'hold';

export interface Handling {
  /** Delayed auto shift, ms. */
  das: number;
  /** Auto repeat rate, ms per cell. 0 = instant. */
  arr: number;
  /** Soft drop factor. Infinity = instant. */
  sdf: number;
  /** DAS cut delay: pause before a charged DAS moves a freshly spawned piece, ms. */
  dcd: number;
  /** Pressing the opposite direction restarts DAS instead of inheriting the charge. */
  cancelDasOnDirectionChange: boolean;
}

/** TETR.IO defaults: DAS 10F, ARR 2F, SDF 6×, DCD 1F. */
export const DEFAULT_HANDLING: Handling = {
  das: 10 * FRAME_MS,
  arr: 2 * FRAME_MS,
  sdf: 6,
  dcd: FRAME_MS,
  cancelDasOnDirectionChange: true,
};

export interface Rules {
  /** Gravity in G. 20 = instant. */
  gravity: number;
  lockDelay: number;
  maxLockResets: number;
  nextCount: number;
  holdEnabled: boolean;
  /** Non-T pieces score spins (as minis) when locked immobile after a rotation. */
  allSpin: boolean;
  /** Game finishes once this many lines are cleared. */
  lineGoal: number | null;
  /** Game finishes after this many ms. */
  timeLimit: number | null;
  /** When set, gravity follows the level curve instead of `gravity`. */
  levelCurve: LevelCurve | null;
  /** Versus rules; null in solo modes. */
  attack: AttackRules | null;
}

export const DEFAULT_RULES: Rules = {
  gravity: 0.02,
  lockDelay: 500,
  maxLockResets: 15,
  nextCount: 5,
  holdEnabled: true,
  allSpin: false,
  lineGoal: null,
  timeLimit: null,
  levelCurve: null,
  attack: null,
};

export type SpinKind = 'none' | 'mini' | 'full';

export interface ClearInfo {
  piece: PieceType;
  lines: number;
  spin: SpinKind;
  /** Back-to-back chain after this clear; -1 = none. */
  b2b: number;
  /** Combo after this clear; -1 = none. */
  combo: number;
  perfectClear: boolean;
}

export interface ClearedRow {
  /** Row index before the clear (y-up). */
  y: number;
  /** Cell codes of the row, left to right. */
  cells: number[];
}

export type GameEvent =
  | { type: 'spawn'; piece: PieceType }
  | { type: 'move' }
  | { type: 'rotate'; spin: boolean }
  | { type: 'hold' }
  | { type: 'hardDrop'; piece: PieceType; distance: number; cells: Cell[] }
  | { type: 'lock'; piece: PieceType; cells: Cell[] }
  | { type: 'clear'; info: ClearInfo; score: number; rows: ClearedRow[] }
  | { type: 'levelUp'; level: number }
  | { type: 'topout' }
  | { type: 'finish' }
  /** Lines sent to the opponent after cancelling; one entry per segment. */
  | { type: 'attack'; lines: number[]; time: number }
  /** Incoming lines cancelled by this player's attack. */
  | { type: 'cancel'; lines: number }
  | { type: 'garbageIn'; lines: number }
  | { type: 'garbageRise'; lines: number };

export type GameState = 'playing' | 'topout' | 'finished';

export interface ActivePiece {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export interface GameStats {
  pieces: number;
  lines: number;
  /** Key presses (for KPP). */
  inputs: number;
  holds: number;
  b2b: number;
  combo: number;
  maxCombo: number;
  maxB2b: number;
  score: number;
  level: number;
  /** Lines of attack produced (before cancelling). */
  attack: number;
  garbageReceived: number;
  /** Garbage rows cleared (for the VS score). */
  garbageCleared: number;
}

export interface IncomingGarbage {
  lines: number;
  /** Game time from which it may enter the board. */
  readyAt: number;
  /** Hole column, chosen when the attack first enters. */
  hole?: number;
}

export interface GameOptions {
  seed: number;
  rules?: Partial<Rules>;
  handling?: Partial<Handling>;
  /** Pieces dealt before the randomizer takes over (openers, tests). */
  pieces?: PieceType[];
}

/** T-piece corners in box coordinates, and which two face the nub for each rotation. */
const T_CORNERS: readonly Cell[] = [[0, 0], [2, 0], [0, 2], [2, 2]];
const T_FRONT: readonly (readonly [number, number])[] = [[2, 3], [1, 3], [0, 1], [0, 2]];

export function pieceCells(p: ActivePiece): Cell[] {
  return SHAPES[p.type][p.rotation].map(([x, y]) => [p.x + x, p.y + y] as const);
}

/**
 * Deterministic single-player game. Time is continuous (ms since start):
 * every input is applied at its exact timestamp, so the same seed and the
 * same timed inputs always replay the same game.
 */
export class Game {
  readonly board: Board;
  readonly rules: Rules;
  handling: Handling;
  readonly queue: PieceType[] = [];
  readonly events: GameEvent[] = [];
  readonly stats: GameStats = { pieces: 0, lines: 0, inputs: 0, holds: 0, b2b: -1, combo: -1, maxCombo: -1, maxB2b: -1, score: 0, level: 1, attack: 0, garbageReceived: 0, garbageCleared: 0 };
  /** Garbage waiting to enter, oldest first. */
  readonly incoming: IncomingGarbage[] = [];

  state: GameState = 'playing';
  time = 0;
  finishedAt: number | null = null;
  piece: ActivePiece | null = null;
  hold: PieceType | null = null;
  holdUsed = false;
  /** Bumped on every visible change, so renderers can skip redundant redraws. */
  version = 0;

  private bag: Bag;
  private garbageRng: Rng;
  private garbageColumn = -1;
  private held = new Set<Action>();
  private dir: -1 | 0 | 1 = 0;
  private dasStart = 0;
  private charged = false;
  private nextRepeatAt = 0;
  private softDrop = false;
  private fall = 0;
  private lockTimer = 0;
  private resets = 0;
  private lowestY = 0;
  private lastRotation = false;
  private lastKick = -1;
  private last180 = false;

  constructor(options: GameOptions, board = new Board()) {
    this.board = board;
    this.rules = { ...DEFAULT_RULES, ...options.rules };
    this.handling = { ...DEFAULT_HANDLING, ...options.handling };
    this.bag = new Bag(options.seed);
    this.garbageRng = new Rng((options.seed ^ 0x9e3779b9) >>> 0);
    this.queue.push(...(options.pieces ?? []));
    this.refillQueue();
    this.spawnNext();
  }

  // ── Public API ────────────────────────────────────────────────

  /** Advances the simulation to `t` ms. */
  update(t: number): void {
    const limit = this.rules.timeLimit;
    if (limit !== null) t = Math.min(t, limit);
    const { das, arr } = this.handling;
    let guard = 0;
    while (this.state === 'playing' && this.piece && guard++ < 100_000) {
      const grounded = this.isGrounded();
      const rate = this.gravityRate();
      let next = t;
      let kind: 'charge' | 'repeat' | 'fall' | 'lock' | null = null;

      if (this.dir !== 0) {
        if (!this.charged && this.dasStart + das <= next) {
          next = Math.max(this.dasStart + das, this.time);
          kind = 'charge';
        } else if (this.charged && arr > 0 && this.nextRepeatAt <= next) {
          next = Math.max(this.nextRepeatAt, this.time);
          kind = 'repeat';
        }
      }
      if (grounded) {
        const at = this.time + (this.rules.lockDelay - this.lockTimer);
        if (at < next || (at <= next && kind === null)) {
          next = at;
          kind = 'lock';
        }
      } else if (rate > 0 && Number.isFinite(rate)) {
        const at = this.time + (1 - this.fall) / rate;
        if (at < next || (at <= next && kind === null)) {
          next = at;
          kind = 'fall';
        }
      }

      const dt = next - this.time;
      if (grounded) this.lockTimer += dt;
      else if (Number.isFinite(rate)) this.fall += rate * dt;
      this.time = next;
      if (kind === null) break;

      switch (kind) {
        case 'charge':
          this.charged = true;
          this.nextRepeatAt = this.time;
          break;
        case 'repeat':
          this.shift(this.dir);
          this.nextRepeatAt += arr;
          break;
        case 'fall':
          this.fall = Math.max(0, this.fall - 1);
          if (this.moveDown() && this.softDrop) this.stats.score += SOFT_DROP_POINTS;
          break;
        case 'lock':
          this.lockPiece();
          break;
      }
      this.settle();
    }
    this.time = Math.max(this.time, t);
    if (limit !== null && this.time >= limit && this.state === 'playing') this.finish();
  }

  /** Queues garbage sent by the opponent at game time `t`. */
  receive(lines: number, t: number): void {
    if (lines <= 0 || this.state !== 'playing') return;
    this.incoming.push({ lines, readyAt: t + (this.rules.attack?.garbageDelay ?? 0) });
    this.stats.garbageReceived += lines;
    this.events.push({ type: 'garbageIn', lines });
  }

  /** Total lines waiting to enter. */
  get pendingGarbage(): number {
    return this.incoming.reduce((n, g) => n + g.lines, 0);
  }

  /** Ends a versus round from the outside (the opponent topped out). */
  stop(): void {
    if (this.state !== 'playing') return;
    this.state = 'finished';
    this.finishedAt = this.time;
    this.piece = null;
  }

  /** Swaps handling mid-game (e.g. when the player switches between keyboard and controller). */
  setHandling(handling: Handling): void {
    this.handling = handling;
  }

  /**
   * Applies a key press or release at time `t` ms. `heldSince` lets a key held
   * before the game started (during the countdown) arrive with its DAS already charging.
   */
  input(action: Action, pressed: boolean, t: number, heldSince = t): void {
    this.update(t);
    if (this.state !== 'playing') return;
    if (pressed) {
      if (this.held.has(action)) return;
      this.held.add(action);
      this.stats.inputs++;
      this.press(action, Math.min(heldSince, this.time));
    } else {
      if (!this.held.delete(action)) return;
      this.release(action);
    }
    this.settle();
    // Resolve anything already due, e.g. a DAS that was charged before the press arrived.
    this.update(this.time);
  }

  /** Row the active piece would land on. */
  ghostY(): number {
    const p = this.piece;
    if (!p) return 0;
    let y = p.y;
    while (this.fits(p.type, p.rotation, p.x, y - 1)) y--;
    return y;
  }

  /** How far (0–1) the active piece has fallen toward the next row; for smooth rendering. */
  get fallProgress(): number {
    return this.piece && !this.isGrounded() && Number.isFinite(this.gravityRate()) ? Math.min(this.fall, 0.999) : 0;
  }

  /** Elapsed play time in ms (frozen once the game ends). */
  get elapsed(): number {
    return this.finishedAt ?? this.time;
  }

  // ── Input handling ────────────────────────────────────────────

  private press(action: Action, since: number): void {
    switch (action) {
      case 'moveLeft':
        return this.pressDir(-1, since);
      case 'moveRight':
        return this.pressDir(1, since);
      case 'softDrop':
        this.softDrop = true;
        return;
      case 'hardDrop':
        return this.hardDrop();
      case 'rotateCW':
        return this.rotate(1);
      case 'rotateCCW':
        return this.rotate(3);
      case 'rotate180':
        return this.rotate(2);
      case 'hold':
        return this.doHold();
    }
  }

  private release(action: Action): void {
    if (action === 'softDrop') this.softDrop = false;
    else if (action === 'moveLeft') this.releaseDir(-1);
    else if (action === 'moveRight') this.releaseDir(1);
  }

  private pressDir(d: -1 | 1, since: number): void {
    const inherit = this.dir === -d && !this.handling.cancelDasOnDirectionChange;
    this.dir = d;
    if (!inherit) {
      this.dasStart = since;
      this.charged = false;
    }
    this.shift(d);
  }

  private releaseDir(d: -1 | 1): void {
    if (this.dir !== d) return;
    if (this.held.has(d === -1 ? 'moveRight' : 'moveLeft')) {
      this.dir = -d as -1 | 1;
      if (this.handling.cancelDasOnDirectionChange) {
        this.dasStart = this.time;
        this.charged = false;
      }
    } else {
      this.dir = 0;
      this.charged = false;
    }
  }

  // ── Piece movement ────────────────────────────────────────────

  private fits(type: PieceType, rotation: Rotation, x: number, y: number): boolean {
    for (const [cx, cy] of SHAPES[type][rotation]) {
      if (this.board.isFilled(x + cx, y + cy)) return false;
    }
    return true;
  }

  private isGrounded(): boolean {
    const p = this.piece;
    return !!p && !this.fits(p.type, p.rotation, p.x, p.y - 1);
  }

  /** Rows per ms; Infinity means pieces drop instantly. */
  private gravityRate(): number {
    const curve = this.rules.levelCurve;
    const g = curve ? levelGravity(curve, this.stats.level) : this.rules.gravity;
    const sdf = this.handling.sdf;
    const soft = this.softDrop ? (Number.isFinite(sdf) ? sdf * Math.max(g, 0.05) : Infinity) : 0;
    const G = Math.max(g, soft);
    return G >= 20 ? Infinity : G / FRAME_MS;
  }

  private shift(d: -1 | 0 | 1): boolean {
    const p = this.piece;
    if (!p || d === 0 || !this.fits(p.type, p.rotation, p.x + d, p.y)) return false;
    const groundedBefore = this.isGrounded();
    p.x += d;
    this.lastRotation = false;
    this.afterMove(groundedBefore);
    this.events.push({ type: 'move' });
    return true;
  }

  private moveDown(): boolean {
    const p = this.piece;
    if (!p || !this.fits(p.type, p.rotation, p.x, p.y - 1)) return false;
    p.y--;
    this.lastRotation = false;
    this.trackLowest();
    this.version++;
    return true;
  }

  private rotate(delta: 1 | 2 | 3): void {
    const p = this.piece;
    if (!p) return;
    const to = ((p.rotation + delta) % 4) as Rotation;
    const kicks = getKicks(p.type, p.rotation, to);
    const groundedBefore = this.isGrounded();
    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i];
      if (!this.fits(p.type, to, p.x + dx, p.y + dy)) continue;
      p.x += dx;
      p.y += dy;
      p.rotation = to;
      this.lastRotation = true;
      this.lastKick = i;
      this.last180 = delta === 2;
      this.trackLowest();
      this.afterMove(groundedBefore);
      this.events.push({ type: 'rotate', spin: this.detectSpin() !== 'none' });
      return;
    }
  }

  private hardDrop(): void {
    const p = this.piece;
    if (!p) return;
    let distance = 0;
    while (this.moveDown()) distance++;
    this.stats.score += distance * HARD_DROP_POINTS;
    this.events.push({ type: 'hardDrop', piece: p.type, distance, cells: pieceCells(p) });
    this.lockPiece();
  }

  private doHold(): void {
    const p = this.piece;
    if (!p || !this.rules.holdEnabled || this.holdUsed) return;
    this.holdUsed = true;
    this.stats.holds++;
    this.events.push({ type: 'hold' });
    const swap = this.hold;
    this.hold = p.type;
    if (swap) this.spawn(swap);
    else this.spawnNext();
  }

  /** A successful move or rotation refreshes the lock delay, up to the reset limit. */
  private afterMove(groundedBefore: boolean): void {
    this.version++;
    if ((groundedBefore || this.isGrounded()) && this.resets < this.rules.maxLockResets) {
      this.lockTimer = 0;
      this.resets++;
    }
  }

  /** Reaching a new lowest row restores all lock resets. */
  private trackLowest(): void {
    const p = this.piece!;
    if (p.y < this.lowestY) {
      this.lowestY = p.y;
      this.resets = 0;
      this.lockTimer = 0;
    }
  }

  /** Applies instantaneous effects: ARR 0 shifting, 20G / instant soft drop, exhausted lock resets. */
  private settle(): void {
    let moved = true;
    while (moved && this.state === 'playing' && this.piece) {
      moved = false;
      if (this.dir !== 0 && this.charged && this.handling.arr === 0) {
        while (this.shift(this.dir)) moved = true;
      }
      if (this.gravityRate() === Infinity) {
        while (this.moveDown()) {
          moved = true;
          if (this.softDrop) this.stats.score += SOFT_DROP_POINTS;
        }
      }
    }
    if (this.piece && this.isGrounded()) {
      this.fall = 0;
      if (this.resets >= this.rules.maxLockResets) this.lockPiece();
    }
  }

  // ── Locking & spawning ────────────────────────────────────────

  private detectSpin(): SpinKind {
    const p = this.piece;
    if (!p || !this.lastRotation) return 'none';
    if (p.type === 'T') {
      const filled = T_CORNERS.map(([cx, cy]) => this.board.isFilled(p.x + cx, p.y + cy));
      if (filled.filter(Boolean).length < 3) return 'none';
      const [a, b] = T_FRONT[p.rotation];
      if (filled[a] && filled[b]) return 'full';
      // The last SRS kick (the "TST" kick) always upgrades a mini to a full spin.
      if (this.lastKick === 4 && !this.last180) return 'full';
      return 'mini';
    }
    if (this.rules.allSpin && this.isImmobile()) return 'mini';
    return 'none';
  }

  private isImmobile(): boolean {
    const p = this.piece!;
    return (
      !this.fits(p.type, p.rotation, p.x - 1, p.y) &&
      !this.fits(p.type, p.rotation, p.x + 1, p.y) &&
      !this.fits(p.type, p.rotation, p.x, p.y - 1) &&
      !this.fits(p.type, p.rotation, p.x, p.y + 1)
    );
  }

  private lockPiece(): void {
    const p = this.piece;
    if (!p) return;
    const spin = this.detectSpin();
    const cells = pieceCells(p);
    const masks = linkMasks(cells);
    cells.forEach(([x, y], i) => this.board.set(x, y, PIECE_CODE[p.type], masks[i]));
    this.piece = null;
    this.holdUsed = false;
    this.stats.pieces++;
    this.events.push({ type: 'lock', piece: p.type, cells });

    const rows = this.board.fullRows().map((y) => ({ y, cells: this.board.row(y) }));
    const lines = this.board.clearLines();
    const s = this.stats;
    s.garbageCleared += rows.filter((r) => r.cells.includes(GARBAGE_CODE)).length;
    const streakBefore = s.b2b;
    if (lines > 0) {
      s.lines += lines;
      s.combo++;
      s.b2b = lines === 4 || spin !== 'none' ? s.b2b + 1 : -1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.maxB2b = Math.max(s.maxB2b, s.b2b);
    } else {
      s.combo = -1;
    }
    if (this.rules.levelCurve) {
      const level = levelForLines(this.rules.levelCurve, s.lines);
      if (level > s.level) {
        s.level = level;
        this.events.push({ type: 'levelUp', level });
      }
    }
    if (lines > 0 || spin !== 'none') {
      const info: ClearInfo = {
        piece: p.type,
        lines,
        spin,
        b2b: s.b2b,
        combo: s.combo,
        perfectClear: lines > 0 && this.board.isEmpty(),
      };
      // A clear that crosses into the next level scores at that level.
      const score = clearScore(info, s.level);
      s.score += score;
      this.events.push({ type: 'clear', info, score, rows });
      if (this.rules.attack) this.sendAttack(info, streakBefore);
    }
    if (lines === 0 && this.rules.attack && !this.takeGarbage()) {
      this.piece = null;
      this.state = 'topout';
      this.finishedAt = this.time;
      this.events.push({ type: 'topout' });
      return;
    }
    this.version++;

    if (this.rules.lineGoal !== null && s.lines >= this.rules.lineGoal) return this.finish();
    this.spawnNext();
  }

  /** Turns a clear into attack: cancel incoming garbage first, send the rest. */
  private sendAttack(info: ClearInfo, streakBefore: number): void {
    const rules = this.rules.attack!;
    const segments: number[] = [];
    const main = Math.floor(attackFor(info, rules) * marginMultiplier(this.time, rules));
    if (main > 0) segments.push(main);
    // Breaking a long B2B streak releases its stored surge.
    if (info.b2b === -1 && streakBefore >= rules.surgeStart) segments.push(...surgeFor(streakBefore, rules));
    const total = segments.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    this.stats.attack += total;

    const cancel = Math.min(total, this.pendingGarbage);
    if (cancel > 0) {
      this.events.push({ type: 'cancel', lines: cancel });
      let left = cancel;
      while (left > 0) {
        const g = this.incoming[0];
        const used = Math.min(g.lines, left);
        g.lines -= used;
        left -= used;
        if (g.lines === 0) this.incoming.shift();
      }
    }
    // Cancelling eats segments from the front; whatever survives is sent.
    const out: number[] = [];
    let skip = cancel;
    for (const seg of segments) {
      const keep = Math.max(0, seg - skip);
      skip = Math.max(0, skip - seg);
      if (keep > 0) out.push(keep);
    }
    if (out.length) this.events.push({ type: 'attack', lines: out, time: this.time });
  }

  /** Lets ready garbage rise into the board, up to the cap. False if it pushed blocks off the top. */
  private takeGarbage(): boolean {
    const rules = this.rules.attack!;
    let budget = rules.garbageCap;
    let total = 0;
    let ok = true;
    while (budget > 0 && this.incoming.length > 0 && this.incoming[0].readyAt <= this.time) {
      const g = this.incoming[0];
      if (g.hole === undefined) {
        const change = this.garbageColumn < 0 || this.garbageRng.next() < rules.messiness;
        g.hole = change ? Math.floor(this.garbageRng.next() * BOARD_WIDTH) : this.garbageColumn;
        this.garbageColumn = g.hole;
      }
      const n = Math.min(g.lines, budget);
      ok = this.insertGarbage(n, g.hole) && ok;
      g.lines -= n;
      budget -= n;
      total += n;
      if (g.lines === 0) this.incoming.shift();
    }
    if (total > 0) this.events.push({ type: 'garbageRise', lines: total });
    return ok;
  }

  /** Raises the stack and fills the bottom rows with linked garbage around one hole. */
  private insertGarbage(count: number, hole: number): boolean {
    const ok = this.board.raise(count);
    const cells: Cell[] = [];
    for (let y = 0; y < count; y++) for (let x = 0; x < BOARD_WIDTH; x++) if (x !== hole) cells.push([x, y]);
    const masks = linkMasks(cells);
    cells.forEach(([x, y], i) => this.board.set(x, y, GARBAGE_CODE, masks[i]));
    this.version++;
    return ok;
  }

  private finish(): void {
    this.state = 'finished';
    this.finishedAt = this.time;
    this.events.push({ type: 'finish' });
  }

  private refillQueue(): void {
    while (this.queue.length < Math.max(this.rules.nextCount, 7)) this.queue.push(this.bag.next());
  }

  private spawnNext(): void {
    const type = this.queue.shift()!;
    this.refillQueue();
    this.spawn(type);
  }

  private spawn(type: PieceType): void {
    const { x, y } = spawnPosition(type);
    if (!this.fits(type, 0, x, y)) {
      this.piece = null;
      this.state = 'topout';
      this.finishedAt = this.time;
      this.events.push({ type: 'topout' });
      return;
    }
    this.piece = { type, rotation: 0, x, y };
    this.fall = 0;
    this.lockTimer = 0;
    this.resets = 0;
    this.lowestY = y;
    this.lastRotation = false;
    this.lastKick = -1;
    // DAS carries over between pieces, but waits for the DAS cut delay first.
    if (this.dir !== 0 && this.charged) {
      this.charged = false;
      this.dasStart = this.time + this.handling.dcd - this.handling.das;
    }
    this.version++;
    this.events.push({ type: 'spawn', piece: type });
    this.settle();
  }
}
