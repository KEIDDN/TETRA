import { useEffect, useRef, useState } from 'react';
import { TRACKS, TRACK_BY_ID, type MusicSlot, type Track } from '../audio/catalog';
import { director } from '../audio/director';
import { music } from '../audio/music';
import { sfx } from '../audio/sfx';
import { SKIN_ORDER, SKINS, type SkinId } from '../game/skins';
import { assignTrack, bpmOf, exportPrefs, resetMusicPrefs, setBpm, setRejected, useMusicPrefs } from '../lib/musicPrefs';
import { useMenuNav } from '../lib/nav';
import { SkinSwatch } from '../ui/SkinSwatch';
import { toast } from '../ui/toast';
import { Glyph } from '../ui/Glyph';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const SLOTS: MusicSlot[] = ['menu', ...SKIN_ORDER];
type Filter = 'all' | 'open' | 'rejected';

function slotName(slot: MusicSlot): string {
  return slot === 'menu' ? 'Menu' : SKINS[slot].name;
}

function time(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** Developer-only: audition the shortlist, in a live game if you like, and decide what plays where. */
export function MusicLab({ onBack, onTry }: { onBack: () => void; onTry: (skin: SkinId) => void }) {
  const prefs = useMusicPrefs();
  const [playing, setPlaying] = useState<string | null>(director.pinnedId);
  const [filter, setFilter] = useState<Filter>('all');
  const [exported, setExported] = useState<string | null>(null);
  const leave = () => {
    director.pin(null);
    onBack();
  };
  useMenuNav(leave, true);
  // Audio needs a gesture; arriving here usually was one, but make sure.
  useEffect(() => sfx.unlock(), []);

  const audition = (id: string) => {
    sfx.unlock();
    const next = playing === id ? null : id;
    director.pin(next);
    setPlaying(next);
  };

  const slotsOf = (id: string) => SLOTS.filter((s) => prefs.assign[s] === id);
  const rejected = new Set(prefs.rejected);
  const tracks = TRACKS.filter((t) => (filter === 'rejected' ? rejected.has(t.id) : filter === 'open' ? !rejected.has(t.id) && slotsOf(t.id).length === 0 : true));
  const current = playing ? TRACK_BY_ID[playing] : null;
  const assigned = SLOTS.filter((s) => prefs.assign[s]).length;

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div className="relative mx-auto w-full max-w-[1320px] px-6 pb-32 sm:px-10">
        <header className="flex h-24 items-center justify-between">
          <button data-nav onClick={leave} className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted hover:text-fg ${focusRing}`}>
            ← Back <Glyph k="back" className="label ml-2" />
          </button>
          <span className="label">Music lab · developer</span>
        </header>

        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h1 className="text-[clamp(44px,6vw,84px)] leading-[1.04] font-[480] tracking-[-0.045em]">Music lab</h1>
            <p className="mt-4 max-w-[620px] text-[16px] leading-relaxed text-muted">
              {TRACKS.length} tracks with checked licenses. Play one, try it in a game with any skin, and assign it to the menu or a skin. When you are
              done, export and send me the result.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const json = exportPrefs();
                setExported(json);
                void navigator.clipboard?.writeText(json).then(() => toast('Copied to clipboard'), () => {});
              }}
              className={`rounded-full bg-accent px-5 py-3 text-[14px] font-semibold text-black ${focusRing}`}
            >
              Export
            </button>
            <button onClick={() => confirm('Reset every assignment to the suggestions?') && resetMusicPrefs()} className={`hairline rounded-full bg-tile px-5 py-3 text-[14px] font-medium ${focusRing}`}>
              Reset
            </button>
          </div>
        </div>

        <NowPlayingPanel track={current} onStop={() => current && audition(current.id)} />

        <section className="mt-12">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <span className="label">Slots</span>
            <span className="label tabular">
              {assigned} / {SLOTS.length} assigned
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
            {SLOTS.map((slot) => {
              const t = prefs.assign[slot] ? TRACK_BY_ID[prefs.assign[slot]!] : null;
              return (
                <div key={slot} className="hairline flex flex-col gap-3 rounded-[24px] bg-tile p-4">
                  <div className="flex h-[30px] items-center">{slot === 'menu' ? <span className="text-[20px] leading-none text-muted">♪</span> : <SkinSwatch skin={SKINS[slot]} cell={9} />}</div>
                  <div className="min-w-0">
                    <div className="label">{slotName(slot)}</div>
                    <div className={`mt-1 truncate text-[14px] font-medium ${t ? '' : 'text-faint'}`}>{t ? t.title : 'Nothing yet'}</div>
                    <div className="truncate text-[12px] text-faint">{t?.artist ?? '—'}</div>
                  </div>
                  <div className="mt-auto flex gap-1.5">
                    {t && (
                      <button onClick={() => audition(t.id)} className="hairline flex-1 rounded-full py-1.5 text-[12px] font-medium hover:bg-white/[0.06]">
                        {playing === t.id ? 'Stop' : 'Play'}
                      </button>
                    )}
                    {slot !== 'menu' && (
                      <button
                        onClick={() => {
                          if (t && playing !== t.id) audition(t.id);
                          onTry(slot);
                        }}
                        className="flex-1 rounded-full bg-white/10 py-1.5 text-[12px] font-medium hover:bg-white/15"
                      >
                        Try
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-14">
          <div className="flex items-end justify-between border-b border-line pb-3">
            <span className="label">Shortlist</span>
            <div className="hairline inline-flex rounded-full bg-tile p-1">
              {(['all', 'open', 'rejected'] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-[12px] font-medium ${filter === f ? 'bg-accent text-black' : 'text-muted'}`}>
                  {f === 'all' ? 'All' : f === 'open' ? 'Unassigned' : 'Rejected'}
                </button>
              ))}
            </div>
          </div>
          <ol className="mt-2">
            {tracks.map((t) => (
              <TrackRow
                key={t.id}
                track={t}
                playing={playing === t.id}
                rejected={rejected.has(t.id)}
                slots={slotsOf(t.id)}
                bpm={bpmOf(t)}
                onPlay={() => audition(t.id)}
                onAssign={(slot) => assignTrack(slot, t.id)}
                onReject={(r) => setRejected(t.id, r)}
                onTry={(skin) => {
                  if (playing !== t.id) audition(t.id);
                  onTry(skin);
                }}
              />
            ))}
          </ol>
        </section>

        {exported && (
          <section className="mt-12">
            <div className="label mb-3">Export · paste this back to Claude</div>
            <textarea readOnly value={exported} className="hairline h-56 w-full rounded-[20px] bg-black/50 p-4 font-mono text-[12px] text-muted outline-none" onFocus={(e) => e.currentTarget.select()} />
          </section>
        )}
      </div>
    </div>
  );
}

function TrackRow({
  track,
  playing,
  rejected,
  slots,
  bpm,
  onPlay,
  onAssign,
  onReject,
  onTry,
}: {
  track: Track;
  playing: boolean;
  rejected: boolean;
  slots: MusicSlot[];
  bpm: number | null;
  onPlay: () => void;
  onAssign: (slot: MusicSlot) => void;
  onReject: (rejected: boolean) => void;
  onTry: (skin: SkinId) => void;
}) {
  const trySkin: SkinId = track.suggest === 'menu' ? 'studio' : track.suggest;
  return (
    <li
      className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 rounded-[18px] px-3 py-3 transition-colors lg:grid-cols-[40px_minmax(0,1.4fr)_minmax(0,1fr)_auto] ${
        playing ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]'
      } ${rejected ? 'opacity-40' : ''}`}
    >
      <button onClick={onPlay} className={`grid size-10 place-items-center rounded-full ${playing ? 'bg-accent text-black' : 'hairline bg-tile'} ${focusRing}`} aria-label={playing ? 'Stop' : 'Play'}>
        {playing ? <StopGlyph /> : <PlayGlyph />}
      </button>
      <div className="min-w-0">
        <div className="truncate text-[16px] font-medium tracking-[-0.01em]">{track.title}</div>
        <div className="truncate text-[13px] text-faint">
          {track.artist} · {track.album}
        </div>
      </div>
      <div className="hidden min-w-0 flex-wrap items-center gap-x-4 gap-y-1 lg:flex">
        <span className="label">{track.mood}</span>
        <span className="label tabular">{time(track.duration)}</span>
        <span className="label tabular">{bpm ? `${bpm} BPM` : 'no pulse'}</span>
        <a href={track.source} target="_blank" rel="noreferrer" className="label underline-offset-2 hover:text-fg hover:underline">
          {track.license}
        </a>
      </div>
      <div className="flex items-center gap-2">
        {slots.map((s) => (
          <span key={s} className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-black">
            {slotName(s)}
          </span>
        ))}
        <select
          value=""
          onChange={(e) => e.target.value && onAssign(e.target.value as MusicSlot)}
          className="hairline cursor-pointer rounded-full bg-tile px-3 py-1.5 text-[12px] font-medium text-muted outline-none"
        >
          <option value="">Assign…</option>
          {SLOTS.map((s) => (
            <option key={s} value={s}>
              {slotName(s)}
              {s === track.suggest ? ' · suggested' : ''}
            </option>
          ))}
        </select>
        <button onClick={() => onTry(trySkin)} className="hidden rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium hover:bg-white/15 sm:block" title={`Play a game with ${SKINS[trySkin].name}`}>
          Try
        </button>
        <button onClick={() => onReject(!rejected)} className="rounded-full px-2 py-1.5 text-[12px] text-faint hover:text-fg" title={rejected ? 'Bring back' : 'Reject'}>
          {rejected ? 'Undo' : '✕'}
        </button>
      </div>
    </li>
  );
}

/** The playing track with its live analysis: what the scenes see. */
function NowPlayingPanel({ track, onStop }: { track: Track | null; onStop: () => void }) {
  const bars = useRef<(HTMLDivElement | null)[]>([]);
  const progress = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const b = music.analyse();
      [b.low, b.mid, b.high, b.beat].forEach((v, i) => {
        const el = bars.current[i];
        if (el) el.style.transform = `scaleY(${Math.max(0.04, v)})`;
      });
      const { time: t, duration } = music.position;
      if (progress.current) progress.current.style.width = `${duration ? (t / duration) * 100 : 0}%`;
      if (clock.current) clock.current.textContent = `${time(t)} / ${time(duration)}`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <section className="mt-10 grid items-center gap-8 rounded-[36px] bg-gradient-to-b from-[#19191c] to-[#0f0f11] p-7 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="label">{track ? 'Now playing · pinned everywhere' : 'Nothing pinned · the menu track plays'}</div>
        <div className="mt-2 truncate text-[32px] leading-tight font-medium tracking-[-0.03em]">{track?.title ?? '—'}</div>
        <div className="truncate text-[15px] text-muted">{track ? `${track.artist} · ${track.license}` : 'Press play on any track below.'}</div>
        <div className="mt-5 flex items-center gap-4">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div ref={progress} className="h-full rounded-full bg-accent" />
          </div>
          <span ref={clock} className="label tabular" />
        </div>
        {track && <BpmControls track={track} />}
      </div>
      <div className="flex items-end gap-5">
        {['Low', 'Mid', 'High', 'Beat'].map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className="relative h-24 w-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div ref={(el) => void (bars.current[i] = el)} className="absolute inset-0 origin-bottom rounded-full" style={{ background: i === 3 ? '#ffb340' : '#edebfa' }} />
            </div>
            <span className="label">{label}</span>
          </div>
        ))}
        {track && (
          <button onClick={onStop} className="hairline ml-2 rounded-full bg-tile px-4 py-2 text-[13px] font-medium">
            Unpin
          </button>
        )}
      </div>
    </section>
  );
}

/** The estimate can be off by half or double, and ambient has no pulse at all: fix it by ear. */
function BpmControls({ track }: { track: Track }) {
  const bpm = bpmOf(track);
  const taps = useRef<number[]>([]);
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 4) {
      const gaps = taps.current.slice(1).map((t, i) => t - taps.current[i]);
      setBpm(track.id, Math.round((60000 / (gaps.reduce((a, b) => a + b) / gaps.length)) * 2) / 2);
    }
  };
  const btn = 'hairline rounded-full bg-tile px-3 py-1 text-[12px] font-medium hover:bg-white/[0.08]';
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="label mr-1 tabular">{bpm ? `${bpm} BPM` : 'No pulse'}</span>
      <button className={btn} onClick={() => bpm && setBpm(track.id, bpm / 2)}>
        ½×
      </button>
      <button className={btn} onClick={() => bpm && setBpm(track.id, bpm * 2)}>
        2×
      </button>
      <button className={btn} onClick={() => setBpm(track.id, null)}>
        No pulse
      </button>
      <button className={btn} onClick={tap} title="Tap along four times or more">
        Tap
      </button>
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
      <path d="M1 1.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 1 1.5Z" />
    </svg>
  );
}

function StopGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="1" y="1" width="10" height="10" rx="2" />
    </svg>
  );
}
