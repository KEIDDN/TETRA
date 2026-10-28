import { describe, expect, it } from 'vitest';
import { Board, Game, type Action } from '@tetra/engine';
import { BALANCED, fieldFrom, placements, think } from '../src';

function play(game: Game, actions: Action[], t: number) {
  for (const a of actions) {
    game.input(a, true, t);
    game.input(a, false, t);
  }
}

describe('placements', () => {
  it('finds the T-spin double through a kick', () => {
    const board = Board.fromRows(['...#......', '#...######', '##.#######']);
    const moves = placements(fieldFrom(board), 'T');
    const tsd = moves.find((m) => m.spin === 'full' && m.y === 0 && m.rot === 2);
    expect(tsd).toBeDefined();
    // Replaying the path in the real engine gives the same spin.
    const game = new Game({ seed: 1, pieces: ['T', 'O'], handling: { das: 167, arr: 33, sdf: Infinity, dcd: 0 } }, board);
    play(game, tsd!.path, 0);
    expect(game.events.find((e) => e.type === 'clear')).toMatchObject({ info: { spin: 'full', lines: 2 } });
  });

  it('offers every column for an I on an empty board', () => {
    const moves = placements(fieldFrom(new Board()), 'I');
    expect(moves.filter((m) => m.rot === 0 || m.rot === 2).length).toBeGreaterThanOrEqual(7);
    expect(moves.filter((m) => m.rot === 1 || m.rot === 3).length).toBeGreaterThanOrEqual(10);
  });
});

describe('think', () => {
  it('survives and sends attack over a long game', () => {
    const game = new Game({ seed: 7, handling: { das: 167, arr: 33, sdf: Infinity, dcd: 0 }, rules: { gravity: 0 } });
    let t = 0;
    let attackLines = 0;
    for (let i = 0; i < 300 && game.state === 'playing'; i++) {
      const d = think(
        { field: fieldFrom(game.board), current: game.piece!.type, hold: game.hold, queue: game.queue.slice(0, 5), b2b: game.stats.b2b, combo: game.stats.combo, incoming: 0, twentyG: false },
        BALANCED,
        { depth: 2, beam: 20, spins: true },
      );
      expect(d).not.toBeNull();
      t += 100;
      if (d!.hold) play(game, ['hold'], t);
      play(game, d!.placement.path, t);
      for (const e of game.events) if (e.type === 'clear') attackLines += e.info.lines;
      game.events.length = 0;
    }
    console.log('pieces', game.stats.pieces, 'lines', game.stats.lines, 'b2b max', game.stats.maxB2b, 'state', game.state);
    expect(game.state).toBe('playing');
    expect(game.stats.lines).toBeGreaterThan(100);
  }, 60_000);
});
