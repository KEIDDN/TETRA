import { BOTS } from '@tetra/bot';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SOUND_PACK_NAMES, sfx } from '../audio/sfx';
import { MODE_CONFIGS } from '../game/modes';
import { hexToNumber, SKIN_ORDER, SKINS, type SkinId } from '../game/skins';
import { useMenuNav } from '../lib/nav';
import { levelFor, useProfile, type Trophy } from '../lib/profile';
import { updateSettings, useSettings } from '../lib/settings';
import { loadBest } from '../lib/storage';
import { CUPS, cupWon, skinLocked } from '../lib/tournament';
import { botRecord } from '../lib/versus';
import { DemoBoard } from '../ui/DemoBoard';
import { SkinSwatch } from '../ui/SkinSwatch';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const CUP_TINT: Record<string, string> = { foundations: '#5ac8f5', contenders: '#c86bff', summit: '#ffb84a', custom: '#edebfa' };

export type ProfileSection = 'skins';

export function Profile({ onBack, section }: { onBack: () => void; section?: ProfileSection }) {
  const { xp, trophies } = useProfile();
  const { appearance } = useSettings();
  const { level, into, needed } = levelFor(xp);
  const [focused, setFocused] = useState<SkinId>(appearance.skin);
  const skinsRef = useRef<HTMLElement>(null);
  useMenuNav(onBack, true);

  useEffect(() => {
    if (section !== 'skins') return;
    skinsRef.current?.scrollIntoView({ block: 'start' });
    skinsRef.current?.querySelector<HTMLButtonElement>(`[data-skin="${appearance.skin}"]`)?.focus({ preventScroll: true });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const equip = (id: SkinId) => {
    if (skinLocked(id) && id !== appearance.skin) return;
    if (id !== appearance.skin) sfx.ui('select');
    updateSettings((s) => ({ ...s, appearance: { ...s.appearance, skin: id } }));
  };

  const versusWins = BOTS.reduce((n, b) => n + botRecord(b.id).wins, 0);
  const sprint = loadBest('sprint');
  const unlocked = SKIN_ORDER.filter((id) => !skinLocked(id)).length;
  const skin = SKINS[focused];
  const locked = skinLocked(focused);
  const equipped = focused === appearance.skin;
  const tint = `#${hexToNumber(skin.palette(1).T).toString(16).padStart(6, '0')}`;

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-[background] duration-700"
        style={{ background: `radial-gradient(60% 50% at 85% 60%, ${tint}1a, transparent 70%)` }}
      />
      <div className="relative mx-auto w-full max-w-[1320px] px-6 pb-24 sm:px-10">
        <header className="flex h-24 items-center justify-between">
          <button data-nav onClick={onBack} className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted hover:text-fg ${focusRing}`}>
            ← Back <span className="label ml-2">Esc</span>
          </button>
          <span className="label">Profile</span>
        </header>

        {/* Level */}
        <section className="animate-rise grid items-center gap-10 md:grid-cols-[auto_minmax(0,1fr)]">
          <LevelRing level={level} progress={into / needed} />
          <div>
            <div className="label">Level {level}</div>
            <div className="mt-2 text-[clamp(44px,6vw,84px)] leading-[0.95] font-[480] tracking-[-0.045em]">
              {needed - into} XP <span className="text-white/25">to {level + 1}</span>
            </div>
            <div className="mt-6 h-1 max-w-[560px] overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-spring" style={{ width: `${(into / needed) * 100}%` }} />
            </div>
            <div className="mt-8 grid max-w-[640px] grid-cols-2 gap-6 sm:grid-cols-4">
              <Fact label="Total XP" value={xp.toLocaleString('en-US')} />
              <Fact label="Cups" value={`${CUPS.filter((c) => cupWon(c.id)).length} / ${CUPS.length}`} />
              <Fact label="Versus wins" value={String(versusWins)} />
              <Fact label="40 Lines" value={sprint ? MODE_CONFIGS.sprint.formatRecord(sprint) : '—'} />
            </div>
          </div>
        </section>

        {/* Trophies */}
        <section className="mt-20">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <span className="label">Trophies</span>
            <span className="label tabular">{trophies.length}</span>
          </div>
          {trophies.length === 0 ? (
            <p className="py-6 text-[15px] text-faint">Win or reach the final of a cup and it lands here.</p>
          ) : (
            <div className="-mx-6 mt-5 flex gap-4 overflow-x-auto px-6 pb-2 sm:-mx-10 sm:px-10">
              {[...trophies].reverse().map((t, i) => (
                <TrophyCard key={i} trophy={t} />
              ))}
            </div>
          )}
        </section>

        {/* Skins */}
        <section ref={skinsRef} className="mt-20 scroll-mt-6">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <span className="label">Skins</span>
            <span className="label tabular">
              {unlocked} / {SKIN_ORDER.length} unlocked
            </span>
          </div>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[440px_minmax(0,1fr)]">
            <aside
              className="overflow-hidden rounded-[44px] bg-gradient-to-b from-[#1b1b1e] to-[#0f0f11] p-8 transition-[box-shadow] duration-700 lg:sticky lg:top-8"
              style={{ boxShadow: `inset 0 0 0 1px ${tint}2e, 0 50px 120px -60px ${tint}88` }}
            >
              <div className="relative h-[360px] overflow-hidden rounded-[30px] bg-black/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                <DemoBoard mode="sprint" skin={focused} className="absolute inset-0" />
                {locked && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-[2px]">
                    <span className="hairline rounded-full bg-black/60 px-4 py-2 text-[13px] font-medium">Preview · locked</span>
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
                  className={`mt-7 w-full rounded-full py-3.5 text-[15px] font-semibold transition-transform duration-250 ease-spring enabled:hover:scale-[1.02] ${
                    equipped ? 'hairline bg-tile text-muted' : locked ? 'hairline bg-tile text-faint' : 'bg-accent text-black'
                  }`}
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
      </div>
    </div>
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
        <SkinSwatch skin={skin} cell={13} className="transition-transform duration-500 ease-spring group-hover:scale-[1.06] group-focus:scale-[1.06]" />
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
        <div className="tabular mt-1 text-[12px] text-faint">{new Date(trophy.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
    </div>
  );
}

/** A cup drawn from minos: a T for the bowl on an I for the stem. */
function TrophyGlyph({ color, gold }: { color: string; gold: boolean }) {
  const cells = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [2, 2], [2, 3], [1, 4], [2, 4], [3, 4]];
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
