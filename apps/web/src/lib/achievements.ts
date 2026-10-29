import type { GameEvent, GameStats, ModeId } from '@tetra/engine';
import { useSyncExternalStore } from 'react';
import { BOTS } from '@tetra/bot';
import { toast } from '../ui/toast';
import { getProfile, levelFor, subscribeProfile } from './profile';
import { load, loadBest, loadHistory, save, type RunRecord } from './storage';
import { botRecord, devUnlocked } from './versus';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type Category = 'Getting started' | '40 Lines' | 'Blitz' | 'Marathon' | 'Endless' | 'Technique' | 'Versus' | 'Cups' | 'Dedication';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: Category;
  tier: Tier;
  /** The skin it unlocks, if any. */
  reward?: string;
  /** For counters: where the player is, out of what. */
  progress?: () => [number, number];
}

/** Lifetime counters that achievements read. */
interface Lifetime {
  lines: number;
  games: number;
  skins: string[];
}

const life = (): Lifetime => ({ lines: 0, games: 0, skins: [], ...load<Partial<Lifetime>>('lifetime', {}) });
const hours = (ms: number) => ms / 3_600_000;

/** Every skin outside these four is won through an achievement. */
export const STARTER_SKINS = ['studio', 'clay', 'neon', 'mono'];

export const ACHIEVEMENTS: Achievement[] = [
  // Getting started
  { id: 'first-game', name: 'First drop', description: 'Finish your first game.', category: 'Getting started', tier: 'bronze' },
  { id: 'lines-100', name: 'Hundred', description: 'Clear 100 lines in total.', category: 'Getting started', tier: 'bronze', reward: 'gem', progress: () => [life().lines, 100] },
  { id: 'lines-1000', name: 'Thousand', description: 'Clear 1,000 lines in total.', category: 'Getting started', tier: 'silver', progress: () => [life().lines, 1000] },
  { id: 'lines-10000', name: 'Ten thousand', description: 'Clear 10,000 lines in total.', category: 'Getting started', tier: 'gold', progress: () => [life().lines, 10000] },
  // 40 Lines
  { id: 'sprint-finish', name: 'Forty', description: 'Finish 40 Lines.', category: '40 Lines', tier: 'bronze' },
  { id: 'sprint-180', name: 'Under three', description: 'Finish 40 Lines in under 3:00.', category: '40 Lines', tier: 'bronze' },
  { id: 'sprint-120', name: 'Under two', description: 'Finish 40 Lines in under 2:00.', category: '40 Lines', tier: 'silver', reward: 'glass' },
  { id: 'sprint-90', name: 'Ninety', description: 'Finish 40 Lines in under 1:30.', category: '40 Lines', tier: 'gold' },
  { id: 'sprint-60', name: 'Sub-minute', description: 'Finish 40 Lines in under 1:00.', category: '40 Lines', tier: 'platinum', reward: 'nes' },
  { id: 'pps-2', name: 'Quick hands', description: 'Finish 40 Lines at 2 pieces per second or faster.', category: '40 Lines', tier: 'gold' },
  // Blitz
  { id: 'blitz-20k', name: 'Warm-up', description: 'Score 20,000 in Blitz.', category: 'Blitz', tier: 'bronze' },
  { id: 'blitz-50k', name: 'Blitzed', description: 'Score 50,000 in Blitz.', category: 'Blitz', tier: 'silver', reward: 'bevel' },
  { id: 'blitz-100k', name: 'Six figures', description: 'Score 100,000 in Blitz.', category: 'Blitz', tier: 'gold' },
  // Marathon
  { id: 'marathon-5', name: 'Pacing', description: 'Reach level 5 in Marathon.', category: 'Marathon', tier: 'bronze' },
  { id: 'marathon-10', name: 'Second wind', description: 'Reach level 10 in Marathon.', category: 'Marathon', tier: 'silver', reward: 'wire' },
  { id: 'marathon-finish', name: 'The distance', description: 'Clear all 150 lines of Marathon.', category: 'Marathon', tier: 'gold' },
  // Endless
  { id: 'endless-100', name: 'Keep going', description: 'Clear 100 lines in one Endless run.', category: 'Endless', tier: 'bronze' },
  { id: 'endless-300', name: 'No end in sight', description: 'Clear 300 lines in one Endless run.', category: 'Endless', tier: 'silver', reward: 'gameboy' },
  // Technique
  { id: 'quad', name: 'Four at once', description: 'Clear four lines with one piece.', category: 'Technique', tier: 'bronze' },
  { id: 'tspin', name: 'Spin', description: 'Clear lines with a T-spin.', category: 'Technique', tier: 'bronze' },
  { id: 'tsd', name: 'Double spin', description: 'Clear two lines with a T-spin.', category: 'Technique', tier: 'silver' },
  { id: 'tst', name: 'Triple spin', description: 'Clear three lines with a T-spin.', category: 'Technique', tier: 'gold' },
  { id: 'combo-5', name: 'Chain', description: 'Reach a 5 combo.', category: 'Technique', tier: 'silver' },
  { id: 'b2b-5', name: 'Back to back', description: 'Keep a back-to-back chain of 5.', category: 'Technique', tier: 'silver' },
  { id: 'perfect', name: 'Clean slate', description: 'Leave the board completely empty after a clear.', category: 'Technique', tier: 'gold' },
  // Versus
  { id: 'versus-win', name: 'First win', description: 'Beat any bot in Versus.', category: 'Versus', tier: 'bronze' },
  { id: 'versus-5', name: 'Halfway up', description: 'Beat a level 5 bot.', category: 'Versus', tier: 'silver', reward: 'brut' },
  { id: 'versus-10', name: 'Top of the ladder', description: 'Beat the level 10 bot.', category: 'Versus', tier: 'gold' },
  { id: 'sweep', name: 'Clean sweep', description: 'Win a first-to-3 match without dropping a round.', category: 'Versus', tier: 'silver' },
  // Cups
  { id: 'cup-foundations', name: 'Foundations', description: 'Win the Foundations cup.', category: 'Cups', tier: 'silver', reward: 'crystal' },
  { id: 'cup-contenders', name: 'Contender', description: 'Win the Contenders cup.', category: 'Cups', tier: 'gold', reward: 'aurora' },
  { id: 'cup-summit', name: 'Summit', description: 'Win the Summit cup.', category: 'Cups', tier: 'platinum', reward: 'ember' },
  // Dedication
  { id: 'hour', name: 'Settled in', description: 'Play for an hour in total.', category: 'Dedication', tier: 'bronze', reward: 'corten', progress: () => [Math.floor(getProfile().playMs / 60000), 60] },
  { id: 'hours-10', name: 'Devoted', description: 'Play for ten hours in total.', category: 'Dedication', tier: 'gold', progress: () => [Math.floor(hours(getProfile().playMs) * 10) / 10, 10] },
  { id: 'level-10', name: 'Regular', description: 'Reach player level 10.', category: 'Dedication', tier: 'silver', progress: () => [levelFor(getProfile().xp).level, 10] },
  { id: 'tourist', name: 'Tourist', description: 'Play a game in five different skins.', category: 'Dedication', tier: 'bronze', progress: () => [life().skins.length, 5] },
];

export const CATEGORIES: Category[] = ['Getting started', '40 Lines', 'Blitz', 'Marathon', 'Endless', 'Technique', 'Versus', 'Cups', 'Dedication'];

// ── State ──────────────────────────────────────────────────────

/** id → when it was earned. */
let earned: Record<string, number> = load<Record<string, number>>('achievements', {});
const listeners = new Set<() => void>();

export function useAchievements(): Record<string, number> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => earned,
  );
}

export function isEarned(id: string): boolean {
  return id in earned;
}

/** True while catching up at start-up: no toasts for what was already earned. */
let catchingUp = false;

function unlock(id: string): void {
  if (id in earned) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  earned = { ...earned, [id]: Date.now() };
  save('achievements', earned);
  listeners.forEach((l) => l());
  if (catchingUp) return;
  toast(`Achievement · ${a.name}`);
  if (a.reward) setTimeout(() => toast(`New skin unlocked · ${a.reward![0].toUpperCase()}${a.reward!.slice(1)}`), 1400);
}

/** Skins are won through achievements; four are open from the start. Developer mode opens them all. */
export function skinUnlocked(skin: string): boolean {
  if (STARTER_SKINS.includes(skin) || devUnlocked()) return true;
  const a = ACHIEVEMENTS.find((x) => x.reward === skin);
  return !a || isEarned(a.id);
}

/** What unlocks a skin, for the lock hint. */
export function skinUnlockHint(skin: string): string {
  const a = ACHIEVEMENTS.find((x) => x.reward === skin);
  return a ? `${a.name}: ${a.description.replace(/\.$/, '')}` : '';
}

// ── What earns them ────────────────────────────────────────────

function checkRun(mode: ModeId, run: RunRecord, finished: boolean): void {
  if (mode === 'sprint' && finished) {
    unlock('sprint-finish');
    if (run.time < 180_000) unlock('sprint-180');
    if (run.time < 120_000) unlock('sprint-120');
    if (run.time < 90_000) unlock('sprint-90');
    if (run.time < 60_000) unlock('sprint-60');
    if (run.pieces / (run.time / 1000) >= 2) unlock('pps-2');
  }
  if (mode === 'blitz') {
    if (run.score >= 20_000) unlock('blitz-20k');
    if (run.score >= 50_000) unlock('blitz-50k');
    if (run.score >= 100_000) unlock('blitz-100k');
  }
  if (mode === 'marathon') {
    if (run.level >= 5) unlock('marathon-5');
    if (run.level >= 10) unlock('marathon-10');
    if (finished) unlock('marathon-finish');
  }
  if (mode === 'endless') {
    if (run.lines >= 100) unlock('endless-100');
    if (run.lines >= 300) unlock('endless-300');
  }
}

function checkTotals(): void {
  const l = life();
  if (l.games >= 1) unlock('first-game');
  if (l.lines >= 100) unlock('lines-100');
  if (l.lines >= 1000) unlock('lines-1000');
  if (l.lines >= 10000) unlock('lines-10000');
  if (l.skins.length >= 5) unlock('tourist');
  const p = getProfile();
  if (hours(p.playMs) >= 1) unlock('hour');
  if (hours(p.playMs) >= 10) unlock('hours-10');
  if (levelFor(p.xp).level >= 10) unlock('level-10');
  for (const [cup, id] of [
    ['foundations', 'cup-foundations'],
    ['contenders', 'cup-contenders'],
    ['summit', 'cup-summit'],
  ] as const) {
    if (p.trophies.some((t) => t.cup === cup && t.place === 1)) unlock(id);
  }
}

/** Live, from the player's own game: lines and technique. */
export function onGameEvent(e: GameEvent): void {
  if (e.type !== 'clear') return;
  const { info } = e;
  if (info.lines > 0) save('lifetime', { ...life(), lines: life().lines + info.lines });
  if (info.lines === 4) unlock('quad');
  if (info.piece === 'T' && info.spin === 'full' && info.lines > 0) {
    unlock('tspin');
    if (info.lines >= 2) unlock('tsd');
    if (info.lines >= 3) unlock('tst');
  }
  if (info.combo >= 5) unlock('combo-5');
  if (info.b2b >= 5) unlock('b2b-5');
  if (info.perfectClear) unlock('perfect');
}

/** A game played, in any mode, in this skin. */
export function onGamePlayed(skin: string): void {
  const l = life();
  save('lifetime', { ...l, games: l.games + 1, skins: l.skins.includes(skin) ? l.skins : [...l.skins, skin] });
  checkTotals();
}

export function onSoloEnd(mode: ModeId, run: RunRecord, finished: boolean, _stats: GameStats): void {
  checkRun(mode, run, finished);
  checkTotals();
}

export function onVersusEnd(botLevel: number, won: boolean, score: [number, number], firstTo: number): void {
  if (!won) return;
  unlock('versus-win');
  if (botLevel >= 5) unlock('versus-5');
  if (botLevel >= 10) unlock('versus-10');
  if (firstTo >= 3 && score[1] === 0) unlock('sweep');
}

/** Catches up with progress made before achievements existed (or on another device). */
function backfill(): void {
  for (const mode of ['sprint', 'blitz', 'marathon', 'endless'] as ModeId[]) {
    const runs = [...loadHistory(mode)];
    const best = loadBest(mode);
    if (best) runs.push(best);
    for (const run of runs) checkRun(mode, run, mode === 'sprint' ? run.lines >= 40 : mode === 'marathon' ? run.lines >= 150 : false);
  }
  for (const bot of BOTS) {
    if (botRecord(bot.id).wins > 0) onVersusEnd(bot.level, true, [1, 1], 1);
  }
  checkTotals();
}

catchingUp = true;
backfill();
catchingUp = false;

// Level, play time and cups live in the profile: check whenever it changes.
subscribeProfile(() => checkTotals());
