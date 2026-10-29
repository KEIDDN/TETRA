import type { BotProfile } from '@tetra/bot';
import type { ReactNode } from 'react';
import { useMenuNav } from '../lib/nav';
import { useProfile } from '../lib/profile';
import { useSettings } from '../lib/settings';
import {
  abandonTournament,
  champion,
  CUPS,
  cupBots,
  cupUnlocked,
  cupWon,
  customUnlocked,
  startTournament,
  useTournament,
  type Cup,
} from '../lib/tournament';
import { SKINS, type SkinId } from '../game/skins';
import { Icon } from '../ui/Icon';
import { BotEmblem } from '../ui/BotEmblem';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const TIER_TINT = ['#5ac8f5', '#c86bff', '#ffb84a'];

export function Tournaments({ onBack, onBracket, onCustom }: { onBack: () => void; onBracket: () => void; onCustom: () => void }) {
  useSettings();
  useProfile();
  const active = useTournament();
  useMenuNav(onBack, true);

  const enter = (cup: Cup) => {
    startTournament({ name: cup.name, cup: cup.id, tier: cup.tier, bots: cupBots(cup), withYou: true, formats: cup.formats, seeding: 'level' });
    onBracket();
  };
  const activeDone = active && champion(active);

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(60% 50% at 80% 0%, #ffb84a14, transparent 70%)' }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-[1320px] flex-col px-6 sm:px-10">
        <header className="flex h-24 shrink-0 items-center justify-between">
          <button
            data-nav
            onClick={onBack}
            className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted transition-colors hover:text-fg focus-visible:text-fg ${focusRing}`}
          >
            <span className="flex items-center gap-2">
              <Icon name="back" size={11} /> Back <span className="font-mono text-[11px] text-white/40">Esc</span>
            </span>
          </button>
          <span className="label">Tournaments</span>
        </header>

        <main className="pb-16">
          <h1 className="animate-rise text-[clamp(48px,7vw,96px)] leading-[0.95] font-[480] tracking-[-0.045em]">Eight enter.</h1>
          <p className="animate-rise mt-4 max-w-[560px] text-[17px] leading-relaxed text-muted" style={{ animationDelay: '40ms' }}>
            Single elimination against seven bots. Quarterfinals first to two, semifinals first to three, the final first to four.
          </p>

          {active && (
            <button
              data-nav
              onClick={onBracket}
              className={`animate-rise glass mt-10 flex w-full items-center justify-between gap-6 rounded-[28px] px-7 py-5 text-left transition-transform duration-250 ease-spring hover:scale-[1.01] ${focusRing}`}
            >
              <div>
                <div className="label">{activeDone ? 'Finished' : 'In progress'}</div>
                <div className="mt-1.5 text-[24px] font-medium tracking-[-0.025em]">{active.name}</div>
              </div>
              <span className="glass-light rounded-full px-5 py-2.5 text-[14px] font-semibold">{activeDone ? 'See bracket' : 'Resume'}</span>
            </button>
          )}

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {CUPS.map((cup, i) => (
              <CupCard key={cup.id} cup={cup} index={i} onEnter={() => enter(cup)} />
            ))}
          </div>

          <button
            data-nav
            disabled={!customUnlocked()}
            onClick={onCustom}
            className={`animate-rise glass mt-5 flex w-full items-center justify-between gap-6 rounded-[32px] px-8 py-7 text-left transition-transform duration-250 ease-spring enabled:hover:scale-[1.01] disabled:opacity-50 ${focusRing}`}
            style={{ animationDelay: '220ms' }}
          >
            <div>
              <div className="label">Custom</div>
              <div className="mt-2 text-[30px] font-medium tracking-[-0.03em]">Build a bracket</div>
              <p className="mt-1 text-[14px] text-muted">
                {customUnlocked()
                  ? '4, 8 or 16 seats. Any bots, yours included. Pick the format of every round.'
                  : 'Win any cup to open custom brackets.'}
              </p>
            </div>
            <span className="label">{customUnlocked() ? 'Open →' : 'Locked'}</span>
          </button>

          {active && !activeDone && (
            <button onClick={abandonTournament} className="label mt-8 hover:text-fg">
              Abandon current tournament
            </button>
          )}
        </main>
      </div>
    </div>
  );
}

function CupCard({ cup, index, onEnter }: { cup: Cup; index: number; onEnter: () => void }) {
  const open = cupUnlocked(cup);
  const won = cupWon(cup.id);
  const tint = TIER_TINT[cup.tier];
  const bots = cupBots(cup);
  const unique = bots.filter((b, i) => bots.findIndex((x) => x.id === b.id) === i);
  const reward = SKINS[cup.reward as SkinId];
  const requires = CUPS.find((c) => c.id === cup.requires);
  return (
    <button
      data-nav
      disabled={!open}
      onClick={onEnter}
      className={`animate-rise group relative flex min-h-[360px] flex-col overflow-hidden rounded-[36px] bg-gradient-to-b from-[#1a1a1d] to-[#101012] p-8 text-left transition-transform duration-300 ease-spring enabled:hover:-translate-y-1 disabled:opacity-60 ${focusRing}`}
      style={{
        animationDelay: `${80 + index * 50}ms`,
        boxShadow: `inset 0 0 0 1px ${tint}${open ? '33' : '14'}, 0 40px 100px -60px ${tint}${open ? '88' : '00'}`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-60 blur-3xl"
        style={{ background: `${tint}${open ? '26' : '0c'}` }}
      />
      <div className="relative flex items-center justify-between">
        <span className="label" style={{ color: open ? tint : undefined }}>
          {['I', 'II', 'III'][cup.tier]} · {['Beginner', 'Intermediate', 'Expert'][cup.tier]}
        </span>
        {won && <Badge>Champion</Badge>}
      </div>
      <div className="relative mt-5 text-[44px] leading-none font-[480] tracking-[-0.045em]">{cup.name}</div>
      <p className="relative mt-3 text-[15px] text-muted">{cup.tagline}</p>

      <div className="relative mt-auto pt-8">
        <EmblemRow bots={unique} locked={!open} />
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="label tabular">FT{cup.formats.join(' · FT')}</span>
          <span className="label">{open ? `Reward · ${reward?.name ?? cup.reward}` : `Win ${requires?.name}`}</span>
        </div>
      </div>
    </button>
  );
}

function EmblemRow({ bots, locked }: { bots: BotProfile[]; locked: boolean }) {
  return (
    <div className="flex -space-x-2">
      {bots.map((b) => (
        <div key={b.id} className="rounded-[14px] bg-[#111113] p-0.5">
          <BotEmblem bot={b} size={38} locked={locked} />
        </div>
      ))}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-black">{children}</span>;
}
