import { CODE_PIECE, GARBAGE_CODE, SHAPES, VISIBLE_HEIGHT, BOARD_WIDTH, pieceCells, type Game, type PieceType } from '@tetra/engine';
import { Application, Container, Graphics, Sprite, Texture, type Ticker } from 'pixi.js';
import type { Layout } from './layout';
import { DEFAULT_SKIN, type BlockKind, type Skin } from './skin';

/** Rows above the visible field that are still drawn (spawn area). */
const OVERFLOW_ROWS = 3;

/** Reuses sprites between redraws instead of allocating per frame. */
class SpritePool {
  private sprites: Sprite[] = [];
  private used = 0;

  constructor(private parent: Container) {}

  begin(): void {
    this.used = 0;
  }

  draw(texture: Texture, x: number, y: number, size: number, alpha = 1): void {
    let sprite = this.sprites[this.used];
    if (!sprite) {
      sprite = new Sprite();
      this.parent.addChild(sprite);
      this.sprites.push(sprite);
    }
    sprite.texture = texture;
    sprite.position.set(x, y);
    sprite.setSize(size, size);
    sprite.alpha = alpha;
    sprite.visible = true;
    this.used++;
  }

  end(): void {
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i].visible = false;
  }
}

export class GameRenderer {
  readonly ticker: Ticker;
  private chrome = new Graphics();
  private blocks: SpritePool;
  private textures = new Map<BlockKind, Texture>();
  private layout: Layout | null = null;
  private skin: Skin = DEFAULT_SKIN;
  private drawn: { game: Game | null; version: number } = { game: null, version: -1 };

  static async create(host: HTMLElement): Promise<GameRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: '#000000',
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
    const blockLayer = new Container();
    app.stage.addChild(this.chrome, blockLayer);
    this.blocks = new SpritePool(blockLayer);
  }

  setLayout(layout: Layout): void {
    const sizeChanged = layout.cell !== this.layout?.cell;
    this.layout = layout;
    this.app.resize();
    if (sizeChanged) this.buildTextures();
    this.drawChrome();
    this.drawn.version = -1;
  }

  /** Redraws only when the game changed since the last call. */
  draw(game: Game): void {
    if (!this.layout) return;
    if (this.drawn.game === game && this.drawn.version === game.version) return;
    this.drawn = { game, version: game.version };

    const { cell, boardX, boardY } = this.layout;
    const pool = this.blocks;
    pool.begin();

    const rowY = (y: number) => boardY + (VISIBLE_HEIGHT - 1 - y) * cell;
    const board = game.board;
    for (let y = 0; y < VISIBLE_HEIGHT + OVERFLOW_ROWS; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const code = board.get(x, y);
        if (code === 0) continue;
        const kind: BlockKind = code === GARBAGE_CODE ? 'garbage' : CODE_PIECE[code]!;
        pool.draw(this.textures.get(kind)!, boardX + x * cell, rowY(y), cell);
      }
    }

    const piece = game.piece;
    if (piece) {
      const texture = this.textures.get(piece.type)!;
      const ghostY = game.ghostY();
      if (ghostY !== piece.y) {
        for (const [x, y] of pieceCells({ ...piece, y: ghostY })) {
          pool.draw(texture, boardX + x * cell, rowY(y), cell, this.skin.ghostAlpha);
        }
      }
      for (const [x, y] of pieceCells(piece)) pool.draw(texture, boardX + x * cell, rowY(y), cell);
    }

    const { holdX, nextX, sideW, previewCell } = this.layout;
    const slot = previewCell * 3;
    const top = boardY + cell * 0.9;
    if (game.hold) this.drawPreview(game.hold, holdX + sideW / 2, top + slot / 2, game.holdUsed ? 0.28 : 1);
    game.queue.slice(0, game.rules.nextCount).forEach((type, i) => {
      this.drawPreview(type, nextX + sideW / 2, top + slot / 2 + i * slot, 1);
    });

    pool.end();
  }

  destroy(): void {
    for (const texture of this.textures.values()) texture.destroy(true);
    this.app.destroy({ removeView: true }, { children: true });
  }

  private drawPreview(type: PieceType, cx: number, cy: number, alpha: number): void {
    const size = this.layout!.previewCell;
    const cells = SHAPES[type][0];
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const left = cx - ((maxX - minX + 1) * size) / 2;
    const top = cy - ((maxY - minY + 1) * size) / 2;
    const texture = this.textures.get(type)!;
    for (const [x, y] of cells) {
      this.blocks.draw(texture, left + (x - minX) * size, top + (maxY - y) * size, size, alpha);
    }
  }

  private buildTextures(): void {
    for (const texture of this.textures.values()) texture.destroy(true);
    this.textures.clear();
    const px = Math.round(this.layout!.cell * this.app.renderer.resolution);
    for (const [kind, color] of Object.entries(this.skin.colors) as [BlockKind, string][]) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = px;
      this.skin.drawBlock(canvas.getContext('2d')!, px, color);
      this.textures.set(kind, Texture.from(canvas));
    }
  }

  private drawChrome(): void {
    const { cell, boardX, boardY, boardW, boardH } = this.layout!;
    const g = this.chrome;
    g.clear();

    g.rect(boardX, boardY, boardW, boardH).fill({ color: 0xffffff, alpha: 0.018 });
    for (let i = 1; i < 10; i++) g.moveTo(boardX + i * cell + 0.5, boardY).lineTo(boardX + i * cell + 0.5, boardY + boardH);
    for (let i = 1; i < 20; i++) g.moveTo(boardX, boardY + i * cell + 0.5).lineTo(boardX + boardW, boardY + i * cell + 0.5);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.035 });

    const pad = 1.5;
    g.roundRect(boardX - pad, boardY - pad, boardW + pad * 2, boardH + pad * 2, Math.max(6, cell * 0.28)).stroke({
      width: 1,
      color: 0xffffff,
      alpha: 0.14,
    });
  }
}
