import type { BotProfile } from '@tetra/bot';
import { Match, type Action, type Game, type GameEvent } from '@tetra/engine';
import { sfx } from '../audio/sfx';
import { getSettings, type Command, type Device } from '../lib/settings';
import { awardXp, versusXp } from '../lib/profile';
import { recordMatch } from '../lib/versus';
import { InputRouter } from './input';
import { botHandling, BotPilot } from './pilot';
import type { GameRenderer } from './renderer';

const COUNTDOWN_STEP_MS = 500;
const COUNTDOWN_STEPS = 3;
const ROUND_PAUSE_MS = 1800;

export type VersusPhase = 'countdown' | 'playing' | 'paused' | 'roundOver' | 'done';

export interface SideStats {
  pps: number;
  apm: number;
  /** TETR.IO's VS score: (attack + garbage cleared) per second × 100. */
  vs: number;
  attack: number;
  pieces: number;
}

export interface VersusResult {
  won: boolean;
  score: [number, number];
  stats: [SideStats, SideStats];
  /** Cumulative attack over the whole match, sampled every second. */
  timeline: { t: number; sent: [number, number] }[];
}

export interface VersusOptions {
  /** Watch this bot play the right-hand bot instead of playing yourself. */
  left?: BotProfile;
  /** Tournament bouts keep their own records and XP. */
  tournament?: boolean;
}

export interface VersusView {
  reset(): void;
  phase(phase: VersusPhase): void;
  countdown(step: number | null): void;
  score(score: [number, number]): void;
  round(winner: 0 | 1, score: [number, number]): void;
  stats(stats: [SideStats, SideStats]): void;
  /** An attack left `from`'s board (for the beam animation). */
  attack(from: 0 | 1, lines: number): void;
  event(event: GameEvent, game: Game, player: 0 | 1): void;
  result(result: VersusResult | null): void;
}

function isAction(command: Command): command is Action {
  return command !== 'retry' && command !== 'pause';
}

function sideStats(game: Game, elapsed: number): SideStats {
  const s = elapsed / 1000;
  const { attack, pieces, garbageCleared } = game.stats;
  return {
    pps: s > 0 ? pieces / s : 0,
    apm: s > 0 ? (attack / s) * 60 : 0,
    vs: s > 0 ? ((attack + garbageCleared) / s) * 100 : 0,
    attack,
    pieces,
  };
}

/**
 * A first-to-N match against a bot: rounds on fresh shared seeds, the
 * player on the keyboard/controller, the bot driven by its pilot.
 */
export class VersusSession {
  private match!: Match;
  private pilot: BotPilot;
  /** When watching two bots, the left side has a pilot too. */
  private leftPilot: BotPilot | null = null;
  private router: InputRouter;
  private phase: VersusPhase = 'countdown';
  private startAt = 0;
  private goAt = 0;
  private goGameTime = 0;
  private shownStep = -1;
  private score: [number, number] = [0, 0];
  private timers: number[] = [];
  /** Totals over finished rounds, for match stats. */
  private past = { time: 0, games: [] as { attack: number; pieces: number; garbageCleared: number }[][] };
  private timeline: { t: number; sent: [number, number] }[] = [];
  private lastSample = 0;
  private statsAt = 0;

  constructor(
    private bot: BotProfile,
    private firstTo: number,
    private renderers: [GameRenderer, GameRenderer],
    private view: VersusView,
    private onExit: () => void,
    private options: VersusOptions = {},
  ) {
    this.router = new InputRouter(getSettings(), this.onCommand);
    this.startRound();
    this.pilot = new BotPilot(bot, this.match, 1);
    if (options.left) this.leftPilot = new BotPilot(options.left, this.match, 0);
    renderers[0].ticker.add(this.tick);
    // Lets browser tests poke the match; stripped from production builds.
    if (import.meta.env.DEV) (window as unknown as { __versus: unknown }).__versus = this;
  }

  rematch(): void {
    this.clearTimers();
    this.score = [0, 0];
    this.past = { time: 0, games: [] };
    this.timeline = [];
    this.lastSample = 0;
    this.view.result(null);
    this.view.score(this.score);
    this.startRound();
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    const t = performance.now() - this.startAt;
    this.match.update(t);
    if (!this.leftPilot) for (const { action } of this.router.heldActions()) this.match.input(0, action, false, t);
    this.goGameTime = this.match.games[0].time;
    this.setPhase('paused');
  }

  resume(): void {
    if (this.phase === 'paused') this.beginCountdown(this.goGameTime);
  }

  dispose(): void {
    this.clearTimers();
    this.router.dispose();
    this.pilot.dispose();
    this.leftPilot?.dispose();
    this.renderers[0].ticker.remove(this.tick);
  }

  private clearTimers(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
  }

  private startRound(): void {
    const settings = getSettings();
    this.match = new Match({ seed: (Math.random() * 2 ** 32) >>> 0, handling: [this.options.left ? botHandling(this.options.left) : settings.keyboard.handling, botHandling(this.bot)] });
    this.pilot?.setMatch(this.match);
    this.leftPilot?.setMatch(this.match);
    this.renderers.forEach((r) => r.reset());
    this.view.reset();
    this.beginCountdown(0);
  }

  private beginCountdown(gameTime: number): void {
    this.goGameTime = gameTime;
    this.goAt = performance.now() + COUNTDOWN_STEP_MS * COUNTDOWN_STEPS;
    this.startAt = this.goAt - gameTime;
    this.shownStep = -1;
    this.setPhase('countdown');
  }

  private setPhase(phase: VersusPhase): void {
    this.phase = phase;
    this.view.phase(phase);
    if (phase !== 'countdown' && phase !== 'playing') this.view.countdown(null);
  }

  private onCommand = (command: Command, pressed: boolean, time: number, device: Device): void => {
    if (isAction(command)) {
      if (this.phase !== 'playing' || this.leftPilot) return;
      if (pressed) this.match.games[0].setHandling(getSettings()[device].handling);
      this.match.input(0, command, pressed, time - this.startAt);
      return;
    }
    if (!pressed) return;
    if (command === 'retry') {
      if (this.phase === 'done' && !this.options.tournament) this.rematch();
      return;
    }
    if (this.phase === 'playing') this.pause();
    else if (this.phase === 'paused') this.resume();
    else if (this.phase === 'done' || (this.phase === 'countdown' && this.goGameTime === 0 && this.score[0] + this.score[1] === 0)) this.onExit();
  };

  private tick = (): void => {
    const now = performance.now();
    if (this.phase === 'countdown') {
      const remaining = this.goAt - now;
      if (remaining > 0) {
        const step = Math.ceil(remaining / COUNTDOWN_STEP_MS);
        if (step !== this.shownStep) {
          this.shownStep = step;
          this.view.countdown(step);
          sfx.countdown(step);
        }
      } else {
        this.setPhase('playing');
        this.shownStep = 0;
        this.view.countdown(0);
        sfx.go();
        if (!this.leftPilot) for (const { action, since, device } of this.router.heldActions()) {
          this.match.games[0].setHandling(getSettings()[device].handling);
          this.match.input(0, action, true, this.goGameTime, since - this.startAt);
        }
      }
    }
    if (this.phase === 'playing') {
      if (this.shownStep === 0 && now - this.goAt > 450) {
        this.shownStep = -1;
        this.view.countdown(null);
      }
      const t = now - this.startAt;
      this.match.update(t);
      this.leftPilot?.update(t);
      this.pilot.update(t);
      this.match.update(t);
    }
    this.flush(now);
    this.renderers[0].draw(this.match.games[0], now);
    this.renderers[1].draw(this.match.games[1], now);
    this.sample(now);
  };

  /** Hands each side's events to its renderer, sound and the UI, then checks the round. */
  private flush(now: number): void {
    this.match.games.forEach((game, i) => {
      const player = i as 0 | 1;
      for (const e of game.events) {
        this.renderers[player].onEvent(e, game, now);
        this.view.event(e, game, player);
        if (e.type === 'attack') this.view.attack(player, e.lines.reduce((a, b) => a + b, 0));
        if (player === 0) sfx.onEvent(e);
      }
      game.events.length = 0;
      this.match.drained(player);
    });
    if (this.phase === 'playing' && this.match.over) this.endRound(now);
  }

  private endRound(now: number): void {
    const winner = this.match.winner!;
    this.score[winner]++;
    this.renderers[1 - winner].endGame('topout', now);
    this.renderers[winner].endGame('finished', now);
    sfx.end(winner === 0 ? 'finished' : 'topout');
    const games = this.match.games;
    this.past.time += games[0].elapsed;
    this.past.games.push(games.map((g) => ({ attack: g.stats.attack, pieces: g.stats.pieces, garbageCleared: g.stats.garbageCleared })));
    this.setPhase('roundOver');
    this.view.round(winner, [...this.score]);
    if (this.score[winner] >= this.firstTo) {
      this.timers.push(window.setTimeout(() => this.finishMatch(), 1400));
    } else {
      this.timers.push(window.setTimeout(() => this.startRound(), ROUND_PAUSE_MS));
    }
  }

  private finishMatch(): void {
    this.setPhase('done');
    const won = this.score[0] > this.score[1];
    if (!this.options.tournament && !this.options.left) {
      recordMatch(this.bot.id, won, this.score[0], this.score[1]);
      awardXp(versusXp(won, this.bot.level, this.score[0]), `vs ${this.bot.name}`);
    }
    const totals = [0, 1].map((i) =>
      this.past.games.reduce((acc, round) => ({
        attack: acc.attack + round[i].attack,
        pieces: acc.pieces + round[i].pieces,
        garbageCleared: acc.garbageCleared + round[i].garbageCleared,
      }), { attack: 0, pieces: 0, garbageCleared: 0 }),
    );
    const s = this.past.time / 1000;
    const stats = totals.map((t) => ({
      pps: t.pieces / s,
      apm: (t.attack / s) * 60,
      vs: ((t.attack + t.garbageCleared) / s) * 100,
      attack: t.attack,
      pieces: t.pieces,
    })) as [SideStats, SideStats];
    this.view.result({ won, score: [...this.score], stats, timeline: this.timeline });
  }

  private sample(now: number): void {
    if (this.phase !== 'playing') return;
    const games = this.match.games;
    const elapsed = games[0].elapsed;
    if (now - this.statsAt > 250) {
      this.statsAt = now;
      this.view.stats([sideStats(games[0], elapsed), sideStats(games[1], elapsed)]);
    }
    const t = this.past.time + elapsed;
    if (t - this.lastSample >= 1000) {
      this.lastSample = t;
      const before = [0, 1].map((i) => this.past.games.reduce((n, r) => n + r[i].attack, 0));
      this.timeline.push({ t, sent: [before[0] + games[0].stats.attack, before[1] + games[1].stats.attack] });
    }
  }
}
