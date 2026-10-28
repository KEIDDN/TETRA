import { PIECE_TYPES, type PieceType } from './pieces';

/** Small, fast, deterministic PRNG (mulberry32). */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** 7-bag randomizer. */
export class Bag {
  private rng: Rng;
  private bag: PieceType[] = [];

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  next(): PieceType {
    if (this.bag.length === 0) {
      const bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.bag = bag;
    }
    return this.bag.shift()!;
  }
}
