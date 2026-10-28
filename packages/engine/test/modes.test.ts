import { describe, expect, it } from 'vitest';
import { BLITZ, Board, clearScore, Game, levelForLines, levelGravity, MARATHON, type Action } from '../src';

const instant = { das: 167, arr: 33, sdf: Infinity, dcd: 0 };

function tap(g: Game, action: Action, t = g.time) {
  g.input(action, true, t);
  g.input(action, false, t);
}

describe('level curves', () => {
  it('follows the TETR.IO BLITZ line goals', () => {
    expect(levelForLines('blitz', 2)).toBe(1);
    expect(levelForLines('blitz', 3)).toBe(2);
    expect(levelForLines('blitz', 8)).toBe(3);
    expect(levelForLines('blitz', 99)).toBe(10);
    expect(levelForLines('blitz', 120)).toBe(11);
    expect(levelForLines('blitz', 228)).toBe(15);
  });

  it('levels up every 10 lines on the guideline curve', () => {
    expect(levelForLines('guideline', 9)).toBe(1);
    expect(levelForLines('guideline', 10)).toBe(2);
    expect(levelForLines('guideline', 149)).toBe(15);
  });

  it('speeds gravity up to 20G', () => {
    expect(levelGravity('blitz', 1)).toBeCloseTo(1 / 60, 3);
    expect(levelGravity('blitz', 14)).toBe(20);
    expect(levelGravity('blitz', 30)).toBe(20);
    expect(levelGravity('guideline', 1)).toBeCloseTo(1 / 60, 5);
    expect(levelGravity('guideline', 20)).toBe(20);
    for (let l = 1; l < 20; l++) expect(levelGravity('guideline', l + 1)).toBeGreaterThanOrEqual(levelGravity('guideline', l));
  });
});

describe('scoring', () => {
  const info = { piece: 'I' as const, lines: 4, spin: 'none' as const, b2b: 0, combo: 0, perfectClear: false };

  it('scores clears times the level', () => {
    expect(clearScore(info, 1)).toBe(800);
    expect(clearScore(info, 3)).toBe(2400);
    expect(clearScore({ ...info, lines: 2, spin: 'full', piece: 'T' }, 1)).toBe(1200);
    expect(clearScore({ ...info, lines: 0, spin: 'full', piece: 'T' }, 2)).toBe(800);
  });

  it('adds back-to-back, combo and all clear bonuses', () => {
    expect(clearScore({ ...info, b2b: 1, combo: 2, perfectClear: true }, 1)).toBe(100 + 800 * 1.5 + 3500);
  });

  it('awards drop points without the level multiplier', () => {
    const g = new Game({ seed: 1, pieces: ['T'], handling: instant, rules: { levelCurve: 'blitz' } });
    tap(g, 'hardDrop', 0);
    expect(g.stats.score).toBe(20 * 2); // spawns in row 20, lands in row 0
  });
});

describe('modes', () => {
  it('ends Blitz after two minutes', () => {
    const g = new Game({ seed: 1, handling: instant, rules: BLITZ.rules });
    g.update(119_999);
    expect(g.state).toBe('playing');
    g.update(200_000);
    expect(g.state).toBe('finished');
    expect(g.elapsed).toBe(120_000);
  });

  it('ignores inputs after the time limit', () => {
    const g = new Game({ seed: 1, handling: instant, rules: BLITZ.rules });
    g.update(130_000);
    const pieces = g.stats.pieces;
    tap(g, 'hardDrop', 130_000);
    expect(g.stats.pieces).toBe(pieces);
  });

  it('scores back-to-back and combo in Marathon', () => {
    const rows = Array.from({ length: 10 }, () => '#########.');
    const board = Board.fromRows(rows);
    const g = new Game({ seed: 1, handling: { ...instant, arr: 0 }, pieces: ['I', 'I', 'I'], rules: MARATHON.rules }, board);
    for (let i = 0; i < 2; i++) {
      tap(g, 'rotateCW');
      g.input('moveRight', true, g.time);
      g.update(g.time + 200);
      g.input('moveRight', false, g.time);
      tap(g, 'hardDrop');
    }
    expect(g.stats.lines).toBe(8);
    expect(g.stats.level).toBe(1);
    expect(g.events.filter((e) => e.type === 'clear').map((e) => e.type === 'clear' && e.score)).toEqual([800, 800 * 1.5 + 50]); // second quad is B2B with a 1-combo
  });
});
