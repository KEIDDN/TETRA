import {
  BOARD_WIDTH,
  CODE_PIECE,
  GARBAGE_CODE,
  SHAPES,
  VISIBLE_HEIGHT,
  linkMasks,
  pieceCells,
  type Game,
  type GameEvent,
  type PieceType,
} from '@tetra/engine';
import { Application, Container, Graphics, Sprite, Texture, type Ticker } from 'pixi.js';
import { Lattice, type Echo } from './ambient';
import { easeOut, easeOutBack, Particles, SpritePool, spriteTween, Tweens, type FxLevel } from './fx';
import type { Layout } from './layout';
import { hexToNumber, paintBlock, SKINS, type BlockKind, type GridStyle, type Palette, type Skin } from './skins';

export interface RenderOptions {
  skin: Skin;
  fx: FxLevel;
  smoothFall: boolean;
  ghost: boolean;
  grid: GridStyle;
  /** Reactive ambient light behind the board. */
  ambient: boolean;
}

/** Rows above the visible field that are still drawn (spawn area). */
const OVERFLOW_ROWS = 3;
const ACCENT = 0xedebfa;
const DANGER = 0xff453a;
/** The board's own color (black + 1.8% white); cells are masked with it so the grid never shows through. */
const BOARD_BG = 0x050505;

function canvasTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d')!);
  return Texture.from(canvas);
}

/**
 * Draws the board, pieces and every effect. The world container holds the
 * whole playfield so shakes and bumps move it as one piece.
 */
export class GameRenderer {
  readonly ticker: Ticker;
  private world = new Container();
  private bg = new Graphics();
  private grid = new Graphics();
  private glow = new Graphics();
  private dangerGlow = new Graphics();
  private frame = new Graphics();
  private frameFlash = new Graphics();
  private boardPool: SpritePool;
  private boardMask: SpritePool;
  private pieceMask: SpritePool;
  private ghostPool: SpritePool;
  private piecePool: SpritePool;
  private holdPool: SpritePool;
  private nextPool: SpritePool;
  private holdC = new Container();
  private nextC = new Container();
  private trailLayer = new Container();
  private flashLayer = new Container();
  private particles: Particles;
  private tweens = new Tweens();
  private ambientLayer = new Container();
  private ambientDots = new Container();
  private ambientEchoes = new Container();
  private dotSprites: Sprite[] = [];
  private echoShapes = new Map<Echo, Graphics>();
  private ambient: Lattice | null = null;
  private latticeDrawn = false;

  /** Block textures by kind, link mask and ghost flag, painted on first use. */
  private textures = new Map<string, Texture>();
  private palette: Palette;
  private paletteLevel = 1;
  private shared: { white: Texture; dot: Texture; pip: Texture; square: Texture; trail: Texture } | null = null;
  private layout: Layout | null = null;
  private options: RenderOptions = { skin: SKINS.studio, fx: 'subtle', smoothFall: false, ghost: true, grid: 'lines', ambient: false };
  private drawn: { game: Game | null; version: number } = { game: null, version: -1 };
  private last = 0;

  private shake = { amp: 0, start: 0, duration: 1 };
  private bump = { y: 0, v: 0 };
  private glowLevel = 0;
  private flash = 0;
  private danger = 0;
  private dangerTarget = 0;
  private end: { kind: 'topout' | 'finished'; at: number } | null = null;

  private transparent: boolean;

  static async create(host: HTMLElement, { transparent = false } = {}): Promise<GameRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: '#000000',
      backgroundAlpha: transparent ? 0 : 1,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      preference: 'webgl',
    });
    host.appendChild(app.canvas);
    return new GameRenderer(app, transparent);
  }

  private constructor(
    private app: Application,
    transparent: boolean,
  ) {
    this.transparent = transparent;
    this.ticker = app.ticker;
    const layer = () => new Container();
    const maskLayer = layer();
    const boardLayer = layer();
    const ghostLayer = layer();
    const pieceLayer = layer();
    const particleLayer = layer();
    this.world.addChild(
      this.dangerGlow,
      this.glow,
      this.bg,
      this.grid,
      maskLayer,
      this.frame,
      this.frameFlash,
      ghostLayer,
      boardLayer,
      this.trailLayer,
      pieceLayer,
      this.flashLayer,
      this.holdC,
      this.nextC,
      particleLayer,
    );
    this.ambientLayer.addChild(this.ambientDots, this.ambientEchoes);
    app.stage.addChild(this.ambientLayer, this.world);
    this.boardPool = new SpritePool(boardLayer);
    this.boardMask = new SpritePool(maskLayer);
    this.pieceMask = new SpritePool(maskLayer);
    this.ghostPool = new SpritePool(ghostLayer);
    this.piecePool = new SpritePool(pieceLayer);
    this.holdPool = new SpritePool(this.holdC);
    this.nextPool = new SpritePool(this.nextC);
    this.particles = new Particles(particleLayer);
    this.palette = this.options.skin.palette(1);
  }

  // ── Configuration ─────────────────────────────────────────────

  setOptions(options: RenderOptions): void {
    const skinChanged = options.skin !== this.options.skin;
    this.options = options;
    this.palette = options.skin.palette(this.paletteLevel);
    this.setupAmbient();
    if (this.layout) {
      // Block textures are painted lazily, so a new skin only needs the cache emptied.
      if (skinChanged) this.clearTextures();
      this.drawChrome();
    }
    this.drawn.version = -1;
  }

  setLayout(layout: Layout): void {
    const sizeChanged = layout.cell !== this.layout?.cell;
    this.layout = layout;
    this.app.resize();
    this.layoutAmbient();
    if (sizeChanged) this.buildTextures();
    this.drawChrome();
    const { holdX, sideW, previewCell, boardY, cell } = layout;
    const top = boardY + cell * 0.9;
    this.holdC.pivot.set(holdX + sideW / 2, top + previewCell * 1.5);
    this.holdC.position.copyFrom(this.holdC.pivot);
    this.nextC.position.set(0, 0);
    this.drawn.version = -1;
  }

  /** Clears effects and end-of-game state (on retry). */
  reset(): void {
    this.tweens.clear();
    this.particles.clear();
    this.end = null;
    this.glowLevel = this.flash = this.danger = this.dangerTarget = 0;
    this.bump = { y: 0, v: 0 };
    this.shake.amp = 0;
    this.holdC.scale.set(1);
    this.nextC.position.set(0, 0);
    this.nextC.alpha = 1;
    this.drawn.version = -1;
  }

  destroy(): void {
    for (const t of this.textures.values()) t.destroy(true);
    if (this.shared) for (const t of Object.values(this.shared)) t.destroy(true);
    this.app.destroy({ removeView: true }, { children: true });
  }

  // ── Frame ─────────────────────────────────────────────────────

  draw(game: Game, now: number): void {
    if (!this.layout) return;
    const dt = this.last ? Math.min(50, now - this.last) : 16;
    this.last = now;
    const fx = this.options.fx;

    this.tweens.update(now);
    this.particles.update(dt);
    this.updateDynamics(game, now, dt);
    this.drawAmbient(game, dt);

    const skin = this.options.skin;
    if (skin.leveled && game.stats.level !== this.paletteLevel) {
      this.paletteLevel = game.stats.level;
      this.palette = skin.palette(this.paletteLevel);
      this.setupAmbient();
      this.clearTextures();
      this.drawn.version = -1;
    }

    const ending = this.end !== null && now - this.end.at < 1200;
    if (this.drawn.game !== game || this.drawn.version !== game.version || ending) {
      this.drawn = { game, version: game.version };
      this.drawBoard(game, now);
      this.drawPreviews(game);
    }
    this.drawPiece(game);
    if (skin.breathe) {
      const breath = 0.86 + 0.14 * Math.sin(now / 1100);
      this.boardPool.layer.alpha = breath;
      this.piecePool.layer.alpha = 0.93 + 0.07 * Math.sin(now / 1100);
    } else {
      this.boardPool.layer.alpha = 1;
      this.piecePool.layer.alpha = 1;
    }

    if (fx === 'off') this.world.position.set(0, 0);
  }

  // ── Events ────────────────────────────────────────────────────

  onEvent(e: GameEvent, game: Game, now: number): void {
    const fx = this.options.fx;
    if (fx === 'off' || !this.layout || !this.shared) return;
    const full = fx === 'full';
    const { cell, boardX } = this.layout;
    const skin = this.options.skin;
    const rowY = (y: number) => this.layout!.boardY + (VISIBLE_HEIGHT - 1 - y) * cell;

    switch (e.type) {
      case 'hardDrop': {
        const color = hexToNumber(this.palette[e.piece]);
        if (e.distance > 0) {
          const columns = new Map<number, number>();
          for (const [x, y] of e.cells) columns.set(x, Math.max(columns.get(x) ?? -1, y));
          for (const [x, topY] of columns) {
            const top = rowY(topY + e.distance);
            const bottom = rowY(topY);
            const sprite = new Sprite(this.shared.trail);
            sprite.tint = color;
            // Trails are light, so they always add, whatever the skin blends with.
            sprite.blendMode = 'add';
            const peak = full ? 0.5 : 0.28;
            spriteTween(this.tweens, this.trailLayer, sprite, now, full ? 220 : 160, (s, p) => {
              s.position.set(boardX + x * cell + cell * 0.08, top + (bottom - top) * easeOut(p) * 0.6);
              s.setSize(cell * 0.84, Math.max(0, bottom - top) * (1 - easeOut(p) * 0.6));
              s.alpha = peak * (1 - p);
            });
          }
        }
        this.bump.v += Math.min(e.distance + 2, 14) * cell * (full ? 1.6 : 0.8);
        const lowest = Math.min(...e.cells.map(([, y]) => y));
        const xs = e.cells.map(([x]) => x);
        this.ambient?.ripple(boardX + ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * cell, rowY(lowest) + cell, 0.5 + Math.min(e.distance, 20) * 0.02);
        break;
      }
      case 'lock': {
        const peak = full ? 0.5 : 0.3;
        for (const [x, y] of e.cells) {
          const sprite = new Sprite(this.shared.white);
          sprite.blendMode = skin.fxBlend;
          spriteTween(this.tweens, this.flashLayer, sprite, now, 150, (s, p) => {
            s.position.set(boardX + x * cell, rowY(y));
            s.setSize(cell, cell);
            s.alpha = peak * (1 - easeOut(p));
          });
        }
        break;
      }
      case 'clear': {
        const { info, rows } = e;
        const big = info.lines >= 4 || (info.spin === 'full' && info.lines > 0) || info.perfectClear;
        const power = info.lines + (info.spin === 'full' ? 2 : 0) + (info.b2b > 0 ? 1 : 0) + (info.perfectClear ? 4 : 0);
        const flashColor = hexToNumber(skin.flash);
        const right = boardX + BOARD_WIDTH * cell;
        const sweep = full ? 220 : 170;
        for (const row of rows) {
          const y = rowY(row.y) + cell / 2;
          // The lit row is cut away from left to right, with a bright edge leading the cut.
          const bar = new Sprite(Texture.WHITE);
          bar.anchor.set(1, 0.5);
          bar.tint = flashColor;
          bar.blendMode = skin.fxBlend;
          spriteTween(this.tweens, this.flashLayer, bar, now, sweep, (sp, p) => {
            const e = easeOut(p);
            sp.position.set(right, y);
            sp.setSize(Math.max(0, BOARD_WIDTH * cell * (1 - e)), cell * 0.92);
            sp.alpha = 0.75 * (1 - p * 0.4);
          });
          const edge = new Sprite(Texture.WHITE);
          edge.anchor.set(0.5);
          edge.blendMode = 'add';
          spriteTween(this.tweens, this.flashLayer, edge, now, sweep, (sp, p) => {
            sp.position.set(boardX + BOARD_WIDTH * cell * easeOut(p), y);
            sp.setSize(Math.max(1.5, cell * 0.06), cell * 1.1);
            sp.alpha = 1 - p;
          });
          if (!full) continue;
          // Full: a few mini-minos in the skin's own style float off the cut.
          row.cells.forEach((code, x) => {
            if (Math.random() < 0.35) return;
            const kind: BlockKind = code === GARBAGE_CODE ? 'garbage' : (CODE_PIECE[code] ?? 'garbage');
            this.particles.emit({
              x: boardX + (x + 0.5) * cell,
              y,
              count: 1,
              color: 0xffffff,
              texture: this.texture(kind, 0, false),
              blend: skin.blend,
              speed: cell * (2.5 + power * 0.4),
              lift: cell * 3.2,
              bias: (x - 4.5) / 9,
              life: [0.55, 1.0],
              size: [cell * 0.3, cell * 0.42],
              gravity: cell * 3,
              drag: 1.6,
              spin: 4,
            });
          });
        }
        const cx = boardX + (BOARD_WIDTH * cell) / 2;
        const cy = rowY(rows[0]?.y ?? 0);
        const pieceColor = hexToNumber(this.palette[info.piece]);
        if (big) {
          const kinds = [...new Set(rows.flatMap((r) => r.cells.map((c) => CODE_PIECE[c]).filter((k): k is PieceType => !!k)))];
          this.ambient?.celebrate(cx, cy, power, pieceColor, kinds.length ? kinds : [info.piece], (BOARD_WIDTH * cell) / 2);
        } else this.ambient?.ripple(cx, cy, power, pieceColor);
        if (big) {
          this.flash = 1;
          this.shake = { amp: cell * (full ? 0.14 : 0.07) * (info.perfectClear ? 1.6 : 1), start: now, duration: full ? 320 : 220 };
        }
        if (info.perfectClear) this.celebrate(now);
        break;
      }
      case 'hold':
        this.tweens.add({ start: now, duration: 260, apply: (p) => this.holdC.scale.set(0.8 + 0.2 * easeOutBack(p)) });
        break;
      case 'spawn': {
        const slot = this.layout.previewCell * 3;
        this.tweens.add({
          start: now,
          duration: 160,
          apply: (p) => {
            this.nextC.position.y = slot * 0.3 * (1 - easeOut(p));
            this.nextC.alpha = 0.5 + 0.5 * easeOut(p);
          },
        });
        break;
      }
      case 'levelUp':
        this.flash = Math.max(this.flash, 0.8);
        this.ambient?.ripple(boardX + (BOARD_WIDTH * cell) / 2, this.layout.boardY + this.layout.boardH / 2, 5, ACCENT);
        break;
    }
    void game;
  }

  /** Starts the end-of-game animation: the stack greys out (top out) or dissolves upward (finish). */
  endGame(kind: 'topout' | 'finished', now: number): void {
    this.end = { kind, at: now };
    if (kind === 'finished' && this.options.fx !== 'off') this.celebrate(now);
    if (kind === 'topout' && this.options.fx !== 'off' && this.layout) {
      this.shake = { amp: this.layout.cell * 0.12, start: now, duration: 380 };
    }
  }

  // ── Internals ─────────────────────────────────────────────────

  private celebrate(now: number): void {
    const { boardX, boardY, boardW, boardH, cell } = this.layout!;
    const skin = this.options.skin;
    this.flash = 1;
    const kinds: BlockKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    for (const kind of kinds) {
      this.particles.emit({
        x: boardX + boardW / 2,
        y: boardY + boardH * 0.6,
        w: boardW,
        h: boardH * 0.4,
        count: this.options.fx === 'full' ? 4 : 2,
        color: 0xffffff,
        texture: this.texture(kind, 0, false),
        blend: skin.blend,
        speed: cell * 4,
        lift: cell * 5,
        life: [0.9, 1.6],
        size: [cell * 0.3, cell * 0.45],
        gravity: cell * 3,
        drag: 1.4,
        spin: 3,
      });
    }
    void now;
  }

  private setupAmbient(): void {
    const on = this.options.ambient && this.options.fx !== 'off';
    if (!on) {
      this.ambient = null;
      this.ambientDots.removeChildren().forEach((c) => c.destroy());
      this.ambientEchoes.removeChildren().forEach((c) => c.destroy());
      this.dotSprites = [];
      this.echoShapes.clear();
      return;
    }
    if (!this.ambient) {
      this.ambient = new Lattice(this.options.fx === 'full' ? 1 : 0.75);
      this.layoutAmbient();
    }
    for (const k of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) this.ambient.palette[k] = hexToNumber(this.palette[k]);
  }

  /** The lattice continues the board grid: same spacing, same origin. */
  private layoutAmbient(): void {
    if (!this.ambient || !this.layout) return;
    const { width, height, cell, boardX, boardY, boardW, boardH } = this.layout;
    this.ambient.layout(width, height, cell, boardX, boardY, { x: boardX, y: boardY, w: boardW, h: boardH });
    this.latticeDrawn = false;
  }

  private drawAmbient(game: Game, dt: number): void {
    const lattice = this.ambient;
    if (!lattice || !this.shared || !this.layout) return;
    const { b2b, combo } = game.stats;
    lattice.setEnergy(Math.min(1, Math.max(0, b2b) * 0.15 + Math.max(0, combo) * 0.1));
    lattice.setDanger(this.dangerTarget);
    lattice.update(dt);

    // The lattice is static most of the time; only touch its sprites while it moves.
    if (lattice.active || !this.latticeDrawn) {
      let i = 0;
      lattice.forEachDot((dot) => {
        let sprite = this.dotSprites[i];
        if (!sprite) {
          sprite = new Sprite(this.shared!.pip);
          sprite.anchor.set(0.5);
          this.ambientDots.addChild(sprite);
          this.dotSprites.push(sprite);
        }
        sprite.position.set(dot.x, dot.y);
        sprite.setSize(dot.size * 2.4, dot.size * 2.4);
        sprite.alpha = dot.alpha;
        sprite.tint = dot.color;
        sprite.visible = true;
        i++;
      });
      for (; i < this.dotSprites.length; i++) this.dotSprites[i].visible = false;
      this.latticeDrawn = true;
    }

    const cell = this.layout.cell;
    const alive = new Set(lattice.echoes);
    for (const [echo, g] of this.echoShapes) {
      if (!alive.has(echo)) {
        g.destroy();
        this.echoShapes.delete(echo);
      }
    }
    for (const echo of lattice.echoes) {
      let g = this.echoShapes.get(echo);
      if (!g) {
        g = new Graphics();
        for (const [x0, y0, x1, y1] of Lattice.outline(echo.kind)) g.moveTo(x0 * cell, y0 * cell).lineTo(x1 * cell, y1 * cell);
        g.stroke({ width: 1.5, color: echo.color, alpha: 1 });
        this.ambientEchoes.addChild(g);
        this.echoShapes.set(echo, g);
      }
      g.position.set(echo.x, echo.y);
      g.rotation = echo.rotation;
      g.scale.set(echo.scale);
      g.alpha = lattice.echoAlpha(echo);
    }
  }

  private updateDynamics(game: Game, now: number, dt: number): void {
    const { cell } = this.layout!;
    const s = dt / 1000;
    const on = this.options.fx !== 'off';

    // Hard-drop bump: a damped spring pulling the playfield back to rest.
    const k = 520;
    const c = 26;
    this.bump.v += (-k * this.bump.y - c * this.bump.v) * s;
    this.bump.y = Math.max(-cell * 0.5, Math.min(cell * 0.5, this.bump.y + this.bump.v * s));

    let sx = 0;
    let sy = 0;
    const sp = (now - this.shake.start) / this.shake.duration;
    if (this.shake.amp > 0 && sp < 1) {
      const a = this.shake.amp * (1 - sp) ** 2;
      sx = Math.sin(now * 0.093) * a;
      sy = Math.cos(now * 0.117) * a;
    }
    if (on) this.world.position.set(sx, this.bump.y + sy);

    const { b2b, combo } = game.stats;
    const glowTarget = on ? Math.min(1, Math.max(0, b2b) * 0.16 + Math.max(0, combo) * 0.07) : 0;
    this.glowLevel += (glowTarget - this.glowLevel) * Math.min(1, dt / 220);
    this.flash = Math.max(0, this.flash - dt / 420);
    this.glow.alpha = Math.min(1, this.glowLevel * 0.85 + this.flash * 0.7);
    this.frameFlash.alpha = this.flash * 0.8;

    this.danger += ((on ? this.dangerTarget : 0) - this.danger) * Math.min(1, dt / 300);
    this.dangerGlow.alpha = this.danger * (0.7 + 0.3 * Math.sin(now / 260));
  }

  private rowY(y: number): number {
    return this.layout!.boardY + (VISIBLE_HEIGHT - 1 - y) * this.layout!.cell;
  }

  private texture(kind: BlockKind, mask: number, ghost: boolean): Texture {
    const skin = this.options.skin;
    const m = skin.connected ? mask : 0;
    const g = ghost && !!skin.paintGhost;
    const key = `${kind}:${m}:${g ? 1 : 0}`;
    let texture = this.textures.get(key);
    if (!texture) {
      const px = Math.round(this.layout!.cell * this.app.renderer.resolution);
      texture = Texture.from(paintBlock(skin, px, this.palette[kind], kind, m, g));
      this.textures.set(key, texture);
    }
    return texture;
  }

  private block(pool: SpritePool, kind: BlockKind, x: number, y: number, size: number, mask = 0, alpha = 1, tint = 0xffffff, ghost = false): void {
    const skin = this.options.skin;
    const bleed = skin.bleed * size;
    const a = ghost && !skin.paintGhost ? alpha * skin.ghostAlpha : alpha;
    pool.draw(this.texture(kind, mask, ghost), x - bleed, y - bleed, size + bleed * 2, size + bleed * 2, a, tint, skin.blend);
  }

  private drawBoard(game: Game, now: number): void {
    const { cell, boardX } = this.layout!;
    const board = game.board;
    const pool = this.boardPool;
    const masking = this.masking();
    pool.begin();
    this.boardMask.begin();
    let top = -1;
    const rows = VISIBLE_HEIGHT + OVERFLOW_ROWS;
    for (let y = 0; y < rows; y++) {
      let alpha = 1;
      let tint = 0xffffff;
      let dy = 0;
      if (this.end) {
        const t = now - this.end.at;
        if (this.end.kind === 'topout') {
          const p = easeOut(Math.min(1, Math.max(0, (t - (rows - 1 - y) * 22) / 240)));
          alpha = 1 - p * 0.65;
          tint = p > 0.5 ? 0x8a8a8e : 0xffffff;
        } else {
          const p = easeOut(Math.min(1, Math.max(0, (t - y * 26) / 320)));
          alpha = 1 - p * 0.9;
          dy = -p * cell * 0.5;
        }
      }
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const code = board.get(x, y);
        if (code === 0) continue;
        if (y < VISIBLE_HEIGHT) {
          top = Math.max(top, y);
          if (masking) this.boardMask.draw(Texture.WHITE, boardX + x * cell, this.rowY(y), cell, cell, 1, BOARD_BG);
        }
        const kind: BlockKind = code === GARBAGE_CODE ? 'garbage' : CODE_PIECE[code]!;
        this.block(pool, kind, boardX + x * cell, this.rowY(y) + dy, cell, board.getLinks(x, y), alpha, tint);
      }
    }
    pool.end();
    this.boardMask.end();
    this.dangerTarget = Math.min(1, Math.max(0, (top + 1 - 14) / 5));

    this.ghostPool.begin();
    const piece = game.piece;
    if (piece && this.options.ghost) {
      const ghostY = game.ghostY();
      if (ghostY !== piece.y) {
        const cells = pieceCells({ ...piece, y: ghostY });
        const masks = linkMasks(cells);
        cells.forEach(([x, y], i) => this.block(this.ghostPool, piece.type, boardX + x * cell, this.rowY(y), cell, masks[i], 1, 0xffffff, true));
      }
    }
    this.ghostPool.end();
  }

  private drawPiece(game: Game): void {
    const { cell, boardX } = this.layout!;
    this.piecePool.begin();
    this.pieceMask.begin();
    const piece = game.piece;
    if (piece) {
      const offset = this.options.smoothFall ? game.fallProgress * cell : 0;
      const cells = pieceCells(piece);
      const masks = linkMasks(cells);
      const masking = this.masking();
      cells.forEach(([x, y], i) => {
        const top = this.rowY(y) + offset;
        if (masking && y < VISIBLE_HEIGHT) this.pieceMask.draw(Texture.WHITE, boardX + x * cell, top, cell, cell, 1, BOARD_BG);
        this.block(this.piecePool, piece.type, boardX + x * cell, top, cell, masks[i]);
      });
    }
    this.piecePool.end();
    this.pieceMask.end();
  }

  /** Masking only matters when there's a grid, and needs the opaque board color behind it. */
  private masking(): boolean {
    return this.options.grid !== 'none' && !this.transparent;
  }

  private drawPreviews(game: Game): void {
    const { holdX, nextX, sideW, previewCell, boardY, cell } = this.layout!;
    const slot = previewCell * 3;
    const top = boardY + cell * 0.9;
    this.holdPool.begin();
    if (game.hold) this.drawPreview(this.holdPool, game.hold, holdX + sideW / 2, top + slot / 2, game.holdUsed ? 0.28 : 1);
    this.holdPool.end();
    this.nextPool.begin();
    game.queue.slice(0, game.rules.nextCount).forEach((type, i) => {
      this.drawPreview(this.nextPool, type, nextX + sideW / 2, top + slot / 2 + i * slot, 1);
    });
    this.nextPool.end();
  }

  private drawPreview(pool: SpritePool, type: PieceType, cx: number, cy: number, alpha: number): void {
    const size = this.layout!.previewCell;
    const cells = SHAPES[type][0];
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const left = cx - ((maxX - minX + 1) * size) / 2;
    const top = cy - ((maxY - minY + 1) * size) / 2;
    const masks = linkMasks(cells);
    cells.forEach(([x, y], i) => this.block(pool, type, left + (x - minX) * size, top + (maxY - y) * size, size, masks[i], alpha));
  }

  private clearTextures(): void {
    for (const t of this.textures.values()) t.destroy(true);
    this.textures.clear();
  }

  private buildTextures(): void {
    this.clearTextures();
    // Effects hold the old shared textures; finish them before those are destroyed.
    this.tweens.clear();
    this.particles.clear();
    const px = Math.round(this.layout!.cell * this.app.renderer.resolution);

    const old = this.shared;
    this.shared = {
      white: canvasTexture(px, px, (ctx) => {
        const pad = Math.max(1, Math.round(px * 0.035));
        ctx.beginPath();
        ctx.roundRect(pad, pad, px - pad * 2, px - pad * 2, px * 0.2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }),
      dot: canvasTexture(64, 64, (ctx) => {
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      }),
      pip: canvasTexture(16, 16, (ctx) => {
        ctx.beginPath();
        ctx.arc(8, 8, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }),
      square: canvasTexture(16, 16, (ctx) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(1, 1, 14, 14);
      }),
      trail: canvasTexture(8, 128, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 128);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 8, 128);
      }),
    };
    for (const sprite of this.dotSprites) sprite.texture = this.shared.pip;
    if (old) for (const t of Object.values(old)) t.destroy(true);
  }

  /**
   * Hairlines one physical pixel wide (crisp on retina), or dots at the
   * intersections. Both fade toward the top so the grid sits under the stack.
   */
  private drawGrid(): void {
    const { cell, boardX, boardY } = this.layout!;
    const g = this.grid;
    g.clear();
    const style = this.options.grid;
    if (style === 'none') return;
    const res = this.app.renderer.resolution;
    const hair = 1 / res;
    const snap = (v: number) => Math.round(v * res) / res + hair / 2;
    // Row 0 is the top of the field.
    const fade = (row: number) => 0.35 + 0.65 * (row / VISIBLE_HEIGHT);

    if (style === 'lines') {
      const base = 0.075;
      for (let row = 0; row < VISIBLE_HEIGHT; row++) {
        const alpha = base * fade(row + 0.5);
        const y0 = boardY + row * cell;
        for (let i = 1; i < BOARD_WIDTH; i++) {
          const x = snap(boardX + i * cell);
          g.moveTo(x, y0).lineTo(x, y0 + cell);
        }
        g.stroke({ width: hair, color: 0xffffff, alpha });
        if (row > 0) {
          const y = snap(y0);
          g.moveTo(boardX, y).lineTo(boardX + BOARD_WIDTH * cell, y);
          g.stroke({ width: hair, color: 0xffffff, alpha: base * fade(row) });
        }
      }
    } else {
      const radius = Math.max(0.75, cell * 0.04);
      for (let row = 1; row < VISIBLE_HEIGHT; row++) {
        for (let i = 1; i < BOARD_WIDTH; i++) g.circle(boardX + i * cell, boardY + row * cell, radius);
        g.fill({ color: 0xffffff, alpha: 0.22 * fade(row) });
      }
    }
  }

  private drawChrome(): void {
    const { cell, boardX, boardY, boardW, boardH } = this.layout!;
    const radius = Math.max(6, cell * 0.28);
    const pad = 1.5;

    this.bg.clear();
    this.bg.rect(boardX, boardY, boardW, boardH).fill({ color: 0xffffff, alpha: 0.018 });

    this.drawGrid();

    const outline = (g: Graphics, color: number, alpha: number, width = 1) =>
      g
        .roundRect(boardX - pad, boardY - pad, boardW + pad * 2, boardH + pad * 2, radius)
        .stroke({ width, color, alpha });
    this.frame.clear();
    outline(this.frame, 0xffffff, 0.14);
    this.frameFlash.clear();
    outline(this.frameFlash, ACCENT, 1, 1.5);

    const halo = (g: Graphics, color: number, strength: number) => {
      g.clear();
      for (let i = 1; i <= 12; i++) {
        const o = pad + i * 2;
        g.roundRect(boardX - o, boardY - o, boardW + o * 2, boardH + o * 2, radius + o).stroke({
          width: 2,
          color,
          alpha: strength * (1 - i / 13) ** 2,
        });
      }
    };
    halo(this.glow, ACCENT, 0.16);
    this.glow.alpha = 0;
    halo(this.dangerGlow, DANGER, 0.34);
    this.dangerGlow.rect(boardX, boardY, boardW, boardH).fill({ color: DANGER, alpha: 0.09 });
    this.dangerGlow.alpha = 0;
  }
}
