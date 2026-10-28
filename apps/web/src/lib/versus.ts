import { BOTS, type BotProfile } from '@tetra/bot';
import { getSettings } from './settings';
import { load, save } from './storage';

export interface BotRecord {
  wins: number;
  losses: number;
  roundsWon: number;
  roundsLost: number;
}

const EMPTY: BotRecord = { wins: 0, losses: 0, roundsWon: 0, roundsLost: 0 };

export function botRecord(id: string): BotRecord {
  return { ...EMPTY, ...load<Partial<BotRecord>>(`versus.${id}`, {}) };
}

export function recordMatch(id: string, won: boolean, roundsWon: number, roundsLost: number): void {
  const r = botRecord(id);
  save(`versus.${id}`, {
    wins: r.wins + (won ? 1 : 0),
    losses: r.losses + (won ? 0 : 1),
    roundsWon: r.roundsWon + roundsWon,
    roundsLost: r.roundsLost + roundsLost,
  });
}

/** Developer mode (5 taps on the version) or ?dev=1 in the URL unlocks everything. */
export function devUnlocked(): boolean {
  return getSettings().developer || new URLSearchParams(location.search).has('dev');
}

/** A bot is open once the one before it has been beaten. */
export function isUnlocked(bot: BotProfile): boolean {
  if (bot.level === 1 || devUnlocked()) return true;
  const previous = BOTS.find((b) => b.level === bot.level - 1);
  return !!previous && botRecord(previous.id).wins > 0;
}
