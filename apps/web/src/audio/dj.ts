import type { Game, GameEvent } from '@tetra/engine';
import { music } from './music';

/** How high the stack stands, 0–1. */
function stackHeight(game: Game): number {
  for (let y = 21; y >= 0; y--) if (game.board.row(y).some((c) => c !== 0)) return (y + 1) / 20;
  return 0;
}

/**
 * The game playing DJ on the music: sessions call these and the Club does
 * the rest (filter with danger, highs with combo, throws on big clears).
 */
export const dj = {
  tick(game: Game): void {
    const club = music.club;
    if (!club) return;
    club.setDanger(Math.min(1, stackHeight(game)));
    club.setCombo(game.stats.combo);
  },
  event(e: GameEvent): void {
    if (e.type !== 'clear') return;
    const { lines, spin, perfectClear, b2b } = e.info;
    if (lines >= 4 || (spin === 'full' && lines > 0) || perfectClear) music.club?.throw(lines + (spin === 'full' ? 2 : 0) + (perfectClear ? 4 : 0) + (b2b > 0 ? 1 : 0), music.bpm);
  },
  paused(p: boolean): void {
    music.club?.setPaused(p);
  },
  reset(): void {
    music.club?.reset();
  },
};
