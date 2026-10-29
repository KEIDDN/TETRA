import { TRACKS, type Track } from '../audio/catalog';
import { SKINS, type SkinId } from '../game/skins';
import { getProfile, levelFor, subscribeProfile } from './profile';
import { getSettings } from './settings';
import { skinLocked } from './tournament';
import { skinUnlockHint } from './achievements';
import { toast } from '../ui/toast';

/** Menu tracks after the first open up with profile levels, in catalog order. */
const MENU_LEVELS = [3, 5, 8, 12, 16];
const MENU_TRACKS = TRACKS.filter((t) => t.suggest === 'menu');

/** Whether a track is yours, and if not, what opens it. */
export function trackAccess(t: Track): { unlocked: boolean; hint: string } {
  if (getSettings().developer) return { unlocked: true, hint: '' };
  if (t.suggest === 'menu') {
    const i = MENU_TRACKS.indexOf(t);
    const level = i <= 0 ? 1 : MENU_LEVELS[Math.min(i - 1, MENU_LEVELS.length - 1)];
    return { unlocked: levelFor(getProfile().xp).level >= level, hint: `Reach level ${level}` };
  }
  const skin = t.suggest as SkinId;
  return { unlocked: !skinLocked(skin), hint: skinLocked(skin) ? `${SKINS[skin].name} skin · ${skinUnlockHint(skin)}` : '' };
}

export function trackUnlocked(t: Track): boolean {
  return trackAccess(t).unlocked;
}

// Tell the player when a level opens a new track.
let known = new Set(TRACKS.filter(trackUnlocked).map((t) => t.id));
subscribeProfile(() => {
  const now = TRACKS.filter(trackUnlocked);
  const fresh = now.filter((t) => !known.has(t.id));
  known = new Set(now.map((t) => t.id));
  for (const t of fresh) toast(`New track unlocked · ${t.title}`);
});
