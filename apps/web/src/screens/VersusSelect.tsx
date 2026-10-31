import { touchDevice } from '../game/touch';
import { BOTS, type BotProfile } from '@tetra/bot';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { sfx } from '../audio/sfx';
import { useMenuNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { toProfile, useCustomBots } from '../lib/customBots';
import { botRecord, isUnlocked } from '../lib/versus';
import { BotEmblem } from '../ui/BotEmblem';
import { Icon } from '../ui/Icon';
import { DemoBoard } from '../ui/DemoBoard';
import { Glyph } from '../ui/Glyph';

const FORMATS = [1, 3, 5, 7];
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const TRAITS: [keyof BotProfile['traits'], string][] = [
  ['speed', 'Speed'],
  ['attack', 'Attack'],
  ['spins', 'Spins'],
  ['defense', 'Defense'],
];

export function VersusSelect({
  onPlay,
  onBack,
  onEdit,
}: {
  onPlay: (botId: string, firstTo: number) => void;
  onBack: () => void;
  /** Opens the editor; no id = a new bot. */
  onEdit: (id?: string) => void;
}) {
  const { appearance } = useSettings();
  const custom = useCustomBots().map(toProfile);
  const isCustom = (bot: BotProfile) => bot.id.startsWith('custom-');
  const firstOpen = [...BOTS].reverse().find(isUnlocked) ?? BOTS[0];
  const [selected, setSelected] = useState<BotProfile>(firstOpen);
  const [firstTo, setFirstTo] = useState(3);
  const listRef = useRef<HTMLOListElement>(null);
  const cycleFormat = (d: 1 | -1) => {
    setFirstTo((f) => FORMATS[Math.min(FORMATS.length - 1, Math.max(0, FORMATS.indexOf(f) + d))]);
    sfx.ui('move');
  };
  useMenuNav(onBack, true, cycleFormat);

  useEffect(() => {
    listRef.current?.querySelector<HTMLButtonElement>(`[data-bot="${firstOpen.id}"]`)?.focus({ preventScroll: true });
  }, [firstOpen.id]);

  const record = botRecord(selected.id);
  const open = isCustom(selected) || isUnlocked(selected);
  const tint = { '--bot': selected.color } as CSSProperties;

  return (
    <div className="fixed inset-0 overflow-y-auto" style={tint}>
      {/* The selected bot's color washes in from the top right. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 transition-[background] duration-700"
        style={{ background: `radial-gradient(70% 60% at 85% 10%, ${selected.color}22, transparent 70%)` }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-6 sm:px-10">
        <header className="flex h-24 shrink-0 items-center justify-between">
          <button
            data-nav
            onClick={onBack}
            className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted transition-colors hover:text-fg focus-visible:text-fg ${focusRing}`}
          >
            <span className="flex items-center gap-2">
              <Icon name="back" size={11} /> Back <Glyph k="back" className="text-white/40" />
            </span>
          </button>
          <span className="label">Versus</span>
        </header>

        <main className="grid flex-1 items-start gap-12 pb-16 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div>
            <h1 className="animate-rise text-[clamp(48px,7vw,96px)] leading-[1.04] font-[480] tracking-[-0.045em]">Choose an opponent</h1>
            <ol ref={listRef} className="mt-10">
              {BOTS.map((bot, i) => {
                const unlocked = isUnlocked(bot);
                const r = botRecord(bot.id);
                const active = bot.id === selected.id;
                return (
                  <li key={bot.id} className="animate-rise" style={{ animationDelay: `${i * 30}ms` }}>
                    <button
                      data-nav
                      data-bot={bot.id}
                      onFocus={() => setSelected(bot)}
                      onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
                      onClick={() => unlocked && onPlay(bot.id, firstTo)}
                      className="group relative grid w-full grid-cols-[44px_40px_1fr_auto] items-center gap-4 overflow-hidden rounded-[22px] px-4 py-3 text-left outline-none transition-colors duration-200"
                      style={{ background: active ? `linear-gradient(90deg, ${bot.color}1f, transparent 75%)` : undefined }}
                    >
                      <BotEmblem bot={bot} size={40} glow={active} locked={!unlocked} />
                      <span className={`tabular text-[13px] ${active ? 'text-fg' : 'text-faint'}`}>{String(bot.level).padStart(2, '0')}</span>
                      <span
                        className={`text-[26px] font-medium tracking-[-0.03em] transition-all duration-300 ease-spring ${
                          active ? 'translate-x-1 text-fg' : unlocked ? 'text-white/40 group-hover:text-white/70' : 'text-white/15'
                        }`}
                      >
                        {bot.name}
                      </span>
                      <span className="label text-right">
                        {!unlocked ? (
                          <span className="inline-flex items-center gap-1.5">
                            <LockGlyph /> Locked
                          </span>
                        ) : r.wins + r.losses > 0 ? (
                          <span className="tabular">
                            {r.wins}W · {r.losses}L
                          </span>
                        ) : (
                          `${bot.pps.toFixed(1)} PPS`
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-12 flex items-end justify-between border-b border-line pb-3">
              <span className="label">Your bots</span>
              <button
                data-nav
                onClick={() => onEdit()}
                className={`rounded-full px-3 py-1 text-[13px] font-medium text-muted hover:text-fg ${focusRing}`}
              >
                + New bot
              </button>
            </div>
            <ol className="mt-2">
              {custom.length === 0 && (
                <li className="px-4 py-4 text-[14px] text-faint">Build your own opponent: speed, aggression, mistakes, strategy.</li>
              )}
              {custom.map((bot) => {
                const active = bot.id === selected.id;
                const r = botRecord(bot.id);
                return (
                  <li key={bot.id}>
                    <button
                      data-nav
                      data-bot={bot.id}
                      onFocus={() => setSelected(bot)}
                      onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })}
                      onClick={() => onPlay(bot.id, firstTo)}
                      className="group grid w-full grid-cols-[44px_40px_1fr_auto] items-center gap-4 rounded-[22px] px-4 py-3 text-left outline-none"
                      style={{ background: active ? `linear-gradient(90deg, ${bot.color}1f, transparent 75%)` : undefined }}
                    >
                      <BotEmblem bot={bot} size={40} glow={active} />
                      <span className="label">Custom</span>
                      <span
                        className={`text-[26px] font-medium tracking-[-0.03em] ${active ? 'text-fg' : 'text-white/40 group-hover:text-white/70'}`}
                      >
                        {bot.name}
                      </span>
                      <span className="label tabular text-right">
                        {r.wins + r.losses > 0 ? `${r.wins}W · ${r.losses}L` : `${bot.pps.toFixed(1)} PPS`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside
            key={selected.id}
            className="animate-fade sticky top-8 overflow-hidden rounded-[44px] bg-gradient-to-b from-[#1c1c1f] to-[#111113] p-8"
            style={{ boxShadow: `inset 0 0 0 1px ${selected.color}33, 0 40px 120px -50px ${selected.color}55` }}
          >
            <div className="flex items-center gap-5">
              <BotEmblem bot={selected} size={76} glow locked={!open} />
              <div className="min-w-0">
                <div className="label">
                  {isCustom(selected) ? 'Custom' : `Level ${selected.level}`} · {selected.pps.toFixed(1)} PPS
                </div>
                <div className="mt-2 text-[44px] leading-none font-[480] tracking-[-0.045em]">{selected.name}</div>
              </div>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">{selected.style}</p>

            {/* The bot itself, playing at its real speed. */}
            <div className="relative mt-6 h-[320px] overflow-hidden rounded-[28px] bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <DemoBoard mode="sprint" skin={appearance.skin} bot={selected} className="absolute inset-0" />
              <span className="label absolute bottom-3 left-4">Live · {selected.name}'s pace</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3">
              {TRAITS.map(([key, label]) => (
                <div key={key}>
                  <div className="flex justify-between">
                    <span className="label">{label}</span>
                    <span className="tabular text-[11px] text-faint">{Math.round(selected.traits[key] * 10)}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-spring"
                      style={{ width: `${Math.max(4, selected.traits[key] * 100)}%`, background: selected.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <div className="flex gap-6">
                <Fact label="Wins" value={String(record.wins)} />
                <Fact label="Losses" value={String(record.losses)} />
              </div>
              <div className="glass-panel inline-flex rounded-full p-1">
                {FORMATS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setFirstTo(n)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-250 ease-spring ${firstTo === n ? 'bg-fg text-black' : 'text-muted hover:text-fg'}`}
                  >
                    FT{n}
                  </button>
                ))}
              </div>
            </div>

            <button
              data-nav
              disabled={!open}
              onClick={() => onPlay(selected.id, firstTo)}
              className={`mt-6 flex w-full items-center justify-center gap-3 rounded-full py-4 text-[17px] font-semibold text-black transition-transform duration-250 ease-spring hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 ${focusRing}`}
              style={{ background: open ? selected.color : '#3a3a3f' }}
            >
              {open ? `Challenge ${selected.name}` : `Beat ${BOTS[selected.level - 2]?.name ?? 'the previous bot'} to unlock`}
              {open && !touchDevice && <span className="grid size-7 place-items-center rounded-full bg-black/15 font-mono text-[12px]">↵</span>}
            </button>
            <div className="label mt-3 text-center">First to {firstTo} · ←→ to change</div>
            {isCustom(selected) && (
              <button
                data-nav
                onClick={() => onEdit(selected.id)}
                className={`mt-4 w-full rounded-full py-2.5 text-[14px] font-medium text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:text-fg ${focusRing}`}
              >
                Edit {selected.name}
              </button>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden>
      <rect x="0.5" y="5" width="9" height="6.5" rx="1.5" fill="currentColor" />
      <path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tabular mt-1 text-[18px] font-medium">{value}</dd>
    </div>
  );
}
