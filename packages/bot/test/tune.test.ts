import { it } from 'vitest';
import { Game, DEFAULT_ATTACK, type Action } from '@tetra/engine';
import { BALANCED, fieldFrom, think, type Weights } from '../src';

/** TUNE=1: random local search over the evaluation weights, scored by attack per piece. */
const run = process.env.TUNE ? it : it.skip;

function score(w: Weights, seeds: number[], pieces = 200) {
  let attack = 0;
  let placed = 0;
  let deaths = 0;
  for (const seed of seeds) {
    const game = new Game({ seed, handling: { das: 167, arr: 33, sdf: Infinity, dcd: 0 }, rules: { gravity: 0, attack: { ...DEFAULT_ATTACK, marginTime: null } } });
    for (let i = 0; i < pieces && game.state === 'playing'; i++) {
      const d = think({ field: fieldFrom(game.board), current: game.piece!.type, hold: game.hold, queue: game.queue.slice(0, 5), b2b: game.stats.b2b, combo: game.stats.combo, incoming: 0, twentyG: false }, w, { depth: 2, beam: 12, spins: true });
      if (!d) break;
      for (const a of [...(d.hold ? (['hold'] as Action[]) : []), ...d.placement.path]) {
        game.input(a, true, i * 100);
        game.input(a, false, i * 100);
      }
      game.events.length = 0;
    }
    attack += game.stats.attack;
    placed += game.stats.pieces;
    if (game.state !== 'playing') deaths++;
  }
  return attack / Math.max(1, placed) - deaths * 0.3;
}

const KEYS: (keyof Weights)[] = ['height', 'danger', 'holes', 'covered', 'bumpiness', 'bumpinessSq', 'rowTransitions', 'well', 'tslot', 'attack', 'wastedClear', 'burn', 'b2b', 'b2bBreak'];

run('tune', () => {
  let best: Weights = { ...BALANCED, well: 3.5, wellColumn: 9, height: -0.2, burn: -9 };
  const train = [11, 12, 13];
  let bestScore = score(best, train);
  process.stderr.write(`start ${bestScore.toFixed(3)}\n`);
  for (let round = 0; round < 45; round++) {
    const candidate = { ...best };
    for (const k of KEYS) if (Math.random() < 0.35) (candidate[k] as number) *= 0.6 + Math.random() * 0.8;
    const s = score(candidate, train);
    if (s > bestScore) {
      best = candidate;
      bestScore = s;
      process.stderr.write(`round ${round} ${s.toFixed(3)} ${JSON.stringify(best)}\n`);
    }
  }
  process.stderr.write(`validation ${score(best, [21, 22, 23, 24], 250).toFixed(3)}\nFINAL ${JSON.stringify(best)}\n`);
}, 3_600_000);
