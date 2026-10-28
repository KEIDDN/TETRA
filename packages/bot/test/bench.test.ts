import { describe, it } from 'vitest';
import { Game, DEFAULT_ATTACK, type Action } from '@tetra/engine';
import { BALANCED, fieldFrom, think, type Weights } from '../src';

/** Run with BENCH=1: plays a few games per weight set and prints attack per piece. */
const run = process.env.BENCH ? describe : describe.skip;

function play(game: Game, actions: Action[], t: number) {
  for (const a of actions) {
    game.input(a, true, t);
    game.input(a, false, t);
  }
}

function bench(w: Weights, depth = 2, beam = 16, pieces = 250, seeds = [1, 2, 3]) {
  let attack = 0;
  let placed = 0;
  let deaths = 0;
  let b2b = 0;
  for (const seed of seeds) {
    const game = new Game({ seed, handling: { das: 167, arr: 33, sdf: Infinity, dcd: 0 }, rules: { gravity: 0, attack: { ...DEFAULT_ATTACK, marginTime: null } } });
    for (let i = 0; i < pieces && game.state === 'playing'; i++) {
      const d = think(
        { field: fieldFrom(game.board), current: game.piece!.type, hold: game.hold, queue: game.queue.slice(0, 5), b2b: game.stats.b2b, combo: game.stats.combo, incoming: 0, twentyG: false },
        w,
        { depth, beam, spins: true },
      );
      if (!d) break;
      if (d.hold) play(game, ['hold'], i * 100);
      play(game, d.placement.path, i * 100);
      game.events.length = 0;
    }
    attack += game.stats.attack;
    placed += game.stats.pieces;
    b2b = Math.max(b2b, game.stats.maxB2b);
    if (game.state !== 'playing') deaths++;
  }
  return { app: +(attack / placed).toFixed(3), deaths, maxB2b: b2b };
}

run('bench', () => {
  it('weights', () => {
    const top: Weights = { ...BALANCED, well: 3.5, wellColumn: 9, height: -0.2, burn: -9 };
    const sets: [string, Weights, number, number][] = [
      ['top-d3', top, 3, 20],
      ['spin-d3', { ...top, tslot: 8, b2b: 2.5, well: 3 }, 3, 20],
      ['spin-d3-hi', { ...top, tslot: 12, b2b: 3, well: 2.5, attack: 7 }, 3, 20],
    ];
    for (const [name, w, depth, beam] of sets) process.stderr.write(`${name} ${JSON.stringify(bench(w, depth, beam))}\n`);
  }, 600_000);
});
