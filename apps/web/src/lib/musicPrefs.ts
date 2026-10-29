import { useSyncExternalStore } from 'react';
import { TRACK_BY_ID, TRACKS, type MusicSlot, type Track } from '../audio/catalog';
import { load, save } from './storage';

/** What the Music lab decides: a track per slot, the ones thrown out, and BPM corrections. */
export interface MusicPrefs {
  assign: Partial<Record<MusicSlot, string>>;
  rejected: string[];
  /** Overrides the catalog's estimate; null means "no steady pulse". */
  bpm: Record<string, number | null>;
}

function defaults(): MusicPrefs {
  const assign: Partial<Record<MusicSlot, string>> = {};
  for (const t of TRACKS) assign[t.suggest] ??= t.id;
  return { assign, rejected: [], bpm: {} };
}

/** Saved choices, minus tracks that left the catalog; new slots get their default. */
function restore(): MusicPrefs {
  const base = defaults();
  const saved = load<Partial<MusicPrefs>>('music.v4', {});
  const assign = { ...base.assign };
  for (const [slot, id] of Object.entries(saved.assign ?? {})) if (id && TRACK_BY_ID[id]) assign[slot as MusicSlot] = id;
  return { ...base, ...saved, assign };
}

let prefs: MusicPrefs = restore();
const listeners = new Set<() => void>();

function commit(next: MusicPrefs): void {
  prefs = next;
  save('music.v4', prefs);
  listeners.forEach((l) => l());
}

export function getMusicPrefs(): MusicPrefs {
  return prefs;
}

export function useMusicPrefs(): MusicPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getMusicPrefs,
  );
}

export function subscribeMusicPrefs(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function assignTrack(slot: MusicSlot, id: string | null): void {
  const assign = { ...prefs.assign };
  if (id) assign[slot] = id;
  else delete assign[slot];
  commit({ ...prefs, assign, rejected: id ? prefs.rejected.filter((r) => r !== id) : prefs.rejected });
}

export function setRejected(id: string, rejected: boolean): void {
  const assign = Object.fromEntries(Object.entries(prefs.assign).filter(([, v]) => !rejected || v !== id));
  commit({ ...prefs, assign, rejected: rejected ? [...new Set([...prefs.rejected, id])] : prefs.rejected.filter((r) => r !== id) });
}

export function setBpm(id: string, bpm: number | null): void {
  commit({ ...prefs, bpm: { ...prefs.bpm, [id]: bpm } });
}

export function resetMusicPrefs(): void {
  commit(defaults());
}

export function trackFor(slot: MusicSlot): Track | null {
  const id = prefs.assign[slot];
  return (id && TRACK_BY_ID[id]) || null;
}

/** Skins that have no track of their own yet borrow one from a kindred room. */
const STAND_IN: Partial<Record<MusicSlot, MusicSlot>> = { glass: 'crystal', brut: 'bevel', corten: 'ember' };

/** The track a skin plays: its own, a stand-in's, or the house track. */
export function skinTrack(skin: MusicSlot): Track | null {
  const standIn = STAND_IN[skin];
  return trackFor(skin) ?? (standIn && trackFor(standIn)) ?? trackFor('studio');
}

export function bpmOf(track: Track): number | null {
  return track.id in prefs.bpm ? prefs.bpm[track.id] : track.bpm;
}

/** Tracks the player can hear: every assigned one (unlocks arrive with the library). */
export function playable(): Track[] {
  const ids = new Set(Object.values(prefs.assign));
  return TRACKS.filter((t) => ids.has(t.id));
}

/** The lab's decisions as JSON, to paste back into the catalog. */
export function exportPrefs(): string {
  return JSON.stringify(prefs, null, 2);
}
