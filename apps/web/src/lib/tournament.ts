import { BOTS, type BotProfile } from '@tetra/bot';
import { useSyncExternalStore } from 'react';
import { skinUnlocked } from './achievements';
import type { SimRequest, SimResponse } from '../game/sim.worker';
import { findBot } from './customBots';
import { addTrophy, awardXp, getProfile, tournamentXp } from './profile';
import { load, save } from './storage';
import { devUnlocked } from './versus';

export type CupId = 'foundations' | 'contenders' | 'summit';
export type Seeding = 'level' | 'random';

export interface Cup {
  id: CupId;
  name: string;
  tagline: string;
  tier: number;
  /** Ladder levels of the seven bots you meet. */
  field: number[];
  formats: number[];
  /** A skin that comes with the title. */
  reward: string;
  requires: CupId | null;
}

export const CUPS: Cup[] = [
  { id: 'foundations', name: 'Foundations', tagline: 'Your first bracket. Pebble to Tempo.', tier: 0, field: [1, 1, 2, 2, 3, 3, 4], formats: [2, 3, 4], reward: 'crystal', requires: null },
  { id: 'contenders', name: 'Contenders', tagline: 'Spins start to show up. Tempo to Vector.', tier: 1, field: [3, 4, 4, 5, 5, 6, 7], formats: [2, 3, 4], reward: 'aurora', requires: 'foundations' },
  { id: 'summit', name: 'Summit', tagline: 'The top of the ladder, all at once.', tier: 2, field: [6, 7, 7, 8, 9, 9, 10], formats: [2, 3, 4], reward: 'ember', requires: 'contenders' },
];

/** One seat in the bracket. `bot` is null for you. */
export interface Entrant {
  key: string;
  bot: string | null;
  name: string;
  color: string;
  level: number;
}

export interface Bout {
  a: number | null;
  b: number | null;
  score: [number, number] | null;
  winner: number | null;
}

export interface Tournament {
  id: string;
  cup: CupId | null;
  name: string;
  tier: number;
  entrants: Entrant[];
  /** First-to per round, first round first. */
  formats: number[];
  rounds: Bout[][];
  seed: number;
  /** Your final place once it is settled (1 = champion). */
  place: number | null;
  created: number;
}

// ── Clones ─────────────────────────────────────────────────────

/** A cup may hold the same level twice; the second one plays the same but has its own name and emblem. */
const CLONE_NAMES = ['Flint', 'Shale', 'Quartz', 'Basalt', 'Cobalt', 'Onyx', 'Slate', 'Mica', 'Garnet', 'Jade', 'Opal', 'Ochre', 'Cinder', 'Agate', 'Fern', 'Reed', 'Tide', 'Halo', 'Nova', 'Orbit', 'Glint', 'Sable', 'Wren', 'Lumen', 'Ridge', 'Vale', 'Ash', 'Brook', 'Dune', 'Frost'];

function shiftHue(hex: string, degrees: number): string {
  const n = parseInt(hex.slice(1), 16);
  let [r, g, b] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + degrees) % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 2 ** 32;
}

function makeEntrants(bots: BotProfile[], withYou: boolean, seed: number): Entrant[] {
  const rand = rng(seed);
  const pool = [...CLONE_NAMES];
  const seen = new Map<string, number>();
  const entrants: Entrant[] = withYou ? [{ key: 'you', bot: null, name: 'You', color: '#edebfa', level: 0 }] : [];
  for (const bot of bots) {
    const n = seen.get(bot.id) ?? 0;
    seen.set(bot.id, n + 1);
    if (n === 0) {
      entrants.push({ key: bot.id, bot: bot.id, name: bot.name, color: bot.color, level: bot.level });
      continue;
    }
    const name = pool.splice(Math.floor(rand() * pool.length), 1)[0] ?? `${bot.name} ${n + 1}`;
    entrants.push({ key: `${bot.id}-c${n}`, bot: bot.id, name, color: shiftHue(bot.color, n % 2 ? 22 : -22), level: bot.level });
  }
  return entrants;
}

/** The profile an entrant plays with: its bot under its own name, color and emblem. */
export function entrantProfile(e: Entrant): BotProfile | null {
  if (!e.bot) return null;
  const base = findBot(e.bot) ?? BOTS[0];
  return e.key === base.id ? base : { ...base, id: e.key, name: e.name, color: e.color };
}

// ── Bracket ────────────────────────────────────────────────────

/** Seed numbers by bracket slot so the top seeds can only meet late: 1 v 8, 4 v 5, 2 v 7, 3 v 6. */
function slots(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export interface TournamentOptions {
  name: string;
  cup?: CupId;
  tier: number;
  bots: BotProfile[];
  withYou: boolean;
  formats: number[];
  seeding: Seeding;
}

export function createTournament(o: TournamentOptions): Tournament {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const entrants = makeEntrants(o.bots, o.withYou, seed);
  const rand = rng(seed ^ 0x9e3779b9);
  // By level you are the top seed and meet the strongest bot last; random shuffles everyone.
  const seeded = o.seeding === 'level'
    ? entrants.map((_, i) => i).sort((a, b) => (entrants[a].bot === null ? -1 : entrants[b].bot === null ? 1 : entrants[b].level - entrants[a].level))
    : entrants.map((_, i) => i).sort(() => rand() - 0.5);
  const order = slots(entrants.length).map((s) => seeded[s - 1]);
  const rounds: Bout[][] = [];
  for (let size = entrants.length / 2, r = 0; size >= 1; size /= 2, r++) {
    rounds.push(Array.from({ length: size }, (_, i) => ({
      a: r === 0 ? order[i * 2] : null,
      b: r === 0 ? order[i * 2 + 1] : null,
      score: null,
      winner: null,
    })));
  }
  return { id: `t-${seed.toString(36)}`, cup: o.cup ?? null, name: o.name, tier: o.tier, entrants, formats: o.formats, rounds, seed, place: o.withYou ? null : 0, created: Date.now() };
}

export function roundName(t: Tournament, r: number): string {
  const left = t.rounds.length - r;
  return left === 1 ? 'Final' : left === 2 ? 'Semifinals' : left === 3 ? 'Quarterfinals' : `Round of ${2 ** left}`;
}

export function isYou(t: Tournament, index: number | null): boolean {
  return index !== null && t.entrants[index].bot === null;
}

/** A bout can be played once both sides are known and the round before it is over. */
export function ready(t: Tournament, r: number, i: number): boolean {
  const bout = t.rounds[r][i];
  if (bout.winner !== null || bout.a === null || bout.b === null) return false;
  return r === 0 || t.rounds[r - 1].every((b) => b.winner !== null);
}

export function champion(t: Tournament): Entrant | null {
  const final = t.rounds[t.rounds.length - 1][0];
  return final.winner === null ? null : t.entrants[final.winner];
}

/** Your bout that is ready to play, if any. */
export function yourBout(t: Tournament): { r: number; i: number } | null {
  for (let r = 0; r < t.rounds.length; r++)
    for (let i = 0; i < t.rounds[r].length; i++) if (ready(t, r, i) && (isYou(t, t.rounds[r][i].a) || isYou(t, t.rounds[r][i].b))) return { r, i };
  return null;
}

// ── Store ──────────────────────────────────────────────────────

let active: Tournament | null = load<Tournament | null>('tournament', null);
const listeners = new Set<() => void>();

function commit(next: Tournament | null): void {
  active = next;
  save('tournament', active);
  listeners.forEach((l) => l());
  runner.kick();
}

export function getTournament(): Tournament | null {
  return active;
}

export function useTournament(): Tournament | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getTournament,
  );
}

export function startTournament(o: TournamentOptions): Tournament {
  const t = createTournament(o);
  commit(t);
  return t;
}

export function abandonTournament(): void {
  commit(null);
}

/** Records a finished bout and moves the winner on; settles your place and rewards. */
export function report(r: number, i: number, score: [number, number]): void {
  const t = active;
  if (!t || t.rounds[r][i].winner !== null) return;
  const rounds = t.rounds.map((round) => round.map((b) => ({ ...b })));
  const bout = rounds[r][i];
  bout.score = score;
  bout.winner = score[0] > score[1] ? bout.a : bout.b;
  const loser = bout.winner === bout.a ? bout.b : bout.a;
  if (r + 1 < rounds.length) {
    const next = rounds[r + 1][i >> 1];
    if (i % 2 === 0) next.a = bout.winner;
    else next.b = bout.winner;
  }
  let place = t.place;
  if (place === null && isYou(t, loser)) place = 2 ** (rounds.length - r - 1) + 1;
  if (place === null && r === rounds.length - 1 && isYou(t, bout.winner)) place = 1;
  const next = { ...t, rounds, place };
  if (place !== null && t.place === null) reward(next, place);
  commit(next);
}

function reward(t: Tournament, place: number): void {
  awardXp(tournamentXp(place, t.tier), `${t.name} · ${placeName(place)}`);
  if (place <= 2) addTrophy({ cup: t.cup ?? 'custom', name: t.name, place, date: Date.now() });
}

export function placeName(place: number): string {
  return place === 1 ? 'Champion' : place === 2 ? 'Finalist' : place <= 4 ? 'Semifinalist' : place <= 8 ? 'Quarterfinalist' : `Top ${place - 1}`;
}

// ── Unlocks ────────────────────────────────────────────────────

export function cupWon(id: CupId): boolean {
  return getProfile().trophies.some((t) => t.cup === id && t.place === 1);
}

export function cupUnlocked(cup: Cup): boolean {
  return devUnlocked() || cup.requires === null || cupWon(cup.requires);
}

/** Custom brackets open after your first cup. */
export function customUnlocked(): boolean {
  return devUnlocked() || CUPS.some((c) => cupWon(c.id));
}

/** Skins are won through achievements (cup titles among them). */
export function skinLocked(skin: string): boolean {
  return !skinUnlocked(skin);
}

export function cupBots(cup: Cup): BotProfile[] {
  return cup.field.map((level) => BOTS[level - 1]);
}

// ── Background simulation ──────────────────────────────────────

/**
 * Plays every ready bot-vs-bot bout in a worker, one at a time, so the
 * bracket keeps moving while you are in your own match. A bout you are
 * watching is skipped; it gets its result from the live match instead.
 */
class Runner {
  private worker: Worker | null = null;
  private busy: { key: string; r: number; i: number; id: string } | null = null;
  private watching = new Set<string>();
  private listeners = new Set<() => void>();

  boutKey(t: Tournament, r: number, i: number): string {
    return `${t.id}:${r}:${i}`;
  }

  isSimulating(r: number, i: number): boolean {
    return !!active && this.busy?.key === this.boutKey(active, r, i);
  }

  subscribe(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  watch(r: number, i: number): void {
    if (!active) return;
    const key = this.boutKey(active, r, i);
    this.watching.add(key);
    if (this.busy?.key === key) {
      this.worker?.terminate();
      this.worker = null;
      this.busy = null;
    }
  }

  unwatch(r: number, i: number): void {
    if (!active) return;
    this.watching.delete(this.boutKey(active, r, i));
    this.kick();
  }

  kick(): void {
    if (this.busy || !active) return this.emit();
    const t = active;
    for (let r = 0; r < t.rounds.length; r++)
      for (let i = 0; i < t.rounds[r].length; i++) {
        const bout = t.rounds[r][i];
        if (!ready(t, r, i) || isYou(t, bout.a) || isYou(t, bout.b) || this.watching.has(this.boutKey(t, r, i))) continue;
        this.start(t, r, i);
        return this.emit();
      }
    this.emit();
  }

  private start(t: Tournament, r: number, i: number): void {
    const bout = t.rounds[r][i];
    const key = this.boutKey(t, r, i);
    this.busy = { key, r, i, id: t.id };
    if (!this.worker) {
      this.worker = new Worker(new URL('../game/sim.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<SimResponse>) => this.done(e.data);
    }
    this.worker.postMessage({
      key,
      a: entrantProfile(t.entrants[bout.a!])!,
      b: entrantProfile(t.entrants[bout.b!])!,
      firstTo: t.formats[r],
      seed: (t.seed + r * 131 + i * 17) >>> 0,
    } satisfies SimRequest);
  }

  private done({ key, score }: SimResponse): void {
    const busy = this.busy;
    this.busy = null;
    // A newer bracket or a live watch may have replaced this one meanwhile.
    if (busy && busy.key === key && active?.id === busy.id && !this.watching.has(key)) report(busy.r, busy.i, score);
    else this.kick();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }
}

export const runner = new Runner();
