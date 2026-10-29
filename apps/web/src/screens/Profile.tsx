import { BOTS } from '@tetra/bot';
import { useEffect, useState, type CSSProperties } from 'react';
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
import { TRACKS } from '../audio/catalog';
import { getMusicPrefs } from '../lib/musicPrefs';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const CUP_TINT: Record<string, string> = { foundations: '#5ac8f5', contenders: '#c86bff', summit: '#ffb84a', custom: '#edebfa' };

export type ProfileSection = 'skins';
type Tab = 'overview' | 'records' | 'locker' | 'music' | 'trophies';

const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['records', 'Records'],
  ['locker', 'Locker'],
  ['music', 'Music'],
  ['trophies', 'Trophies'],
];

function formatPlaytime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`;
}

export function Profile({ onBack, section }: { onBack: () => void; section?: ProfileSection }) {
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
              <Icon name="back" size={11} /> Back <span className="font-mono text-[11px] text-white/40">Esc</span>
            </span>
          </button>
          <span className="label">Profile</span>
        </header>

        {/* Player card */}
        <section className="glass-panel animate-rise grid items-center gap-10 rounded-[40px] p-8 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <LevelRing level={level} progress={into / needed} />
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
          {tab === 'locker' && <Locker />}
          {tab === 'music' && <Library />}
          {tab === 'trophies' && <Trophies trophies={trophies} />}
        </div>
      </div>
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

function Sparkline({ values, lowerIsBetter }: { values: number[]; lowerIsBetter: boolean }) {
  const w = 480;
  const h = 90;
  if (values.length < 2)
    return (
      <div className="mt-5 grid h-[90px] place-items-center rounded-[18px] bg-white/[0.02] text-[13px] text-faint">
        Play a few runs to see your curve.
      </div>
    );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const t = (v - min) / span;
    return [(i / (values.length - 1)) * w, 8 + (lowerIsBetter ? t : 1 - t) * (h - 16)] as const;
  });
  const bestIndex = values.indexOf(lowerIsBetter ? min : max);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-5 h-[90px] w-full overflow-visible">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#edebfa" stopOpacity="0.22" />
          <stop offset="1" stopColor="#edebfa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#spark)" />
      <polyline points={line} fill="none" stroke="#edebfa" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={pts[bestIndex][0]} cy={pts[bestIndex][1]} r="4" fill="#edebfa" />
    </svg>
  );
}

/** Every track TETRA plays, who made it, its license and where it plays. */
function Library() {
  const { assign } = getMusicPrefs();
  const slotsOf = (id: string) =>
    Object.entries(assign)
      .filter(([, t]) => t === id)
      .map(([slot]) => (slot === 'menu' ? 'Menus' : (SKINS[slot as SkinId]?.name ?? slot)));
  return (
    <div className="glass-panel overflow-hidden rounded-[28px]">
      {TRACKS.map((t) => {
        const slots = slotsOf(t.id);
        return (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line px-6 py-4 first:border-t-0">
            <div className="min-w-0">
              <div className="truncate text-[16px] font-medium tracking-[-0.01em]">{t.title}</div>
              <div className="text-[13px] text-faint">
                {t.artist}
                {t.album ? ` · ${t.album}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {slots.length > 0 && <span className="label text-muted">Plays in {slots.join(', ')}</span>}
              <a href={t.licenseUrl} target="_blank" rel="noreferrer" className="glass rounded-full px-3 py-1 text-[11px] font-medium">
                {t.license}
              </a>
            </div>
          </div>
        );
      })}
    </div>
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
              {equipped ? 'Equipped' : locked ? `Win ${CUPS.find((c) => c.reward === focused)?.name} to unlock` : 'Equip'}
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
  const cup = CUPS.find((c) => c.reward === id);
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
        <div className="label mt-0.5">{locked ? `${cup?.name} cup` : equipped ? 'Equipped' : SOUND_PACK_NAMES[skin.sound]}</div>
      </div>
    </button>
  );
}

function LevelRing({ level, progress }: { level: number; progress: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[176px] place-items-center">
      <svg viewBox="0 0 176 176" className="absolute inset-0 -rotate-90">
        <circle cx="88" cy="88" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          cx="88"
          cy="88"
          r={r}
          fill="none"
          stroke="#edebfa"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${progress * c} ${c}`}
          className="transition-[stroke-dasharray] duration-1000 ease-spring"
          style={{ filter: 'drop-shadow(0 0 10px rgba(237,235,250,0.45))' }}
        />
      </svg>
      <span className="tabular text-[56px] leading-none font-medium tracking-[-0.04em]">{level}</span>
    </div>
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
