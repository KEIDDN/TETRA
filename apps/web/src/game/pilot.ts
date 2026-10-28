import { fieldFrom, type BotProfile } from '@tetra/bot';
import type { Action, ActivePiece, Game } from '@tetra/engine';
import type { ThinkMove, ThinkRequest, ThinkResponse } from './bot.worker';

/** What a pilot drives: a versus match, or a single board (bot previews). */
export interface Pilotable {
  games: Game[];
  readonly over: boolean;
  input(player: 0 | 1, action: Action, pressed: boolean, t: number): void;
}

/** A lone board as something a pilot can drive. */
export function solo(game: Game): Pilotable {
  return { games: [game], over: false, input: (_p, action, pressed, t) => game.input(action, pressed, t) };
}

interface Step {
  at: number;
  action: Action;
  pressed: boolean;
}

/** A bot's own handling: short taps move one cell, held keys use its DAS and ARR. */
export function botHandling(p: BotProfile) {
  return { das: p.das, arr: p.arr, sdf: Infinity, dcd: 17, cancelDasOnDirectionChange: true };
}

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
    private match: Pilotable,
    private player: 0 | 1,
  ) {
    this.worker.onmessage = (e: MessageEvent<ThinkResponse>) => this.onThought(e.data);
  }

  dispose(): void {
    this.worker.terminate();
  }

  /** Swaps in the next round's match. */
  setMatch(match: Pilotable): void {
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

    // Pace: aim for the target PPS on average, but never like a metronome. The script's own
    // length (hesitations, soft drops, corrections included) comes out of the thinking time,
    // so a slow-handed bot still keeps its speed instead of falling behind it.
    const interval = 1000 / p.pps;
    const steps = this.script(path, 0, nerves);
    const execution = steps.length ? steps[steps.length - 1].at : 0;
    const rhythm = Math.exp((Math.random() - 0.5) * 0.9) * (height > DANGER_HEIGHT ? 0.75 : 1);
    const start = Math.max(this.nowRef, this.requestedAt + Math.max(40, interval * rhythm - execution));
    this.steps = steps.map((step) => ({ ...step, at: step.at + start }));
  }

  /**
   * Turns a path into timed key presses the way a person would play it:
   * long slides on DAS (sometimes a column too far, then corrected), the
   * odd rotation the long way round, a hesitation, a soft drop instead of
   * a hard drop.
   */
  private script(path: Action[], start: number, nerves: number): Step[] {
    const p = this.profile;
    const steps: Step[] = [];
    let at = start;
    const tap = () => p.tap * (0.75 + Math.random() * 0.5);
    const press = (action: Action, hold = 1) => {
      steps.push({ at, action, pressed: true });
      steps.push({ at: at + hold, action, pressed: false });
    };
    const opposite: Partial<Record<Action, Action>> = { rotateCW: 'rotateCCW', rotateCCW: 'rotateCW', moveLeft: 'moveRight', moveRight: 'moveLeft' };

    for (let i = 0; i < path.length; ) {
      const action = path[i];
      let run = 1;
      while (path[i + run] === action) run++;
      if (Math.random() < (p.hesitation * nerves) / 3) at += 120 + Math.random() * 330;
      at += tap();

      if ((action === 'moveLeft' || action === 'moveRight') && run >= 3 && p.arr >= 20) {
        // Hold the key: one move on press, one at DAS, then one every ARR.
        let hold = p.das + (run - 2) * p.arr + Math.min(8, p.arr / 3);
        const overshoot = Math.random() < p.overshoot * nerves;
        if (overshoot) hold += p.arr;
        press(action, hold);
        at += hold;
        if (overshoot) {
          at += 110 + Math.random() * 120;
          press(opposite[action]!);
        }
      } else if ((action === 'rotateCW' || action === 'rotateCCW') && run === 1 && !path.slice(0, i).includes('softDrop') && Math.random() < p.fumble) {
        // Three turns the other way: same result in open air, very human.
        for (let k = 0; k < 3; k++) {
          press(opposite[action]!);
          at += tap() * 0.8;
        }
      } else if (action === 'hardDrop' && Math.random() < p.softDrops) {
        press('softDrop', 140 + Math.random() * 160);
        at += 320 + Math.random() * 120;
        press('hardDrop');
      } else {
        for (let k = 0; k < run; k++) {
          press(action, action === 'softDrop' ? 25 : 1);
          if (k < run - 1) at += tap() * 0.85;
        }
        if (action === 'softDrop') at += 25;
      }
      i += run;
    }
    return steps;
  }

  private withMisdrop(move: ThinkMove, chance: number): Action[] {
    const path: Action[] = [...(move.hold ? (['hold'] as Action[]) : []), ...move.path];
    if (Math.random() >= chance) return path;
    path.splice(path.length - 1, 0, Math.random() < 0.5 ? 'moveLeft' : 'moveRight');
    return path;
  }
}

function maxHeight(game: Game): number {
  for (let y = 39; y >= 0; y--) if (game.board.row(y).some((c) => c !== 0)) return y + 1;
  return 0;
}
