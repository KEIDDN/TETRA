import { describe, expect, it } from 'vitest';
import { Bag, Board, Game, getKicks, LINK_DOWN, LINK_DOWN_LEFT, LINK_DOWN_RIGHT, LINK_LEFT, LINK_RIGHT, LINK_UP, LINK_UP_RIGHT, pieceCells, PIECE_TYPES, SHAPES, type Action, type GameOptions } from '../src';

const instant = { das: 167, arr: 33, sdf: Infinity, dcd: 0 };

function game(opts: Partial<GameOptions> = {}, board?: Board) {
  return new Game({ seed: 1, handling: instant, ...opts }, board);
}

function tap(g: Game, action: Action, t = g.time) {
  g.input(action, true, t);
  g.input(action, false, t);
}

describe('pieces', () => {
  it('rotates T clockwise with the nub pointing right', () => {
    expect(new Set(SHAPES.T[1].map(String))).toEqual(new Set(['1,0', '1,1', '1,2', '2,1']));
  });

  it('puts the vertical I in the third column of its box', () => {
    expect(SHAPES.I[1].every(([x]) => x === 2)).toBe(true);
  });

  it('spawns 3-wide pieces in columns 3-5, just above the visible field', () => {
    const g = game({ pieces: ['T'] });
    const cells = pieceCells(g.piece!);
    expect(Math.min(...cells.map(([x]) => x))).toBe(3);
    expect(Math.min(...cells.map(([, y]) => y))).toBe(20);
  });
});

describe('kicks', () => {
  it('uses mirror-symmetric SRS+ kicks for I', () => {
    const mirror = (k: readonly (readonly [number, number])[]) => k.map(([x, y]) => [x === 0 ? 0 : -x, y]);
    expect(mirror(getKicks('I', 0, 1))).toEqual(getKicks('I', 0, 3));
    expect(mirror(getKicks('I', 2, 1))).toEqual(getKicks('I', 2, 3));
    expect(mirror(getKicks('I', 1, 0))).toEqual(getKicks('I', 3, 0));
    expect(mirror(getKicks('I', 1, 2))).toEqual(getKicks('I', 3, 2));
  });

  it('has 6 tests for 180 rotations and none for O', () => {
    expect(getKicks('T', 0, 2)).toHaveLength(6);
    expect(getKicks('O', 0, 1)).toEqual([[0, 0]]);
  });
});

describe('randomizer', () => {
  it('deals every piece exactly once per bag', () => {
    const bag = new Bag(42);
    for (let b = 0; b < 20; b++) {
      const seen = Array.from({ length: 7 }, () => bag.next());
      expect(new Set(seen)).toEqual(new Set(PIECE_TYPES));
    }
  });

  it('is deterministic per seed', () => {
    const a = new Bag(7), b = new Bag(7);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });
});

describe('handling', () => {
  it('moves once on tap', () => {
    const g = game({ pieces: ['T'] });
    tap(g, 'moveLeft', 0);
    expect(g.piece!.x).toBe(2);
  });

  it('auto-repeats after DAS at the ARR rate', () => {
    const g = game({ pieces: ['T'] });
    g.input('moveRight', true, 0);
    g.update(166);
    expect(g.piece!.x).toBe(4);
    g.update(167);
    expect(g.piece!.x).toBe(5);
    g.update(199);
    expect(g.piece!.x).toBe(5);
    g.update(200);
    expect(g.piece!.x).toBe(6);
    g.update(1000);
    expect(g.piece!.x).toBe(7); // against the wall
  });

  it('shifts straight to the wall with ARR 0', () => {
    const g = game({ pieces: ['T'], handling: { ...instant, arr: 0 } });
    g.input('moveLeft', true, 0);
    g.update(167);
    expect(g.piece!.x).toBe(0);
  });

  it('carries a charged DAS into the next piece after the cut delay', () => {
    const g = game({ pieces: ['T', 'T'], handling: { ...instant, arr: 0, dcd: 17 } });
    g.input('moveLeft', true, 0);
    g.update(200);
    tap(g, 'hardDrop', 200);
    expect(g.piece!.x).toBe(3);
    g.update(216);
    expect(g.piece!.x).toBe(3);
    g.update(217);
    expect(g.piece!.x).toBe(0);
  });

  it('accepts DAS charged before the game started', () => {
    const g = game({ pieces: ['T'], handling: { ...instant, arr: 0 } });
    g.input('moveLeft', true, 0, -500);
    expect(g.piece!.x).toBe(0);
  });

  it('gives the newest direction priority and returns to the held one on release', () => {
    const g = game({ pieces: ['T'] });
    g.input('moveLeft', true, 0);
    g.input('moveRight', true, 10);
    expect(g.piece!.x).toBe(3);
    g.input('moveRight', false, 20);
    g.update(20 + 167);
    expect(g.piece!.x).toBe(2);
  });

  it('drops instantly with an infinite soft drop factor', () => {
    const g = game({ pieces: ['T'] });
    g.input('softDrop', true, 0);
    expect(Math.min(...pieceCells(g.piece!).map(([, y]) => y))).toBe(0);
  });
});

describe('gravity and locking', () => {
  it('falls at the configured gravity', () => {
    const g = game({ pieces: ['T'], rules: { gravity: 1 } });
    g.update(250);
    expect(g.piece!.y).toBe(19 - 15);
  });

  it('locks after the lock delay on the ground', () => {
    const g = game({ pieces: ['T', 'O'] });
    g.input('softDrop', true, 0);
    g.update(499);
    expect(g.piece!.type).toBe('T');
    g.update(500);
    expect(g.piece!.type).toBe('O');
    expect(g.stats.pieces).toBe(1);
  });

  it('refreshes the lock delay on movement, up to 15 times', () => {
    const g = game({ pieces: ['T', 'O'] });
    g.input('softDrop', true, 0);
    let t = 0;
    for (let i = 0; i < 14; i++) {
      t += 400;
      tap(g, i % 2 ? 'moveLeft' : 'moveRight', t);
    }
    expect(g.piece!.type).toBe('T');
    t += 400;
    tap(g, 'moveRight', t); // 15th reset exhausts the limit: locks on the ground
    expect(g.piece!.type).toBe('O');
  });

  it('hard drops and clears lines', () => {
    const board = Board.fromRows(['#########.', '#########.', '#########.', '#########.']);
    const g = game({ pieces: ['I', 'O'] }, board);
    tap(g, 'rotateCW', 0);
    g.input('moveRight', true, 0);
    g.update(1000);
    tap(g, 'hardDrop', 1000);
    expect(g.stats.lines).toBe(4);
    expect(board.isEmpty()).toBe(true);
    const clear = g.events.find((e) => e.type === 'clear');
    expect(clear).toMatchObject({ info: { lines: 4, perfectClear: true, b2b: 0 } });
    expect(clear?.type === 'clear' && clear.rows.map((r) => r.y)).toEqual([0, 1, 2, 3]);
    expect(clear?.type === 'clear' && clear.rows[0].cells.every((c) => c !== 0)).toBe(true);
  });
});

describe('spins', () => {
  const tsdBoard = () => Board.fromRows(['...#......', '#...######', '##.#######']);

  it('detects a T-spin double', () => {
    const board = tsdBoard();
    const g = game({ pieces: ['T', 'O'] }, board);
    tap(g, 'rotateCCW', 0);
    tap(g, 'moveLeft', 0);
    tap(g, 'moveLeft', 0);
    tap(g, 'softDrop', 0);
    tap(g, 'rotateCCW', 0);
    tap(g, 'hardDrop', 0);
    const clear = g.events.find((e) => e.type === 'clear');
    expect(clear).toMatchObject({ info: { lines: 2, spin: 'full', piece: 'T' } });
  });

  it('does not count a spin if the piece moved after rotating', () => {
    const board = tsdBoard();
    const g = game({ pieces: ['T', 'O'] }, board);
    tap(g, 'rotateCCW', 0);
    tap(g, 'moveLeft', 0);
    tap(g, 'moveLeft', 0);
    tap(g, 'softDrop', 0);
    tap(g, 'rotateCCW', 0);
    tap(g, 'rotateCW', 0);
    tap(g, 'rotateCCW', 0);
    // last action is still a rotation
    tap(g, 'hardDrop', 0);
    expect(g.events.find((e) => e.type === 'clear')).toMatchObject({ info: { spin: 'full' } });

    const g2 = game({ pieces: ['T', 'O'] }, Board.fromRows(['#...######', '##.#######']));
    tap(g2, 'softDrop', 0);
    tap(g2, 'moveLeft', 0);
    tap(g2, 'hardDrop', 0);
    expect(g2.events.find((e) => e.type === 'clear' && e.info.spin !== 'none')).toBeUndefined();
  });

  it('rotates 180 degrees', () => {
    const g = game({ pieces: ['T'] });
    tap(g, 'rotate180', 0);
    expect(g.piece!.rotation).toBe(2);
  });
});

describe('links', () => {
  it('connects the cells of a locked piece', () => {
    const g = game({ pieces: ['T', 'O'] });
    tap(g, 'hardDrop', 0);
    // T at rest: row 0 = x 3..5, nub at (4,1)
    expect(g.board.getLinks(3, 0)).toBe(LINK_RIGHT | LINK_UP_RIGHT);
    expect(g.board.getLinks(4, 0)).toBe(LINK_LEFT | LINK_RIGHT | LINK_UP);
    expect(g.board.getLinks(4, 1)).toBe(LINK_DOWN | LINK_DOWN_LEFT | LINK_DOWN_RIGHT);
  });

  it('cuts links across cleared rows', () => {
    const board = Board.fromRows(['#########.']);
    const g = game({ pieces: ['J', 'O'] }, board);
    // J flat with its nub hanging into the gap: rotate 180 so the corner points down-right
    tap(g, 'rotate180', 0);
    g.input('moveRight', true, 0);
    g.update(1000);
    tap(g, 'hardDrop', 1000);
    expect(g.stats.lines).toBe(1);
    for (let x = 7; x < 10; x++) expect(g.board.getLinks(x, 0) & LINK_DOWN).toBe(0);
    expect(g.board.getLinks(9, 0)).toBe(LINK_LEFT);
  });
});

describe('hold', () => {
  it('holds once per piece', () => {
    const g = game({ pieces: ['T', 'O', 'I'] });
    tap(g, 'hold', 0);
    expect(g.hold).toBe('T');
    expect(g.piece!.type).toBe('O');
    tap(g, 'hold', 0);
    expect(g.piece!.type).toBe('O');
    tap(g, 'hardDrop', 0);
    tap(g, 'hold', 0);
    expect(g.piece!.type).toBe('T');
    expect(g.hold).toBe('I');
  });
});

describe('game end', () => {
  it('finishes when the line goal is reached', () => {
    const board = Board.fromRows(['#########.']);
    const g = game({ pieces: ['I'], rules: { lineGoal: 1 } }, board);
    tap(g, 'rotateCW', 0);
    g.input('moveRight', true, 0);
    g.update(500);
    tap(g, 'hardDrop', 500);
    expect(g.state).toBe('finished');
    expect(g.elapsed).toBe(500);
  });

  it('tops out when the spawn area is blocked', () => {
    const rows = Array.from({ length: 22 }, (_, i) => (i % 2 ? '####.#####' : '#####.####'));
    const g = game({}, Board.fromRows(rows));
    expect(g.state).toBe('topout');
  });

  it('replays identically from the same seed and inputs', () => {
    const script: [Action, boolean, number][] = [];
    const actions: Action[] = ['moveLeft', 'moveRight', 'rotateCW', 'rotateCCW', 'hardDrop', 'hold', 'rotate180'];
    let t = 0;
    for (let i = 0; i < 300; i++) {
      t += 37 + ((i * 53) % 97);
      const a = actions[(i * 7) % actions.length];
      script.push([a, true, t], [a, false, t + 20]);
    }
    const run = () => {
      const g = new Game({ seed: 99, handling: { das: 120, arr: 0, sdf: 20, dcd: 17 } });
      for (const [a, p, tt] of script) g.input(a, p, tt);
      return [Array.from(g.board.cells).join(''), g.stats.pieces, g.state].join('|');
    };
    expect(run()).toBe(run());
  });
});
