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
import { easeOut, easeOutBack, Particles, SpritePool, spriteTween, Tweens, type FxLevel } from './fx';
import type { Layout } from './layout';
import { hexToNumber, paintBlock, SKINS, type BlockKind, type Palette, type Skin } from './skins';

export interface RenderOptions {
  skin: Skin;
  fx: FxLevel;
  smoothFall: boolean;
  ghost: boolean;
  grid: boolean;
}

/** Rows above the visible field that are still drawn (spawn area). */
const OVERFLOW_ROWS = 3;
const ACCENT = 0xedebfa;
const DANGER = 0xff453a;

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

  /** Block textures by kind, link mask and ghost flag, painted on first use. */
  private textures = new Map<string, Texture>();
  private palette: Palette;
  private paletteLevel = 1;
  private shared: { white: Texture; dot: Texture; square: Texture; trail: Texture } | null = null;
  private layout: Layout | null = null;
  private options: RenderOptions = { skin: SKINS.studio, fx: 'subtle', smoothFall: false, ghost: true, grid: true };
  private drawn: { game: Game | null; version: number } = { game: null, version: -1 };
  private last = 0;

  private shake = { amp: 0, start: 0, duration: 1 };
  private bump = { y: 0, v: 0 };
  private glowLevel = 0;
  private flash = 0;
  private danger = 0;
  private dangerTarget = 0;
  private end: { kind: 'topout' | 'finished'; at: number } | null = null;

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
    return new GameRenderer(app);
  }

  private constructor(private app: Application) {
    this.ticker = app.ticker;
    const layer = () => new Container();
    const boardLayer = layer();
    const ghostLayer = layer();
    const pieceLayer = layer();
    const particleLayer = layer();
    this.world.addChild(
      this.dangerGlow,
      this.glow,
      this.bg,
      this.grid,
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
    app.stage.addChild(this.world);
    this.boardPool = new SpritePool(boardLayer);
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
    if (this.layout) {
      if (skinChanged) this.buildTextures();
      this.drawChrome();
    }
    this.drawn.version = -1;
  }

  setLayout(layout: Layout): void {
    const sizeChanged = layout.cell !== this.layout?.cell;
    this.layout = layout;
    this.app.resize();
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

    const skin = this.options.skin;
    if (skin.leveled && game.stats.level !== this.paletteLevel) {
      this.paletteLevel = game.stats.level;
      this.palette = skin.palette(this.paletteLevel);
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
        if (full) {
          const bottoms = e.cells.filter(([x, y]) => !e.cells.some(([x2, y2]) => x2 === x && y2 === y - 1));
          for (const [x, y] of bottoms) {
            this.particles.emit({
              x: boardX + (x + 0.5) * cell,
              y: rowY(y) + cell,
              w: cell,
              count: 2,
              color: 0xffffff,
              texture: this.shared.dot,
              blend: 'add',
              speed: cell * 3,
              lift: cell * 2,
              life: [0.2, 0.4],
              size: [cell * 0.12, cell * 0.22],
              gravity: cell * 12,
            });
          }
        }
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
        for (const row of rows) {
          const y = rowY(row.y) + cell / 2;
          const sprite = new Sprite(Texture.WHITE);
          sprite.anchor.set(0.5);
          sprite.tint = flashColor;
          sprite.blendMode = skin.fxBlend;
          spriteTween(this.tweens, this.flashLayer, sprite, now, full ? 320 : 220, (s, p) => {
            s.position.set(boardX + (BOARD_WIDTH * cell) / 2, y);
            s.setSize(BOARD_WIDTH * cell * (1 + p * 0.04), cell * (1 - easeOut(p) * 0.85));
            s.alpha = (full ? 0.9 : 0.6) * (1 - p);
          });
          const perCell = full ? 2 + Math.min(power, 6) * 0.5 : 1;
          row.cells.forEach((code, x) => {
            const kind: BlockKind = code === GARBAGE_CODE ? 'garbage' : (CODE_PIECE[code] ?? 'garbage');
            const cx = boardX + (x + 0.5) * cell;
            this.particles.emit({
              x: cx,
              y,
              w: cell,
              h: cell,
              count: Math.round(perCell + Math.random()),
              color: hexToNumber(this.palette[kind]),
              texture: skin.particle === 'square' ? this.shared!.square : this.shared!.dot,
              blend: skin.fxBlend,
              speed: cell * (full ? 7 + power : 4),
              lift: cell * (full ? 5 : 2.5),
              bias: (x - 4.5) / 4.5,
              life: full ? [0.45, 1.0] : [0.3, 0.6],
              size: skin.particle === 'square' ? [cell * 0.14, cell * 0.3] : [cell * 0.25, cell * 0.5],
              gravity: cell * 9,
              drag: 2.2,
              spin: skin.particle === 'square' ? 12 : 0,
            });
          });
        }
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
        y: boardY + boardH * 0.55,
        w: boardW,
        h: boardH * 0.5,
        count: this.options.fx === 'full' ? 14 : 6,
        color: hexToNumber(this.palette[kind]),
        texture: skin.particle === 'square' ? this.shared!.square : this.shared!.dot,
        blend: skin.fxBlend,
        speed: cell * 6,
        lift: cell * 8,
        life: [0.8, 1.6],
        size: [cell * 0.2, cell * 0.45],
        gravity: cell * 6,
        drag: 1.6,
        spin: 8,
      });
    }
    void now;
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
    pool.begin();
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
        if (y < VISIBLE_HEIGHT) top = Math.max(top, y);
        const kind: BlockKind = code === GARBAGE_CODE ? 'garbage' : CODE_PIECE[code]!;
        this.block(pool, kind, boardX + x * cell, this.rowY(y) + dy, cell, board.getLinks(x, y), alpha, tint);
      }
    }
    pool.end();
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
    const piece = game.piece;
    if (piece) {
      const offset = this.options.smoothFall ? game.fallProgress * cell : 0;
      const cells = pieceCells(piece);
      const masks = linkMasks(cells);
      cells.forEach(([x, y], i) => this.block(this.piecePool, piece.type, boardX + x * cell, this.rowY(y) + offset, cell, masks[i]));
    }
    this.piecePool.end();
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
    const px = Math.round(this.layout!.cell * this.app.renderer.resolution);

    if (this.shared) for (const t of Object.values(this.shared)) t.destroy(true);
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
  }

  private drawChrome(): void {
    const { cell, boardX, boardY, boardW, boardH } = this.layout!;
    const radius = Math.max(6, cell * 0.28);
    const pad = 1.5;

    this.bg.clear();
    this.bg.rect(boardX, boardY, boardW, boardH).fill({ color: 0xffffff, alpha: 0.018 });

    this.grid.clear();
    if (this.options.grid && this.options.skin.grid) {
      for (let i = 1; i < 10; i++) this.grid.moveTo(boardX + i * cell + 0.5, boardY).lineTo(boardX + i * cell + 0.5, boardY + boardH);
      for (let i = 1; i < 20; i++) this.grid.moveTo(boardX, boardY + i * cell + 0.5).lineTo(boardX + boardW, boardY + i * cell + 0.5);
      this.grid.stroke({ width: 1, color: 0xffffff, alpha: 0.035 });
    }

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
