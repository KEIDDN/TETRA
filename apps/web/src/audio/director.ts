import type { SkinId } from '../game/skins';
import { bpmOf, playable, subscribeMusicPrefs, trackFor } from '../lib/musicPrefs';
import { getSettings, subscribeSettings } from '../lib/settings';
import { TRACK_BY_ID, type Track } from './catalog';
import { music } from './music';

type Context = { kind: 'menu' } | { kind: 'game'; skin: SkinId };

/**
 * Decides what plays: the menu track across every menu (no restart between
 * screens), the skin's track in a game, or shuffle. The Music lab can pin a
 * track over all of it.
 */
class Director {
  private context: Context = { kind: 'menu' };
  private pinned: Track | null = null;
  private shuffled: Track | null = null;

  constructor() {
    subscribeSettings(() => this.apply());
    subscribeMusicPrefs(() => this.apply());
    music.onEnded(() => {
      this.shuffled = null;
      this.apply();
    });
    this.apply();
  }

  enterMenu(): void {
    if (this.context.kind === 'menu') return;
    this.context = { kind: 'menu' };
    this.shuffled = null;
    music.club?.reset();
    this.apply();
  }

  enterGame(skin: SkinId): void {
    if (this.context.kind === 'game' && this.context.skin === skin) return;
    this.context = { kind: 'game', skin };
    this.shuffled = null;
    this.apply();
  }

  /** Lab: play this track everywhere until unpinned. */
  pin(id: string | null): void {
    this.pinned = id ? TRACK_BY_ID[id] ?? null : null;
    this.apply();
  }

  get pinnedId(): string | null {
    return this.pinned?.id ?? null;
  }

  private apply(): void {
    const { audio, experience } = getSettings();
    music.setVolume(audio.enabled ? audio.music : 0);
    music.setExperience(experience && audio.club ? (audio.output === 'headphones' ? 'binaural' : 'club') : 'off', experience && audio.dj);
    if (this.pinned) return music.play(this.pinned, { bpm: bpmOf(this.pinned) });
    if (!audio.enabled || audio.music === 0 || audio.musicMode === 'off') return music.play(null);
    if (this.context.kind === 'menu') {
      const t = trackFor('menu');
      music.prefetch(t);
      // Fetch the next game's music while the player is still choosing.
      if (audio.musicMode === 'skin') music.prefetch(trackFor(getSettings().appearance.skin) ?? trackFor('studio'));
      return music.play(t, { bpm: t ? bpmOf(t) : null });
    }
    if (audio.musicMode === 'shuffle') {
      if (!this.shuffled) {
        const pool = playable().filter((t) => t.id !== music.current?.id);
        this.shuffled = pool[Math.floor(Math.random() * pool.length)] ?? null;
      }
      return music.play(this.shuffled, { bpm: this.shuffled ? bpmOf(this.shuffled) : null, loop: false });
    }
    const t = trackFor(this.context.skin) ?? trackFor('studio');
    music.play(t, { bpm: t ? bpmOf(t) : null });
  }
}

export const director = new Director();
