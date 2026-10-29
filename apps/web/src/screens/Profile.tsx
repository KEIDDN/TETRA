import { BOTS } from '@tetra/bot';
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { SOUND_PACK_NAMES, sfx } from '../audio/sfx';
import { MODE_CONFIGS, MODE_ORDER } from '../game/modes';
import { hexToNumber, SKIN_ORDER, SKINS, type SkinId } from '../game/skins';
import { useMenuNav } from '../lib/nav';
import { favouriteSkin, levelFor, setName, titleFor, useProfile, type Trophy } from '../lib/profile';
import { updateSettings, useSettings } from '../lib/settings';
import { loadBest, loadHistory } from '../lib/storage';
import { CUPS, cupWon, skinLocked } from '../lib/tournament';
import { botRecord } from '../lib/versus';
import { DemoBoard } from '../ui/DemoBoard';
import { SkinSwatch } from '../ui/SkinSwatch';
import { Segmented } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { LevelRing } from '../ui/LevelRing';
import { Sparkline } from '../ui/Sparkline';
import { TRACKS } from '../audio/catalog';
import { assignTrack, getMusicPrefs, subscribeMusicPrefs } from '../lib/musicPrefs';
import { trackAccess, trackUnlocked } from '../lib/library';
import { director } from '../audio/director';
import { ACHIEVEMENTS, CATEGORIES, skinUnlockHint, useAchievements, type Achievement, type Tier } from '../lib/achievements';
import { deleteAccount, downloadMyData, signOut, useAccount } from '../lib/account';
import { Glyph } from '../ui/Glyph';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const CUP_TINT: Record<string, string> = { foundations: '#5ac8f5', contenders: '#c86bff', summit: '#ffb84a', custom: '#edebfa' };

export type ProfileSection = 'skins';
type Tab = 'overview' | 'records' | 'achievements' | 'locker' | 'music' | 'trophies' | 'leaderboards';

const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['records', 'Records'],
  ['achievements', 'Achievements'],
  ['locker', 'Locker'],
  ['music', 'Music'],
  ['trophies', 'Trophies'],
  ['leaderboards', 'Leaderboards'],
];

function formatPlaytime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`;
}

export function Profile({
  onBack,
  onSignIn,
  onPrivacy,
  section,
}: {
  onBack: () => void;
  onSignIn?: () => void;
  onPrivacy?: () => void;
  section?: ProfileSection;
}) {
  const profile = useProfile();
  const { xp, trophies } = profile;
  const { level, into, needed } = levelFor(xp);
  const [tab, setTab] = useState<Tab>(section === 'skins' ? 'locker' : 'overview');
  const [editing, setEditing] = useState(false);
  useMenuNav(onBack, !editing);
  const favourite = favouriteSkin();

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div className="relative mx-auto w-full max-w-[1240px] px-6 pb-24 sm:px-10">
        <header className="flex h-24 items-center justify-between">
          <button data-nav onClick={onBack} className={`glass rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`}>
            <span className="flex items-center gap-2">
              <Icon name="back" size={11} /> Back <Glyph k="back" className="text-white/40" />
            </span>
          </button>
          <span className="label">Profile</span>
        </header>

        <AccountBar onSignIn={onSignIn} onPrivacy={onPrivacy} />

        {/* Player card */}
        <section className="glass-panel animate-rise grid items-center gap-10 rounded-[40px] p-8 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <div className="[view-transition-name:level-ring]">
            <LevelRing level={level} progress={into / needed} />
          </div>
          <div className="min-w-0">
            <div className="label">
              {titleFor(level)} · Level {level}
            </div>
            <PlayerName name={profile.name} editing={editing} setEditing={setEditing} />
            <div className="mt-5 flex max-w-[420px] items-center gap-4">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700 ease-spring"
                  style={{ width: `${(into / needed) * 100}%` }}
                />
              </div>
              <span className="tabular shrink-0 text-[12px] text-faint">
                {needed - into} XP to {level + 1}
              </span>
            </div>
          </div>
          <div className="md:border-l md:border-line md:pl-10">
            <div className="label">Time played</div>
            <div className="tabular mt-2 text-[clamp(40px,4.4vw,64px)] leading-none font-[480] tracking-[-0.04em]">
              {formatPlaytime(profile.playMs)}
            </div>
            <div className="mt-3 text-[13px] text-muted">
              {profile.games.toLocaleString('en-US')} games
              {favourite && SKINS[favourite as SkinId] ? ` · Favourite: ${SKINS[favourite as SkinId].name}` : ''}
            </div>
          </div>
        </section>

        <div className="mt-10 mb-8">
          <Segmented value={tab} onChange={setTab} options={TABS} />
        </div>

        <div key={tab} className="animate-fade">
          {tab === 'overview' && <Overview />}
          {tab === 'records' && <Records />}
          {tab === 'achievements' && <Achievements />}
          {tab === 'locker' && <Locker />}
          {tab === 'music' && <Library />}
          {tab === 'trophies' && <Trophies trophies={trophies} />}
          {tab === 'leaderboards' && <Leaderboards />}
        </div>
      </div>
    </div>
  );
}

/** Who is signed in, or a reminder that a guest's progress isn't kept. */
function AccountBar({ onSignIn, onPrivacy }: { onSignIn?: () => void; onPrivacy?: () => void }) {
  const account = useAccount();
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (account.mode === 'local') return null;
  if (account.mode === 'user') {
    const link = `rounded-sm text-[13px] text-muted transition-colors hover:text-fg ${focusRing}`;
    return (
      <div className="mb-5 px-2">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-muted">
          <span className="min-w-0 truncate">
            Signed in as <span className="text-fg">{account.email ?? 'your account'}</span> · progress saved
          </span>
          <div className="flex items-center gap-5">
            <button data-nav onClick={downloadMyData} className={link}>
              Download my data
            </button>
            {onPrivacy && (
              <button data-nav onClick={onPrivacy} className={link}>
                Privacy
              </button>
            )}
            <button data-nav onClick={() => setConfirming(true)} className={`${link} hover:text-[#ff6b6b]`}>
              Delete account
            </button>
            <button
              data-nav
              disabled={leaving}
              onClick={() => {
                setLeaving(true);
                void signOut();
              }}
              className={`glass shrink-0 rounded-full px-4 py-2 text-[13px] font-medium text-fg disabled:opacity-50 ${focusRing}`}
            >
              {leaving ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
        {confirming && (
          <div className="glass-panel animate-rise mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[24px] px-6 py-4">
            <span className="text-[14px] text-white/70">
              Delete your account and everything in it? <span className="text-fg">This can't be undone.</span>
              {error && <span className="ml-2 text-[#ff6b6b]">{error}</span>}
            </span>
            <span className="flex items-center gap-3">
              <button data-nav onClick={() => setConfirming(false)} className={`rounded-full px-4 py-2 text-[13px] text-muted hover:text-fg ${focusRing}`}>
                Keep it
              </button>
              <button
                data-nav
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  void deleteAccount().then((message) => {
                    setLeaving(false);
                    setError(message);
                  });
                }}
                className={`rounded-full bg-[#ff453a] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50 ${focusRing}`}
              >
                {leaving ? 'Deleting…' : 'Delete for good'}
              </button>
            </span>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="glass-panel mb-5 flex items-center justify-between gap-4 rounded-[24px] px-6 py-4">
      <span className="text-[14px] text-white/70">Playing as guest: your progress isn't saved.</span>
      {onSignIn && (
        <button data-nav onClick={onSignIn} className={`glass-light shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${focusRing}`}>
          Sign in →
        </button>
      )}
    </div>
  );
}

/** Placeholder until online rankings arrive. */
function Leaderboards() {
  return (
    <div className="glass-panel grid place-items-center rounded-[32px] px-8 py-24 text-center">
      <span className="font-mono text-[11px] tracking-[0.24em] text-white/45 uppercase">Coming soon</span>
      <h3 className="mt-4 text-[clamp(28px,3vw,40px)] leading-[1.06] font-[560] tracking-[-0.04em]">Leaderboards.</h3>
      <p className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-muted">
        Your best runs in every mode, next to players around the world. Signed-in records will count.
      </p>
    </div>
  );
}

/** The player's name, edited in place. */
function PlayerName({ name, editing, setEditing }: { name: string; editing: boolean; setEditing: (on: boolean) => void }) {
  const [draft, setDraft] = useState(name);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={24}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setName(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="mt-2 w-full max-w-[520px] border-b border-accent/60 bg-transparent text-[clamp(40px,4.6vw,68px)] leading-[1.05] font-[520] tracking-[-0.045em] outline-none"
      />
    );
  }
  return (
    <button
      data-nav
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      className={`group mt-2 flex max-w-full items-baseline gap-3 text-left ${focusRing}`}
      title="Change your name"
    >
      <span className="truncate text-[clamp(40px,4.6vw,68px)] leading-[1.05] font-[520] tracking-[-0.045em]">{name}</span>
      <span className="text-[13px] text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Edit</span>
    </button>
  );
}

function Overview() {
  const { xp, trophies, games } = useProfile();
  const versusWins = BOTS.reduce((n, b) => n + botRecord(b.id).wins, 0);
  const unlocked = SKIN_ORDER.filter((id) => !skinLocked(id)).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label="Total XP" value={xp.toLocaleString('en-US')} />
        <Tile label="Games" value={games.toLocaleString('en-US')} />
        <Tile label="Versus wins" value={String(versusWins)} />
        <Tile label="Cups won" value={`${CUPS.filter((c) => cupWon(c.id)).length} / ${CUPS.length}`} />
        <Tile label="Trophies" value={String(trophies.length)} />
        <Tile label="Skins" value={`${unlocked} / ${SKIN_ORDER.length}`} />
      </div>
      <div className="label mt-10 mb-3 px-1">Personal bests</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {MODE_ORDER.map((mode) => {
          const best = loadBest(mode);
          return <Tile key={mode} label={MODE_CONFIGS[mode].def.name} value={best ? MODE_CONFIGS[mode].formatRecord(best) : '—'} />;
        })}
      </div>
    </>
  );
}

/** Every mode's recent runs as a line, best marked. */
function Records() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {MODE_ORDER.map((mode) => {
        const config = MODE_CONFIGS[mode];
        const runs = loadHistory(mode);
        const byTime = mode === 'sprint';
        const values = runs.map((r) => (byTime ? r.time : r.score));
        const best = loadBest(mode);
        return (
          <div key={mode} className="glass-panel rounded-[28px] p-6">
            <div className="flex items-baseline justify-between">
              <span className="text-[18px] font-medium tracking-[-0.02em]">{config.def.name}</span>
              <span className="label">{runs.length} runs</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tabular text-[32px] leading-tight font-[480] tracking-[-0.03em]">{best ? config.formatRecord(best) : '—'}</span>
              <span className="label">Best</span>
            </div>
            <Sparkline values={values} lowerIsBetter={byTime} />
          </div>
        );
      })}
    </div>
  );
}


/** Every track TETRA plays: listen, pick the menu track, see who made it. */
function Library() {
  const prefs = useSyncExternalStore(subscribeMusicPrefs, getMusicPrefs);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => director.pin(null), []);
  const listen = (id: string) => {
    const next = preview === id ? null : id;
    setPreview(next);
    director.pin(next);
  };
  const unlocked = TRACKS.filter(trackUnlocked).length;
  const menu = TRACKS.filter((t) => t.suggest === 'menu');
  const sets = TRACKS.filter((t) => t.suggest !== 'menu').sort(
    (a, b) => SKIN_ORDER.indexOf(a.suggest as SkinId) - SKIN_ORDER.indexOf(b.suggest as SkinId),
  );
  const card = (t: (typeof TRACKS)[number]) => {
    const access = trackAccess(t);
    const skin = SKINS[t.suggest as SkinId];
    const isMenu = t.suggest === 'menu';
    return (
      <TrackCard
        key={t.id}
        title={t.title}
        artist={t.artist}
        tint={skin ? `#${hexToNumber(skin.palette(1).T).toString(16).padStart(6, '0')}` : '#edebfa'}
        note={!access.unlocked ? access.hint : isMenu ? '' : `${skin?.name ?? ''} skin`}
        locked={!access.unlocked}
        playing={preview === t.id}
        onListen={() => listen(t.id)}
        action={
          access.unlocked && isMenu ? (
            <button
              data-nav
              disabled={prefs.assign.menu === t.id}
              onClick={() => assignTrack('menu', t.id)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium whitespace-nowrap ${prefs.assign.menu === t.id ? 'glass-light' : 'glass'} disabled:cursor-default ${focusRing}`}
            >
              {prefs.assign.menu === t.id ? 'Menu track' : 'Set as menu'}
            </button>
          ) : null
        }
      />
    );
  };
  return (
    <div className="space-y-12">
      <div className="label px-1">
        {unlocked} / {TRACKS.length} unlocked · levels open the menu set, every skin brings its own
      </div>
      <section>
        <h3 className="mb-5 px-1 text-[22px] font-[560] tracking-[-0.02em]">The menu set</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{menu.map(card)}</div>
      </section>
      <section>
        <h3 className="mb-5 px-1 text-[22px] font-[560] tracking-[-0.02em]">Skin sets</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{sets.map(card)}</div>
      </section>
      <p className="px-1 text-[13px] text-faint">Credits and licences are in Settings → Sound.</p>
    </div>
  );
}

/** One track: a cover lit in its skin's colour, the play control and where it plays. */
function TrackCard({
  title,
  artist,
  tint,
  note,
  locked,
  playing,
  onListen,
  action,
}: {
  title: string;
  artist: string;
  tint: string;
  note: string;
  locked: boolean;
  playing: boolean;
  onListen: () => void;
  action: ReactNode;
}) {
  return (
    <div
      className={`glass-panel flex items-center gap-5 rounded-[28px] p-4 pr-5 transition-opacity ${locked ? 'opacity-50' : ''}`}
      style={playing ? { boxShadow: `inset 0 0 0 1px ${tint}55, 0 30px 70px -40px ${tint}` } : undefined}
    >
      <button
        data-nav
        disabled={locked}
        onClick={onListen}
        aria-label={playing ? 'Stop' : `Listen to ${title}`}
        className={`group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-[20px] disabled:cursor-default ${focusRing}`}
        style={{ background: `radial-gradient(120% 120% at 30% 20%, ${tint}55, ${tint}10 55%, #0b0b0d)` }}
      >
        {locked ? (
          <Icon name="lock" size={14} className="text-white/60" />
        ) : playing ? (
          <span className="flex h-6 items-end gap-[3px]" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="eq-bar w-[4px] rounded-full bg-white" style={{ animationDelay: `${i * 0.13}s` }} />
            ))}
          </span>
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-black/35 backdrop-blur transition-transform duration-300 group-hover:scale-110">
            <Icon name="play" size={12} />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-medium tracking-[-0.01em]">{title}</div>
        <div className="truncate text-[13px] text-muted">{artist}</div>
        {(note || action) && (
          <div className="mt-2.5 flex items-center gap-3">
            {action}
            {note && <span className="label truncate">{note}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const TIER: Record<Tier, { label: string; color: string }> = {
  bronze: { label: 'Bronze', color: '#d39a6a' },
  silver: { label: 'Silver', color: '#cfd5df' },
  gold: { label: 'Gold', color: '#f5c95c' },
  platinum: { label: 'Platinum', color: '#bfe9ff' },
};

function Achievements() {
  const earned = useAchievements();
  const count = ACHIEVEMENTS.filter((a) => earned[a.id]).length;
  const byTier = (Object.keys(TIER) as Tier[]).map((t) => [t, ACHIEVEMENTS.filter((a) => a.tier === t && earned[a.id]).length, ACHIEVEMENTS.filter((a) => a.tier === t).length] as const);
  return (
    <div className="space-y-12">
      <div className="glass-panel flex flex-wrap items-center gap-x-12 gap-y-6 rounded-[32px] px-8 py-7">
        <div>
          <div className="label">Earned</div>
          <div className="tabular mt-2 text-[44px] leading-none font-[480] tracking-[-0.04em]">
            {count}
            <span className="text-faint"> / {ACHIEVEMENTS.length}</span>
          </div>
        </div>
        <div className="min-w-[200px] flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-spring" style={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-5">
            {byTier.map(([t, got, total]) => (
              <span key={t} className="flex items-center gap-2 text-[13px] text-muted">
                <Medal tier={t} earned size={14} />
                {TIER[t].label} <span className="tabular text-faint">{got}/{total}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="max-w-[30ch] text-[14px] leading-relaxed text-muted">Some unlock a skin. Four are yours from the start; the rest are earned.</p>
      </div>

      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h3 className="mb-5 px-1 text-[22px] font-[560] tracking-[-0.02em]">{cat}</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => (
              <AchievementCard key={a.id} a={a} at={earned[a.id]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AchievementCard({ a, at }: { a: Achievement; at?: number }) {
  const progress = !at && a.progress ? a.progress() : null;
  const tint = TIER[a.tier].color;
  return (
    <div
      className={`glass-panel flex gap-5 rounded-[28px] p-5 transition-opacity ${at ? '' : 'opacity-60'}`}
      style={at ? { boxShadow: `inset 0 0 0 1px ${tint}33, 0 30px 70px -45px ${tint}` } : undefined}
    >
      <Medal tier={a.tier} earned={!!at} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[17px] font-medium tracking-[-0.01em]">{a.name}</span>
          <span className="label shrink-0" style={at ? { color: tint } : undefined}>
            {TIER[a.tier].label}
          </span>
        </div>
        <p className="mt-1 text-[14px] leading-snug text-muted">{a.description}</p>
        {progress && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-white/60" style={{ width: `${Math.min(100, (progress[0] / progress[1]) * 100)}%` }} />
            </div>
            <span className="tabular text-[12px] text-faint">
              {Math.min(progress[0], progress[1]).toLocaleString('en-US')} / {progress[1].toLocaleString('en-US')}
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {a.reward && (
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
              <Icon name="skin" size={9} /> {SKINS[a.reward as SkinId]?.name} skin
            </span>
          )}
          {at && <span className="text-[12px] text-faint">{new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
        </div>
      </div>
    </div>
  );
}

/** A medal drawn in minos: a T on a ring, in the tier's metal. Unearned, it is an outline. */
function Medal({ tier, earned, size }: { tier: Tier; earned: boolean; size: number }) {
  const c = TIER[tier].color;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0" aria-hidden>
      <circle cx="24" cy="24" r="22" fill={earned ? `${c}22` : 'none'} stroke={earned ? c : 'rgba(255,255,255,0.18)'} strokeWidth="1.5" />
      <g fill={earned ? c : 'rgba(255,255,255,0.14)'}>
        <rect x="11" y="16" width="8" height="8" rx="2" />
        <rect x="20" y="16" width="8" height="8" rx="2" />
        <rect x="29" y="16" width="8" height="8" rx="2" />
        <rect x="20" y="25" width="8" height="8" rx="2" />
      </g>
    </svg>
  );
}

function Trophies({ trophies }: { trophies: Trophy[] }) {
  if (trophies.length === 0)
    return <p className="glass-panel rounded-[28px] p-8 text-[15px] text-faint">Win or reach the final of a cup and it lands here.</p>;
  return (
    <div className="flex flex-wrap gap-4">
      {[...trophies].reverse().map((t, i) => (
        <TrophyCard key={i} trophy={t} />
      ))}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-panel rounded-[24px] px-6 py-5">
      <div className="label">{label}</div>
      <div className="tabular mt-2 text-[26px] leading-none font-[480] tracking-[-0.03em]">{value}</div>
    </div>
  );
}

function Locker() {
  const { appearance } = useSettings();
  const [focused, setFocused] = useState<SkinId>(appearance.skin);
  const equip = (id: SkinId) => {
    if (skinLocked(id) && id !== appearance.skin) return;
    if (id !== appearance.skin) sfx.ui('select');
    updateSettings((s) => ({ ...s, appearance: { ...s.appearance, skin: id } }));
  };
  useEffect(() => {
    document.querySelector<HTMLButtonElement>(`[data-skin="${appearance.skin}"]`)?.focus({ preventScroll: true });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const skin = SKINS[focused];
  const locked = skinLocked(focused);
  const equipped = focused === appearance.skin;
  const tint = `#${hexToNumber(skin.palette(1).T).toString(16).padStart(6, '0')}`;
  const unlocked = SKIN_ORDER.filter((id) => !skinLocked(id)).length;
  return (
    <section>
      <div className="label mb-4 px-1">
        {unlocked} / {SKIN_ORDER.length} unlocked
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[440px_minmax(0,1fr)]">
        <aside
          className="overflow-hidden rounded-[44px] bg-gradient-to-b from-[#1b1b1e] to-[#0f0f11] p-8 transition-[box-shadow] duration-700 lg:sticky lg:top-8"
          style={{ boxShadow: `inset 0 0 0 1px ${tint}2e, 0 50px 120px -60px ${tint}88` }}
        >
          <div className="relative h-[360px] overflow-hidden rounded-[30px] bg-black/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <DemoBoard mode="sprint" skin={focused} className="absolute inset-0" />
            {locked && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[2px]">
                <span className="glass-panel rounded-full px-4 py-2 text-[13px] font-medium">Preview · locked</span>
              </div>
            )}
          </div>
          <div key={focused} className="animate-fade">
            <div className="mt-7 text-[44px] leading-none font-[480] tracking-[-0.045em]">{skin.name}</div>
            <p className="mt-3 min-h-[3em] text-[15px] leading-relaxed text-muted">{skin.description}</p>
            <div className="mt-5 flex gap-6 border-t border-line pt-5">
              <Fact label="Sound" value={SOUND_PACK_NAMES[skin.sound]} />
              <Fact label="Grid" value={skin.grid === 'none' ? 'Off' : skin.grid === 'dots' ? 'Dots' : 'Lines'} />
              <Fact label="Style" value={skin.connected ? 'Connected' : 'Blocks'} />
            </div>
            <button
              disabled={locked || equipped}
              onClick={() => equip(focused)}
              className={`mt-7 w-full rounded-full py-3.5 text-[15px] font-semibold ${equipped ? 'glass-panel text-muted' : locked ? 'glass-panel text-faint' : 'glass-light'}`}
            >
              {equipped ? 'Equipped' : locked ? skinUnlockHint(focused) : 'Equip'}
            </button>
          </div>
        </aside>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SKIN_ORDER.map((id, i) => (
            <SkinTile
              key={id}
              id={id}
              index={i}
              active={id === focused}
              equipped={id === appearance.skin}
              locked={skinLocked(id)}
              onFocus={() => setFocused(id)}
              onSelect={() => equip(id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SkinTile({
  id,
  index,
  active,
  equipped,
  locked,
  onFocus,
  onSelect,
}: {
  id: SkinId;
  index: number;
  active: boolean;
  equipped: boolean;
  locked: boolean;
  onFocus: () => void;
  onSelect: () => void;
}) {
  const skin = SKINS[id];
  const tint = `#${hexToNumber(skin.palette(1).T).toString(16).padStart(6, '0')}`;
  return (
    <button
      data-nav
      data-skin={id}
      onFocus={onFocus}
      onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
      onClick={onSelect}
      className="animate-rise group relative flex aspect-[5/4] flex-col justify-between overflow-hidden rounded-[30px] bg-[#0d0d0f] p-5 text-left outline-none transition-[transform,box-shadow] duration-300 ease-spring hover:-translate-y-0.5"
      style={
        {
          animationDelay: `${index * 25}ms`,
          boxShadow: active ? `inset 0 0 0 1.5px ${tint}aa, 0 30px 80px -40px ${tint}` : 'inset 0 0 0 1px rgba(255,255,255,0.07)',
        } as CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-focus:opacity-100"
        style={{ background: `radial-gradient(80% 70% at 50% 40%, ${tint}1f, transparent 70%)` }}
      />
      <div className="flex items-center justify-between">
        <span className="tabular text-[11px] text-faint">{String(index + 1).padStart(2, '0')}</span>
        {equipped && <span className="size-2 rounded-full bg-accent shadow-[0_0_0_3px_rgba(237,235,250,0.18)]" />}
        {locked && !equipped && <LockGlyph />}
      </div>
      <div className={`relative flex flex-1 items-center justify-center ${locked ? 'opacity-30 grayscale' : ''}`}>
        <SkinSwatch
          skin={skin}
          cell={13}
          className="transition-transform duration-500 ease-spring group-hover:scale-[1.06] group-focus:scale-[1.06]"
        />
      </div>
      <div className="relative">
        <div className="text-[16px] font-medium tracking-[-0.015em]">{skin.name}</div>
        <div className="label mt-0.5">{locked ? 'Locked' : equipped ? 'Equipped' : SOUND_PACK_NAMES[skin.sound]}</div>
      </div>
    </button>
  );
}


function TrophyCard({ trophy }: { trophy: Trophy }) {
  const tint = CUP_TINT[trophy.cup] ?? '#edebfa';
  return (
    <div
      className="flex w-[220px] shrink-0 flex-col gap-6 rounded-[28px] bg-gradient-to-b from-[#19191c] to-[#0f0f11] p-6"
      style={{ boxShadow: `inset 0 0 0 1px ${tint}33` }}
    >
      <TrophyGlyph color={tint} gold={trophy.place === 1} />
      <div>
        <div className="label" style={{ color: tint }}>
          {trophy.place === 1 ? 'Champion' : 'Finalist'}
        </div>
        <div className="mt-1 text-[20px] font-medium tracking-[-0.02em]">{trophy.name}</div>
        <div className="tabular mt-1 text-[12px] text-faint">
          {new Date(trophy.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

/** A cup drawn from minos: a T for the bowl on an I for the stem. */
function TrophyGlyph({ color, gold }: { color: string; gold: boolean }) {
  const cells = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [1, 1],
    [2, 1],
    [3, 1],
    [2, 2],
    [2, 3],
    [1, 4],
    [2, 4],
    [3, 4],
  ];
  return (
    <svg width="44" height="44" viewBox="0 0 50 50" style={{ filter: gold ? `drop-shadow(0 0 10px ${color}aa)` : undefined }}>
      {cells.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x * 10 + 1} y={y * 10 + 1} width="8" height="8" rx="2" fill={color} fillOpacity={gold ? 0.95 : 0.5} />
      ))}
    </svg>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="tabular mt-1.5 text-[17px] font-medium">{value}</div>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden className="text-faint">
      <rect x="0.5" y="5.5" width="10" height="7" rx="2" fill="currentColor" />
      <path d="M2.5 5.5V4a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
