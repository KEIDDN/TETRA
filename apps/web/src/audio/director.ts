import type { SkinId } from '../game/skins';
import { bpmOf, getMusicPrefs, playable, skinTrack, subscribeMusicPrefs, trackFor } from '../lib/musicPrefs';
import { getSettings, subscribeSettings } from '../lib/settings';
import { trackUnlocked } from '../lib/library';
import { TRACK_BY_ID, TRACKS, type Track } from './catalog';
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
    // No track ever loops back on itself: near the end, the next one is mixed in like a DJ set.
    music.onNearEnd(() => this.continueSet());
    music.onEnded(() => this.continueSet(true));
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

  /** Recently played, so the set doesn't repeat itself. */
  private history: string[] = [];

  private continueSet(abrupt = false): void {
    const current = music.current;
    if (!current) return;
    this.history = [current.id, ...this.history.filter((id) => id !== current.id)].slice(0, 4);
    const next = this.nextAfter(current);
    if (!next) return;
    this.shuffled = next;
    if (abrupt) music.play(next, { bpm: bpmOf(next), fade: 0.8 });
    else music.mixTo(next, bpmOf(next));
  }

  /**
   * What follows `current`: the same track again (each skin and the menu own
   * their track, looped with a crossfade), or in Shuffle the next of the set:
   * same room, not recently heard, closest in tempo.
   */
  private nextAfter(current: Track): Track | null {
    if (getSettings().audio.musicMode !== 'shuffle' || this.context.kind === 'menu' || this.pinned) return current;
    const pool = TRACKS.filter((t) => t.suggest !== 'menu' && !getMusicPrefs().rejected.includes(t.id) && trackUnlocked(t));
    const fresh = pool.filter((t) => !this.history.includes(t.id));
    const candidates = fresh.length ? fresh : pool.filter((t) => t.id !== current.id);
    if (!candidates.length) return current;
    const bpm = bpmOf(current) ?? 124;
    candidates.sort((a, b) => Math.abs((bpmOf(a) ?? bpm) - bpm) - Math.abs((bpmOf(b) ?? bpm) - bpm) + (Math.random() - 0.5) * 4);
    return candidates[0];
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
      const t = this.shuffled && this.shuffled.suggest === 'menu' && music.current?.id === this.shuffled.id ? this.shuffled : trackFor('menu');
      music.prefetch(t);
      // Fetch the next game's music while the player is still choosing.
      if (audio.musicMode === 'skin') music.prefetch(skinTrack(getSettings().appearance.skin));
      return music.play(t, { bpm: t ? bpmOf(t) : null });
    }
    if (audio.musicMode === 'shuffle') {
      if (!this.shuffled) {
        const pool = playable().filter((t) => t.id !== music.current?.id && trackUnlocked(t));
        this.shuffled = pool[Math.floor(Math.random() * pool.length)] ?? null;
      }
      return music.play(this.shuffled, { bpm: this.shuffled ? bpmOf(this.shuffled) : null });
    }
    const t = skinTrack(this.context.skin);
    // Once the set has moved past the skin's track, settings changes keep the set going.
    if (this.shuffled && music.current?.id === this.shuffled.id) return;
    music.play(t, { bpm: t ? bpmOf(t) : null });
  }
}

export const director = new Director();
