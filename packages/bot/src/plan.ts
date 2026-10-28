import { attackFor, DEFAULT_ATTACK, type AttackRules, type ClearInfo, type PieceType, type Rotation } from '@tetra/engine';
import { fits, place, type Field } from './field';
import { evaluate, type Weights } from './evaluate';
import { placements, type Placement } from './moves';

export interface BotState {
  field: Field;
  current: PieceType;
  hold: PieceType | null;
  /** Visible queue after the current piece. */
  queue: PieceType[];
  /** Engine counters: -1 = none. */
  b2b: number;
  combo: number;
  /** Garbage lines waiting to enter. */
  incoming: number;
  twentyG: boolean;
}

export interface SearchOptions {
  /** Pieces to look ahead (1 = only the current one). */
  depth: number;
  /** Nodes kept per level. */
  beam: number;
  /** Consider tucks and spins for the move actually played. */
  spins: boolean;
  attack?: AttackRules;
}

export interface Decision {
  hold: boolean;
  placement: Placement;
  /** Every candidate for the move to play, best first (for imperfect bots). */
  alternatives: { hold: boolean; placement: Placement; score: number }[];
}

interface Node {
  field: Field;
  hold: PieceType | null;
  next: number;
  b2b: number;
  combo: number;
  reward: number;
  score: number;
  first: { hold: boolean; placement: Placement } | null;
}

/** Hard-drop landings only: fast enough for deeper levels of the search. */
function landings(f: Field, type: PieceType): Placement[] {
  const out: Placement[] = [];
  const rotations: Rotation[] = type === 'O' ? [0] : [0, 1, 2, 3];
  for (const rot of rotations) {
    for (let x = -2; x < 10; x++) {
      let y = 22;
      if (!fits(f, type, rot, x, y)) continue;
      while (fits(f, type, rot, x, y - 1)) y--;
      out.push({ type, rot, x, y, spin: 'none', path: [] });
    }
  }
  return out;
}

function apply(node: Node, p: Placement, w: Weights, rules: AttackRules): Node {
  const field = node.field.slice();
  const lines = place(field, p.type, p.rot, p.x, p.y);
  let b2b = node.b2b;
  let combo = node.combo;
  let reward = 0;
  if (lines > 0) {
    const difficult = lines === 4 || p.spin !== 'none';
    combo++;
    if (difficult) b2b++;
    else {
      if (b2b >= 1) reward += w.b2bBreak;
      b2b = -1;
    }
    const pc = field.every((row) => row === 0);
    const info: ClearInfo = { piece: p.type, lines, spin: p.spin, b2b, combo, perfectClear: pc };
    const attack = attackFor(info, rules);
    reward += attack * w.attack + (attack === 0 ? w.wastedClear : 0) + (difficult ? 0 : w.burn) + (pc ? w.perfectClear : 0);
    if (b2b >= 1) reward += w.b2b * Math.min(b2b, 6);
  } else combo = -1;
  return {
    field,
    hold: node.hold,
    next: node.next,
    b2b,
    combo,
    reward: node.reward + reward,
    score: 0,
    first: node.first,
  };
}

/** Picks the move to play now by looking `depth` pieces ahead with a beam search. */
export function think(state: BotState, w: Weights, opts: SearchOptions): Decision | null {
  const rules = opts.attack ?? DEFAULT_ATTACK;
  const sequence = [state.current, ...state.queue];
  let level: Node[] = [{ field: state.field, hold: state.hold, next: 0, b2b: state.b2b, combo: state.combo, reward: 0, score: 0, first: null }];
  const firstMoves: { hold: boolean; placement: Placement; score: number }[] = [];

  for (let depth = 0; depth < Math.min(opts.depth, sequence.length); depth++) {
    const children: Node[] = [];
    for (const node of level) {
      const piece = sequence[node.next];
      if (!piece) continue;
      // Options: play the piece, or swap with hold (or hold into an empty slot and play the next).
      const options: { type: PieceType; hold: PieceType | null; advance: number; held: boolean }[] = [{ type: piece, hold: node.hold, advance: 1, held: false }];
      if (node.hold && node.hold !== piece) options.push({ type: node.hold, hold: piece, advance: 1, held: true });
      else if (!node.hold && sequence[node.next + 1]) options.push({ type: sequence[node.next + 1], hold: piece, advance: 2, held: true });

      for (const option of options) {
        const moves = depth === 0 && opts.spins ? placements(node.field, option.type, { twentyG: state.twentyG }) : landings(node.field, option.type);
        for (const p of moves) {
          const child = apply({ ...node, hold: option.hold, next: node.next + option.advance }, p, w, rules);
          child.first = node.first ?? { hold: option.held, placement: p };
          child.score = child.reward + evaluate(child.field, w, depth === 0 ? state.incoming : 0);
          children.push(child);
        }
      }
    }
    if (children.length === 0) break;
    children.sort((a, b) => b.score - a.score);
    if (depth === 0) for (const c of children) firstMoves.push({ ...c.first!, score: c.score });
    level = children.slice(0, opts.beam);
  }
  if (level.length === 0 || !level[0].first) return null;
  // Rank first moves by the best line they lead to.
  const bestByFirst = new Map<Placement, number>();
  for (const n of level) {
    const p = n.first!.placement;
    bestByFirst.set(p, Math.max(bestByFirst.get(p) ?? -Infinity, n.score));
  }
  const alternatives = firstMoves
    .map((m) => ({ ...m, score: bestByFirst.get(m.placement) ?? m.score - 1000 }))
    .sort((a, b) => b.score - a.score);
  return { hold: level[0].first.hold, placement: level[0].first.placement, alternatives };
}
