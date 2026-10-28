import { fieldFrom, type BotProfile } from '@tetra/bot';
import type { Action, ActivePiece, Match } from '@tetra/engine';
import type { ThinkMove, ThinkRequest, ThinkResponse } from './bot.worker';

interface Step {
  at: number;
  action: Action;
  pressed: boolean;
}

/** Bots press keys instantly when told to; DAS never kicks in because taps are released right away. */
export const BOT_HANDLING = { das: 60_000, arr: 60_000, sdf: Infinity, dcd: 0, cancelDasOnDirectionChange: true };

const DANGER_HEIGHT = 12;

/**
 * Drives one side of a match like a person would: thinks for an irregular
 * while, presses keys one by one (so the piece visibly travels), notices
 * garbage late, and sometimes plays a worse move or lands a column off,
 * more so when its stack is high.
 */
export class BotPilot {
  private worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  private requestId = 0;
  private waitingFor: number | null = null;
  private planned: ActivePiece | null = null;
  private requestedAt = 0;
  private steps: Step[] = [];
  private nowRef = 0;

  constructor(
    private profile: BotProfile,
    private match: Match,
    private player: 0 | 1,
  ) {
    this.worker.onmessage = (e: MessageEvent<ThinkResponse>) => this.onThought(e.data);
  }

  dispose(): void {
    this.worker.terminate();
  }

  /** Swaps in the next round's match. */
  setMatch(match: Match): void {
    this.match = match;
    this.steps = [];
    this.planned = null;
    this.waitingFor = null;
  }

  update(t: number): void {
    this.nowRef = t;
    const game = this.match.games[this.player];
    if (game.state !== 'playing' || this.match.over) return;
    if (game.piece && game.piece !== this.planned && this.waitingFor === null && this.steps.length === 0) this.request(t);
    while (this.steps.length && this.steps[0].at <= t && !this.match.over) {
      const { at, action, pressed } = this.steps.shift()!;
      this.match.input(this.player, action, pressed, at);
    }
  }

  private request(t: number): void {
    const game = this.match.games[this.player];
    const p = this.profile;
    this.planned = game.piece;
    this.requestedAt = t;
    // Garbage it hasn't "seen" yet doesn't count.
    const delay = game.rules.attack?.garbageDelay ?? 0;
    const incoming = game.incoming.filter((g) => g.readyAt - delay <= t - p.reaction).reduce((n, g) => n + g.lines, 0);
    const request: ThinkRequest = {
      id: ++this.requestId,
      state: {
        field: Array.from(fieldFrom(game.board)),
        current: game.piece!.type,
        hold: p.useHold ? game.hold : null,
        queue: p.useHold ? game.queue.slice(0, 5) : [],
        b2b: game.stats.b2b,
        combo: game.stats.combo,
        incoming,
        twentyG: false,
      },
      weights: p.weights,
      depth: p.useHold ? p.depth : 1,
      beam: p.beam,
      spins: p.spins,
    };
    this.waitingFor = request.id;
    this.worker.postMessage(request);
  }

  private onThought(response: ThinkResponse): void {
    if (response.id !== this.waitingFor) return;
    this.waitingFor = null;
    const game = this.match.games[this.player];
    if (game.piece !== this.planned || response.moves.length === 0) return;
    const p = this.profile;
    const height = maxHeight(game);
    const nerves = 1 + (height > DANGER_HEIGHT ? p.panic * 4 : 0);

    let move = response.moves[0];
    if (Math.random() < p.mistakes * nerves && response.moves.length > 1) {
      move = response.moves[1 + Math.floor(Math.random() * Math.min(3, response.moves.length - 1))];
    }
    const path = this.withMisdrop(move, p.misdrop * nerves);

    // Pace: aim for the target PPS on average, but never like a metronome.
    const interval = 1000 / p.pps;
    const execution = path.length * p.tap;
    const rhythm = Math.exp((Math.random() - 0.5) * 0.9) * (height > DANGER_HEIGHT ? 0.75 : 1);
    let at = Math.max(this.nowRef, this.requestedAt + Math.max(40, interval * rhythm - execution));
    this.steps = [];
    for (const action of path) {
      at += p.tap * (0.7 + Math.random() * 0.6);
      this.steps.push({ at, action, pressed: true });
      this.steps.push({ at: at + (action === 'softDrop' ? 25 : 1), action, pressed: false });
      if (action === 'softDrop') at += 25;
    }
  }

  private withMisdrop(move: ThinkMove, chance: number): Action[] {
    const path: Action[] = [...(move.hold ? (['hold'] as Action[]) : []), ...move.path];
    if (Math.random() >= chance) return path;
    path.splice(path.length - 1, 0, Math.random() < 0.5 ? 'moveLeft' : 'moveRight');
    return path;
  }
}

function maxHeight(game: Match['games'][number]): number {
  for (let y = 39; y >= 0; y--) if (game.board.row(y).some((c) => c !== 0)) return y + 1;
  return 0;
}
