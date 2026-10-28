import { Match, Rng, type Action } from '@tetra/engine';
import { fieldFrom } from './field';
import { think } from './plan';
import type { BotProfile } from './presets';

/** Keys are pressed and released at the same instant: no DAS, exact moves. */
const INSTANT = { das: 1e9, arr: 1e9, sdf: Infinity, dcd: 0, cancelDasOnDirectionChange: true };

/** Simulated rounds are capped; whoever has sent more by then wins. */
const ROUND_LIMIT = 180_000;

/**
 * Plays one round between two bots as fast as the CPU allows. Time is
 * simulated: each bot places a piece every ~1/PPS seconds (with the same
 * irregular rhythm and mistakes as its live pilot), and its attack lands on
 * the other board exactly as in a real match.
 */
export function simulateRound(a: BotProfile, b: BotProfile, seed: number): 0 | 1 {
  const match = new Match({ seed, handling: [INSTANT, INSTANT] });
  const bots = [a, b];
  const rng = new Rng(seed ^ 0x5bd1e995);
  const next = [0, 0];
  const pace = (bot: BotProfile) => (1000 / bot.pps) * Math.exp((rng.next() - 0.5) * 0.9);
  next[0] = pace(a);
  next[1] = pace(b);

  while (!match.over) {
    const side = next[0] <= next[1] ? 0 : 1;
    const t = next[side];
    if (t > ROUND_LIMIT) break;
    match.update(t);
    if (match.over) break;
    const game = match.games[side];
    const bot = bots[side];
    if (game.piece) {
      const decision = think(
        {
          field: fieldFrom(game.board),
          current: game.piece.type,
          hold: bot.useHold ? game.hold : null,
          queue: bot.useHold ? game.queue.slice(0, 5) : [],
          b2b: game.stats.b2b,
          combo: game.stats.combo,
          incoming: game.pendingGarbage,
          twentyG: false,
        },
        bot.weights,
        { depth: bot.useHold ? Math.min(bot.depth, 2) : 1, beam: Math.min(bot.beam, 6), spins: bot.spins },
      );
      if (decision) {
        let move = { hold: decision.hold, path: decision.placement.path };
        if (rng.next() < bot.mistakes && decision.alternatives.length > 1) {
          const alt = decision.alternatives[1 + Math.floor(rng.next() * Math.min(3, decision.alternatives.length - 1))];
          move = { hold: alt.hold, path: alt.placement.path };
        }
        const path: Action[] = [...(move.hold ? (['hold'] as Action[]) : []), ...move.path];
        if (rng.next() < bot.misdrop) path.splice(path.length - 1, 0, rng.next() < 0.5 ? 'moveLeft' : 'moveRight');
        for (const action of path) {
          match.input(side, action, true, t);
          match.input(side, action, false, t);
        }
      }
    }
    next[side] = t + pace(bot);
    for (const g of match.games) g.events.length = 0;
    match.drained(0);
    match.drained(1);
  }
  if (match.winner !== null) return match.winner;
  const [ga, gb] = match.games;
  return ga.stats.attack >= gb.stats.attack ? 0 : 1;
}

/** A whole first-to-N match. */
export function simulateMatch(a: BotProfile, b: BotProfile, firstTo: number, seed: number): [number, number] {
  const score: [number, number] = [0, 0];
  let round = 0;
  while (score[0] < firstTo && score[1] < firstTo) score[simulateRound(a, b, (seed + round++ * 7919) >>> 0)]++;
  return score;
}
