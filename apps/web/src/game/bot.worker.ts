/// <reference lib="webworker" />
import { think, type BotState, type Weights } from '@tetra/bot';
import type { Action } from '@tetra/engine';

export interface ThinkRequest {
  id: number;
  state: Omit<BotState, 'field'> & { field: number[] };
  weights: Weights;
  depth: number;
  beam: number;
  spins: boolean;
}

export interface ThinkMove {
  hold: boolean;
  path: Action[];
}

export interface ThinkResponse {
  id: number;
  /** Best first; the pilot may pick a worse one on purpose. */
  moves: ThinkMove[];
}

// Searching takes tens of milliseconds; doing it here keeps the game smooth.
self.onmessage = (e: MessageEvent<ThinkRequest>) => {
  const { id, state, weights, depth, beam, spins } = e.data;
  const decision = think({ ...state, field: Uint16Array.from(state.field) }, weights, { depth, beam, spins });
  const moves: ThinkMove[] = decision
    ? [{ hold: decision.hold, path: decision.placement.path }, ...decision.alternatives.slice(1, 6).map((a) => ({ hold: a.hold, path: a.placement.path }))]
    : [];
  (self as unknown as Worker).postMessage({ id, moves } satisfies ThinkResponse);
};
