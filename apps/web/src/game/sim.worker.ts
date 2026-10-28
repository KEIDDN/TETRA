/// <reference lib="webworker" />
import { simulateMatch, type BotProfile } from '@tetra/bot';

export interface SimRequest {
  key: string;
  a: BotProfile;
  b: BotProfile;
  firstTo: number;
  seed: number;
}

export interface SimResponse {
  key: string;
  score: [number, number];
}

// Bot-vs-bot tournament matches are played here, in simulated time, so the bracket moves while you play.
self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { key, a, b, firstTo, seed } = e.data;
  const score = simulateMatch(a, b, firstTo, seed);
  (self as unknown as Worker).postMessage({ key, score } satisfies SimResponse);
};
