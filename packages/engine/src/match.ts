import { DEFAULT_ATTACK, type AttackRules } from './attack';
import { Game, type Action, type Handling, type Rules } from './game';

export interface MatchOptions {
  seed: number;
  rules?: Partial<Rules>;
  attack?: Partial<AttackRules>;
  handling: [Partial<Handling>, Partial<Handling>];
}

/**
 * One versus round: two games on the same piece sequence, with each
 * side's attack delivered to the other at the moment it happens.
 */
export class Match {
  readonly games: [Game, Game];
  /** Index of the round's winner, once someone tops out. */
  winner: 0 | 1 | null = null;
  private routed = [0, 0];

  constructor(options: MatchOptions) {
    const rules: Partial<Rules> = { ...options.rules, attack: { ...DEFAULT_ATTACK, ...options.attack } };
    this.games = [
      new Game({ seed: options.seed, rules, handling: options.handling[0] }),
      new Game({ seed: options.seed, rules, handling: options.handling[1] }),
    ];
  }

  get over(): boolean {
    return this.winner !== null;
  }

  update(t: number): void {
    if (this.over) return;
    // Step both sides together so attack lands in the right order.
    this.games[0].update(t);
    this.route();
    this.games[1].update(t);
    this.route();
  }

  input(player: 0 | 1, action: Action, pressed: boolean, t: number, heldSince?: number): void {
    if (this.over) return;
    this.games[1 - player].update(t);
    this.route();
    this.games[player].input(action, pressed, t, heldSince);
    this.route();
  }

  /** Delivers new attack events and settles the round when someone tops out. */
  private route(): void {
    for (const i of [0, 1] as const) {
      const game = this.games[i];
      const other = this.games[1 - i];
      // Events stay in the queue for the UI; remember which ones were already routed.
      for (let e = this.routed[i]; e < game.events.length; e++) {
        const event = game.events[e];
        if (event.type === 'attack') for (const lines of event.lines) other.receive(lines, event.time);
      }
      this.routed[i] = game.events.length;
    }
    for (const i of [0, 1] as const) {
      if (this.games[i].state === 'topout' && this.winner === null) {
        this.winner = (1 - i) as 0 | 1;
        this.games[1 - i].stop();
      }
    }
  }

  /** Call after the UI drains a game's events. */
  drained(player: 0 | 1): void {
    this.routed[player] = 0;
  }
}
