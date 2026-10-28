import { useSyncExternalStore } from 'react';
import { load, save } from './storage';
import { toast } from '../ui/toast';

export interface Trophy {
  cup: string;
  name: string;
  /** 1 = champion, 2 = finalist, 3 = semifinalist… */
  place: number;
  date: number;
}

export interface Profile {
  xp: number;
  trophies: Trophy[];
}

/**
 * Levels never end: each one asks a little more XP than the last.
 * Level 1 → 2 takes 100 XP, level 10 → 11 about 700, level 50 → 51 about 5,800.
 */
export function xpToNext(level: number): number {
  return Math.round(100 * level ** 1.25);
}

export function levelFor(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, needed: xpToNext(level) };
}

let current: Profile = { xp: 0, trophies: [], ...load<Partial<Profile>>('profile', {}) };
const listeners = new Set<() => void>();

function commit(next: Profile): void {
  current = next;
  save('profile', current);
  listeners.forEach((l) => l());
}

export function getProfile(): Profile {
  return current;
}

export function useProfile(): Profile {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getProfile,
  );
}

/** Adds XP and tells the player; announces level ups. */
export function awardXp(amount: number, reason: string): void {
  const xp = Math.max(0, Math.round(amount));
  if (xp === 0) return;
  const before = levelFor(current.xp).level;
  commit({ ...current, xp: current.xp + xp });
  const after = levelFor(current.xp).level;
  toast(after > before ? `Level ${after} · +${xp} XP` : `+${xp} XP · ${reason}`);
}

export function addTrophy(trophy: Trophy): void {
  commit({ ...current, trophies: [...current.trophies, trophy] });
}

// ── What things are worth ──────────────────────────────────────

/** Solo runs: a little for every piece and line, so practice always counts. */
export function soloXp(pieces: number, lines: number, personalBest: boolean): number {
  return Math.min(120, pieces / 8 + lines / 3) + (personalBest ? 40 : 0);
}

export function versusXp(won: boolean, botLevel: number, roundsWon: number): number {
  return (won ? 40 + 15 * botLevel : 10 + 3 * botLevel) + roundsWon * 5;
}

export function tournamentXp(place: number, tier: number): number {
  const base = place === 1 ? 250 : place === 2 ? 120 : place <= 4 ? 60 : 20;
  return base * (1 + tier * 0.6);
}
