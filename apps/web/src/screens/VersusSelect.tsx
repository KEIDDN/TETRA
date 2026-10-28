import { BOTS, type BotProfile } from '@tetra/bot';
import { useEffect, useRef, useState } from 'react';
import { useMenuNav } from '../lib/nav';
import { botRecord, isUnlocked } from '../lib/versus';

const FORMATS = [1, 3, 5, 7];
const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

export function VersusSelect({ onPlay, onBack }: { onPlay: (botId: string, firstTo: number) => void; onBack: () => void }) {
  const firstOpen = [...BOTS].reverse().find(isUnlocked) ?? BOTS[0];
  const [selected, setSelected] = useState<BotProfile>(firstOpen);
  const [firstTo, setFirstTo] = useState(3);
  const listRef = useRef<HTMLOListElement>(null);
  useMenuNav(onBack, true, (d) => setFirstTo((f) => FORMATS[Math.min(FORMATS.length - 1, Math.max(0, FORMATS.indexOf(f) + d))]));

  useEffect(() => {
    listRef.current?.querySelector<HTMLButtonElement>(`[data-bot="${firstOpen.id}"]`)?.focus({ preventScroll: true });
  }, [firstOpen.id]);

  const record = botRecord(selected.id);

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-6 sm:px-10">
        <header className="flex h-24 shrink-0 items-center justify-between">
          <button
            data-nav
            onClick={onBack}
            className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted transition-colors hover:text-fg focus-visible:text-fg ${focusRing}`}
          >
            ← Back <span className="label ml-2">Esc</span>
          </button>
          <span className="label">Versus</span>
        </header>

        <main className="grid flex-1 items-start gap-12 pb-16 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <h1 className="animate-rise text-[clamp(48px,7vw,96px)] leading-none font-[480] tracking-[-0.045em]">Choose an opponent</h1>
            <ol ref={listRef} className="mt-10 border-t border-line">
              {BOTS.map((bot, i) => {
                const open = isUnlocked(bot);
                const r = botRecord(bot.id);
                const active = bot.id === selected.id;
                return (
                  <li key={bot.id} className="animate-rise border-b border-line" style={{ animationDelay: `${i * 30}ms` }}>
                    <button
                      data-nav
                      data-bot={bot.id}
                      disabled={!open}
                      onFocus={() => setSelected(bot)}
                      onMouseEnter={(e) => open && e.currentTarget.focus({ preventScroll: true })}
                      onClick={() => onPlay(bot.id, firstTo)}
                      className="group grid w-full grid-cols-[48px_1fr_auto] items-center gap-4 py-4 text-left outline-none disabled:cursor-not-allowed"
                    >
                      <span className={`tabular text-[13px] ${active ? 'text-accent' : 'text-faint'}`}>{String(bot.level).padStart(2, '0')}</span>
                      <span>
                        <span className={`block text-[26px] font-medium tracking-[-0.03em] transition-colors duration-200 ${active ? 'text-fg' : open ? 'text-white/40 group-hover:text-white/70' : 'text-white/15'}`}>
                          {bot.name}
                        </span>
                      </span>
                      <span className="label text-right">
                        {!open ? 'Locked' : r.wins + r.losses > 0 ? `${r.wins}–${r.losses}` : `${bot.pps.toFixed(1)} PPS`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside key={selected.id} className="animate-fade hairline sticky top-8 rounded-[40px] bg-gradient-to-b from-[#1b1b1d] to-[#121214] p-8 sm:p-10">
            <div className="flex items-baseline justify-between">
              <span className="label">Level {selected.level}</span>
              <span className="tabular text-[13px] text-faint">{selected.pps.toFixed(1)} PPS</span>
            </div>
            <div className="mt-6 text-[56px] leading-none font-[480] tracking-[-0.045em]">{selected.name}</div>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">{selected.style}</p>
            <dl className="mt-8 grid grid-cols-3 border-t border-line pt-5">
              <Fact label="Wins" value={String(record.wins)} />
              <Fact label="Losses" value={String(record.losses)} />
              <Fact label="Rounds" value={`${record.roundsWon}–${record.roundsLost}`} />
            </dl>
            <div className="mt-8">
              <div className="label mb-3">Format · ←→</div>
              <div className="hairline inline-flex rounded-full bg-tile p-1">
                {FORMATS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setFirstTo(n)}
                    className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-250 ease-spring ${firstTo === n ? 'bg-fg text-black' : 'text-muted hover:text-fg'}`}
                  >
                    FT{n}
                  </button>
                ))}
              </div>
            </div>
            <button
              data-nav
              disabled={!isUnlocked(selected)}
              onClick={() => onPlay(selected.id, firstTo)}
              className={`mt-10 flex w-full items-center justify-center gap-3 rounded-full bg-accent py-4 text-[17px] font-semibold text-black transition-transform duration-250 ease-spring hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 ${focusRing}`}
            >
              Play first to {firstTo}
              <span className="grid size-7 place-items-center rounded-full bg-black/10 font-mono text-[12px]">↵</span>
            </button>
          </aside>
        </main>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="tabular mt-1.5 text-[18px] font-medium">{value}</dd>
    </div>
  );
}
