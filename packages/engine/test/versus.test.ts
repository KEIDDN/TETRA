import { describe, expect, it } from 'vitest';
import { attackFor, Board, DEFAULT_ATTACK, Game, GARBAGE_CODE, Match, surgeFor, type Action, type ClearInfo } from '../src';

const instant = { das: 167, arr: 33, sdf: Infinity, dcd: 0 };
const clear = (c: Partial<ClearInfo>): ClearInfo => ({ piece: 'T', lines: 1, spin: 'none', b2b: -1, combo: 0, perfectClear: false, ...c });

function tap(g: Game | Match, action: Action, t: number, player: 0 | 1 = 0) {
  if (g instanceof Match) {
    g.input(player, action, true, t);
    g.input(player, action, false, t);
  } else {
    g.input(action, true, t);
    g.input(action, false, t);
  }
}

describe('attack table', () => {
  const r = DEFAULT_ATTACK;
  it('sends the base table', () => {
    expect(attackFor(clear({ lines: 1 }), r)).toBe(0);
    expect(attackFor(clear({ lines: 2 }), r)).toBe(1);
    expect(attackFor(clear({ lines: 3 }), r)).toBe(2);
    expect(attackFor(clear({ lines: 4 }), r)).toBe(4);
    expect(attackFor(clear({ lines: 2, spin: 'full' }), r)).toBe(4);
    expect(attackFor(clear({ lines: 3, spin: 'full' }), r)).toBe(6);
    expect(attackFor(clear({ lines: 1, spin: 'mini' }), r)).toBe(0);
  });

  it('adds one line for back-to-back', () => {
    expect(attackFor(clear({ lines: 4, b2b: 1 }), r)).toBe(5);
    expect(attackFor(clear({ lines: 2, spin: 'full', b2b: 3 }), r)).toBe(5);
  });

  it('multiplies by combo, with a log curve for zero-attack clears', () => {
    expect(attackFor(clear({ lines: 2, combo: 1 }), r)).toBe(1);
    expect(attackFor(clear({ lines: 2, combo: 4 }), r)).toBe(2);
    expect(attackFor(clear({ lines: 4, combo: 4 }), r)).toBe(8);
    expect(attackFor(clear({ lines: 1, combo: 1 }), r)).toBe(0);
    expect(attackFor(clear({ lines: 1, combo: 2 }), r)).toBe(1);
  });

  it('adds the all clear bonus', () => {
    expect(attackFor(clear({ lines: 4, perfectClear: true }), r)).toBe(4 + r.allClear);
  });

  it('releases surge in three segments', () => {
    expect(surgeFor(3, r)).toEqual([]);
    expect(surgeFor(4, r)).toEqual([2, 1, 1]);
    expect(surgeFor(6, r)).toEqual([2, 2, 2]);
    expect(surgeFor(10, r)).toEqual([4, 3, 3]);
  });
});

describe('match', () => {
  // A T-spin double setup on the bottom-left of both boards.
  function tsdMatch() {
    const m = new Match({ seed: 1, handling: [instant, instant], attack: { marginTime: null } });
    for (const g of m.games) {
      ['...#......', '#...######', '##.#######'].forEach((row, i) =>
        [...row].forEach((c, x) => c === '#' && g.board.set(x, 2 - i, GARBAGE_CODE)),
      );
      // Force a T as the active piece.
      g.piece = { type: 'T', rotation: 3, x: 1, y: 0 };
    }
    return m;
  }

  it('sends attack to the opponent, who takes it after the delay', () => {
    const m = tsdMatch();
    tap(m, 'rotateCCW', 0);
    tap(m, 'hardDrop', 0);
    const [a, b] = m.games;
    expect(a.stats.attack).toBe(4);
    expect(b.pendingGarbage).toBe(4);
    // Before the delay a placement doesn't bring it in.
    tap(m, 'hardDrop', 100, 1);
    expect(b.pendingGarbage).toBe(4);
    tap(m, 'hardDrop', 1000, 1);
    expect(b.pendingGarbage).toBe(0);
    const garbageRows = [0, 1, 2, 3].map((y) => b.board.row(y).filter((c) => c === GARBAGE_CODE).length);
    expect(garbageRows).toEqual([9, 9, 9, 9]);
    // One hole column for the whole attack.
    const holes = [0, 1, 2, 3].map((y) => b.board.row(y).indexOf(0));
    expect(new Set(holes).size).toBe(1);
  });

  it('cancels incoming garbage before sending', () => {
    const m = tsdMatch();
    tap(m, 'rotateCCW', 0, 1);
    tap(m, 'hardDrop', 0, 1);
    expect(m.games[0].pendingGarbage).toBe(4);
    tap(m, 'rotateCCW', 10, 0);
    tap(m, 'hardDrop', 10, 0);
    expect(m.games[0].pendingGarbage).toBe(0);
    expect(m.games[1].pendingGarbage).toBe(0);
    expect(m.games[0].events.some((e) => e.type === 'cancel' && e.lines === 4)).toBe(true);
  });

  it('ends the round when a player tops out', () => {
    const m = new Match({ seed: 3, handling: [instant, instant] });
    let t = 0;
    while (!m.over && t < 60_000) {
      t += 50;
      tap(m, 'hardDrop', t, 1);
    }
    expect(m.winner).toBe(0);
    expect(m.games[0].state).toBe('finished');
  });

  it('keeps garbage rows linked for connected skins', () => {
    const g = new Game({ seed: 1, handling: instant, rules: { attack: { ...DEFAULT_ATTACK, garbageDelay: 0 } } }, new Board());
    g.receive(2, 0);
    tap(g, 'hardDrop', 0);
    const row = g.board.row(0);
    const x = row.findIndex((c) => c === GARBAGE_CODE);
    expect(g.board.getLinks(x, 0)).not.toBe(0);
  });
});
