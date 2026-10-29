import { Game, type Action, type GameEvent, type ModeId } from '@tetra/engine';
import { dj } from '../audio/dj';
import { sfx } from '../audio/sfx';
import { getSettings, type Command, type Device } from '../lib/settings';
import { awardXp, soloXp } from '../lib/profile';
import { loadBest, submitBest, type RunRecord } from '../lib/storage';
import { InputRouter } from './input';
import { MODE_CONFIGS } from './modes';
import type { GameRenderer } from './renderer';

const COUNTDOWN_STEP_MS = 500;
const COUNTDOWN_STEPS = 3;

export type Phase = 'countdown' | 'playing' | 'paused' | 'done';

export interface LiveStats {
  /** What the clock shows: elapsed time, or time left in timed modes. */
  clock: number;
  lines: number;
  pieces: number;
  pps: number;
  score: number;
  level: number;
}

export interface SessionResult {
  mode: ModeId;
  finished: boolean;
  record: RunRecord;
  personalBest: boolean;
  previousBest: RunRecord | null;
}

export interface SessionView {
  /** A fresh game started (retry). */
  reset(): void;
  event(event: GameEvent, game: Game): void;
  countdown(step: number | null): void;
  phase(phase: Phase): void;
  stats(stats: LiveStats): void;
  result(result: SessionResult | null): void;
}

function isAction(command: Command): command is Action {
  return command !== 'retry' && command !== 'pause';
}

/**
 * Runs one mode: owns the game, countdowns, pause and input routing.
 * `startAt` maps game time to performance.now(): game time = now - startAt.
 * Keys held during a countdown carry over (with their DAS charge) when play starts.
 */
export class GameSession {
  private game!: Game;
  private startAt = 0;
  private goAt = 0;
  private goGameTime = 0;
  private phase: Phase = 'countdown';
  private shownStep = -1;
  private resultTimer = 0;
  private router: InputRouter;

  constructor(
    private mode: ModeId,
    private renderer: GameRenderer,
    private view: SessionView,
    private onExit: () => void,
  ) {
    this.router = new InputRouter(getSettings(), this.onCommand);
    renderer.ticker.add(this.tick);
    this.restart();
    // Lets browser tests set up positions; stripped from production builds.
    if (import.meta.env.DEV) (window as unknown as { __tetra: unknown }).__tetra = this;
  }

  /** The current game (dev tooling). */
  get current(): Game {
    return this.game;
  }

  restart(): void {
    const settings = getSettings();
    this.game = new Game({
      seed: (Math.random() * 2 ** 32) >>> 0,
      rules: MODE_CONFIGS[this.mode].def.rules,
      handling: settings.keyboard.handling,
    });
    clearTimeout(this.resultTimer);
    this.renderer.reset();
    this.view.reset();
    this.view.result(null);
    this.beginCountdown(0);
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    const t = performance.now() - this.startAt;
    this.game.update(t);
    for (const { action } of this.router.heldActions()) this.game.input(action, false, t);
    this.goGameTime = this.game.time;
    this.setPhase('paused');
    this.afterStep();
  }

  resume(): void {
    if (this.phase === 'paused') this.beginCountdown(this.goGameTime);
  }

  dispose(): void {
    clearTimeout(this.resultTimer);
    this.router.dispose();
    this.renderer.ticker.remove(this.tick);
  }

  private beginCountdown(gameTime: number): void {
    this.goGameTime = gameTime;
    this.goAt = performance.now() + COUNTDOWN_STEP_MS * COUNTDOWN_STEPS;
    this.startAt = this.goAt - gameTime;
    this.shownStep = -1;
    this.setPhase('countdown');
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    dj.paused(phase === 'paused');
    if (phase === 'done') dj.reset();
    this.view.phase(phase);
    if (phase !== 'countdown') this.view.countdown(null);
  }

  private useHandling(device: Device): void {
    const handling = getSettings()[device].handling;
    if (this.game.handling !== handling) this.game.setHandling(handling);
  }

  private onCommand = (command: Command, pressed: boolean, time: number, device: Device): void => {
    if (isAction(command)) {
      if (this.phase !== 'playing') return;
      if (pressed) this.useHandling(device);
      this.game.input(command, pressed, time - this.startAt);
      this.afterStep();
      return;
    }
    if (!pressed) return;
    if (command === 'retry') return this.restart();
    switch (this.phase) {
      case 'playing':
        return this.pause();
      case 'paused':
        return this.resume();
      case 'countdown':
        // Pausing during the opening countdown leaves; during a resume countdown it pauses again.
        if (this.goGameTime === 0) return this.onExit();
        return this.setPhase('paused');
      case 'done':
        return this.onExit();
    }
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
        for (const { action, since, device } of this.router.heldActions()) {
          this.useHandling(device);
          this.game.input(action, true, this.goGameTime, since - this.startAt);
        }
      }
    }
    if (this.phase === 'playing') {
      if (this.shownStep === 0 && now - this.goAt > 450) {
        this.shownStep = -1;
        this.view.countdown(null);
      }
      this.game.update(now - this.startAt);
      dj.tick(this.game);
      this.afterStep();
    }
    this.renderer.draw(this.game, now);

    const { stats, rules } = this.game;
    const elapsed = this.game.elapsed;
    this.view.stats({
      clock: rules.timeLimit !== null ? Math.max(0, rules.timeLimit - elapsed) : elapsed,
      lines: stats.lines,
      pieces: stats.pieces,
      pps: elapsed > 0 ? stats.pieces / (elapsed / 1000) : 0,
      score: stats.score,
      level: stats.level,
    });
  };

  private afterStep(): void {
    const game = this.game;
    if (game.events.length > 0) {
      const now = performance.now();
      for (const e of game.events) {
        this.renderer.onEvent(e, game, now);
        sfx.onEvent(e);
        dj.event(e);
        this.view.event(e, game);
      }
      game.events.length = 0;
    }
    if (game.state === 'playing' || this.phase === 'done') return;

    this.setPhase('done');
    const kind = game.state === 'finished' ? 'finished' : 'topout';
    this.renderer.endGame(kind, performance.now());
    sfx.end(kind);
    const config = MODE_CONFIGS[this.mode];
    const finished = game.state === 'finished';
    const { stats } = game;
    const record: RunRecord = {
      time: game.elapsed,
      score: stats.score,
      lines: stats.lines,
      level: stats.level,
      pieces: stats.pieces,
      inputs: stats.inputs,
      date: Date.now(),
    };
    const previousBest = loadBest(this.mode);
    const counts = (finished || !config.recordNeedsFinish) && stats.pieces > 0;
    const personalBest = counts && submitBest(this.mode, record, config.isBetter);
    awardXp(soloXp(stats.pieces, stats.lines, personalBest), config.def.name);
    // Let the end animation play before the results card covers the board.
    this.resultTimer = window.setTimeout(
      () => this.view.result({ mode: this.mode, finished, record, personalBest, previousBest }),
      finished ? 900 : 1100,
    );
  }
}
