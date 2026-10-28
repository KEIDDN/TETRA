import { DEFAULT_HANDLING, Game, SPRINT, type Action } from '@tetra/engine';
import { submitSprint, loadSprintBest } from '../lib/storage';
import { DEFAULT_BINDINGS, Keyboard } from './input';
import type { GameRenderer } from './renderer';

const COUNTDOWN_STEP_MS = 500;
const COUNTDOWN_STEPS = 3;

export interface LiveStats {
  time: number;
  lines: number;
  pieces: number;
  pps: number;
}

export interface SessionResult {
  finished: boolean;
  time: number;
  lines: number;
  lineGoal: number;
  pieces: number;
  inputs: number;
  personalBest: boolean;
  previousBest: number | null;
}

export interface SessionView {
  countdown(step: number | null): void;
  stats(stats: LiveStats): void;
  result(result: SessionResult | null): void;
}

/**
 * Runs 40 Lines: owns the game, the countdown and keyboard routing. Game time 0
 * is the moment the countdown ends; keys held during the countdown carry over
 * (with their DAS charge) into the first piece.
 */
export class SprintSession {
  private game!: Game;
  private startAt = 0;
  private phase: 'countdown' | 'playing' | 'done' = 'countdown';
  private shownStep = -1;
  private keyboard: Keyboard;

  constructor(
    private renderer: GameRenderer,
    private view: SessionView,
    onExit: () => void,
  ) {
    this.keyboard = new Keyboard(DEFAULT_BINDINGS, {
      onAction: (action, pressed, time) => this.onAction(action, pressed, time),
      onCommand: (command) => (command === 'retry' ? this.restart() : onExit()),
    });
    renderer.ticker.add(this.tick);
    this.restart();
  }

  restart(): void {
    this.game = new Game({ seed: (Math.random() * 2 ** 32) >>> 0, rules: SPRINT.rules, handling: DEFAULT_HANDLING });
    this.startAt = performance.now() + COUNTDOWN_STEP_MS * COUNTDOWN_STEPS;
    this.phase = 'countdown';
    this.shownStep = -1;
    this.view.result(null);
  }

  dispose(): void {
    this.keyboard.dispose();
    this.renderer.ticker.remove(this.tick);
  }

  private onAction(action: Action, pressed: boolean, time: number): void {
    if (this.phase !== 'playing') return;
    this.game.input(action, pressed, time - this.startAt);
    this.afterStep();
  }

  private tick = (): void => {
    const now = performance.now();
    if (this.phase === 'countdown') {
      const remaining = this.startAt - now;
      if (remaining > 0) {
        const step = Math.ceil(remaining / COUNTDOWN_STEP_MS);
        if (step !== this.shownStep) {
          this.shownStep = step;
          this.view.countdown(step);
        }
      } else {
        this.phase = 'playing';
        this.view.countdown(null);
        for (const { action, since } of this.keyboard.held()) {
          this.game.input(action, true, 0, since - this.startAt);
        }
      }
    }
    if (this.phase === 'playing') {
      this.game.update(now - this.startAt);
      this.afterStep();
    }
    this.renderer.draw(this.game);

    const { stats } = this.game;
    const time = this.game.elapsed;
    this.view.stats({ time, lines: stats.lines, pieces: stats.pieces, pps: time > 0 ? stats.pieces / (time / 1000) : 0 });
  };

  private afterStep(): void {
    const game = this.game;
    game.events.length = 0;
    if (this.phase !== 'playing' || game.state === 'playing') return;

    this.phase = 'done';
    const finished = game.state === 'finished';
    const previous = loadSprintBest();
    const record = { time: game.elapsed, pieces: game.stats.pieces, inputs: game.stats.inputs, date: Date.now() };
    const personalBest = finished && submitSprint(record);
    this.view.result({
      finished,
      time: game.elapsed,
      lines: game.stats.lines,
      lineGoal: game.rules.lineGoal ?? 0,
      pieces: game.stats.pieces,
      inputs: game.stats.inputs,
      personalBest,
      previousBest: previous?.time ?? null,
    });
  }
}
