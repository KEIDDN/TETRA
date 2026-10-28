import { useEffect, useState, type CSSProperties } from 'react';
import { useMenuNav } from '../lib/nav';
import {
  abandonTournament,
  champion,
  entrantProfile,
  isYou,
  placeName,
  ready,
  roundName,
  runner,
  useTournament,
  yourBout,
  type Bout,
  type Entrant,
  type Tournament,
} from '../lib/tournament';
import { BotEmblem } from '../ui/BotEmblem';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const CARD_W = 248;
const CARD_H = 84;
const SLOT = 104;
const GAP_X = 64;

export function Bracket({ onBack, onBout }: { onBack: () => void; onBout: (r: number, i: number) => void }) {
  const t = useTournament();
  // The runner's state (which bout is simulating) changes without the tournament changing.
  const [, setTick] = useState(0);
  useEffect(() => runner.subscribe(() => setTick((n) => n + 1)), []);
  useEffect(() => runner.kick(), []);
  useMenuNav(onBack, true);

  if (!t) return null;
  const mine = yourBout(t);
  const winner = champion(t);
  const rounds = t.rounds.length;
  const height = t.rounds[0].length * SLOT;
  const width = rounds * CARD_W + (rounds - 1) * GAP_X + CARD_W * 0.9;
  const center = (r: number, i: number) => (i + 0.5) * SLOT * 2 ** r;
  const x = (r: number) => r * (CARD_W + GAP_X);
  const yourEntrant = t.entrants.find((e) => e.bot === null);
  const opponent = mine && t.entrants[isYou(t, t.rounds[mine.r][mine.i].a) ? t.rounds[mine.r][mine.i].b! : t.rounds[mine.r][mine.i].a!];
  const opponentProfile = opponent && entrantProfile(opponent);

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(60% 50% at 20% 0%, ${(winner && winner.color) || '#edebfa'}14, transparent 70%)` }} />
      <div className="relative mx-auto w-full max-w-[1320px] px-6 pb-20 sm:px-10">
        <header className="flex h-24 items-center justify-between">
          <button data-nav onClick={onBack} className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted hover:text-fg ${focusRing}`}>
            ← Tournaments <span className="label ml-2">Esc</span>
          </button>
          <span className="label">{t.name}</span>
        </header>

        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <div className="label">{status(t, !!mine)}</div>
            <h1 className="mt-3 text-[clamp(44px,6vw,84px)] leading-[0.95] font-[480] tracking-[-0.045em]">
              {winner ? (winner.bot === null ? 'Champion.' : `${winner.name} takes it.`) : t.name}
            </h1>
            {t.place !== null && t.place > 0 && (
              <p className="mt-3 text-[17px] text-muted">
                You finished {placeName(t.place).toLowerCase()}
                {winner ? '.' : '. The rest of the bracket plays on — watch any match.'}
              </p>
            )}
          </div>

          {mine && opponentProfile && (
            <button
              data-nav
              autoFocus
              onClick={() => onBout(mine.r, mine.i)}
              className={`group flex items-center gap-5 rounded-[30px] bg-accent py-3 pr-7 pl-3 text-left text-black transition-transform duration-300 ease-spring hover:scale-[1.03] ${focusRing}`}
            >
              <div className="rounded-[22px] bg-black p-1">
                <BotEmblem bot={opponentProfile} size={52} glow />
              </div>
              <div>
                <div className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase opacity-60">
                  {roundName(t, mine.r)} · First to {t.formats[mine.r]}
                </div>
                <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">Play {opponent.name}</div>
              </div>
            </button>
          )}
          {winner && (
            <button data-nav onClick={() => { abandonTournament(); onBack(); }} className={`rounded-full bg-accent px-7 py-3.5 text-[15px] font-semibold text-black ${focusRing}`}>
              Done
            </button>
          )}
        </div>

        <div className="-mx-6 mt-12 overflow-x-auto px-6 pb-4 sm:-mx-10 sm:px-10">
          <div className="relative" style={{ width, height: height + 40 }}>
            {t.rounds.map((_, r) => (
              <div key={r} className="label absolute top-0" style={{ left: x(r) }}>
                {roundName(t, r)} <span className="ml-1 opacity-60">FT{t.formats[r]}</span>
              </div>
            ))}
            <svg className="absolute top-10 left-0" width={width} height={height} aria-hidden>
              {t.rounds.slice(0, -1).map((round, r) =>
                round.map((bout, i) => {
                  const x1 = x(r) + CARD_W;
                  const x2 = x(r + 1);
                  const y1 = center(r, i);
                  const y2 = center(r + 1, i >> 1);
                  const mid = x1 + GAP_X / 2;
                  const lit = bout.winner !== null;
                  const color = lit ? t.entrants[bout.winner!].color : 'rgba(255,255,255,0.08)';
                  return (
                    <path
                      key={`${r}-${i}`}
                      d={`M${x1},${y1} H${mid} V${y2} H${x2}`}
                      fill="none"
                      stroke={color}
                      strokeOpacity={lit ? 0.55 : 1}
                      strokeWidth={lit ? 1.5 : 1}
                      className="transition-[stroke] duration-700"
                    />
                  );
                }),
              )}
              {winner && (
                <path d={`M${x(rounds - 1) + CARD_W},${center(rounds - 1, 0)} H${x(rounds) - GAP_X * 0.4}`} stroke={winner.color} strokeOpacity={0.6} strokeWidth={1.5} />
              )}
            </svg>
            {t.rounds.map((round, r) =>
              round.map((bout, i) => (
                <BoutCard
                  key={`${r}-${i}`}
                  t={t}
                  bout={bout}
                  r={r}
                  i={i}
                  style={{ left: x(r), top: 40 + center(r, i) - CARD_H / 2 }}
                  onOpen={() => onBout(r, i)}
                />
              )),
            )}
            {winner && <Trophy entrant={winner} you={winner === yourEntrant} style={{ left: x(rounds) - GAP_X * 0.4 + 12, top: 40 + center(rounds - 1, 0) - 56 }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function status(t: Tournament, yourTurn: boolean): string {
  if (champion(t)) return 'Tournament over';
  if (yourTurn) return 'Your match is ready';
  if (t.place === null) return 'Waiting for the other matches';
  return t.place === 0 ? 'Spectating' : 'Eliminated';
}

function BoutCard({ t, bout, r, i, style, onOpen }: { t: Tournament; bout: Bout; r: number; i: number; style: CSSProperties; onOpen: () => void }) {
  const playable = ready(t, r, i);
  const yours = isYou(t, bout.a) || isYou(t, bout.b);
  const simulating = runner.isSimulating(r, i);
  const done = bout.winner !== null;
  const action = !playable ? null : yours ? 'Play' : simulating ? 'Watch' : 'Watch';
  return (
    <button
      data-nav={playable ? true : undefined}
      disabled={!playable}
      onClick={onOpen}
      className={`group absolute flex flex-col justify-center overflow-hidden rounded-[20px] px-3 text-left transition-transform duration-300 ease-spring enabled:hover:scale-[1.03] ${focusRing} ${
        yours && playable ? 'bg-white/[0.09] shadow-[inset_0_0_0_1px_rgba(237,235,250,0.5)]' : 'hairline bg-tile'
      }`}
      style={{ ...style, width: CARD_W, height: CARD_H }}
    >
      <Side t={t} index={bout.a} score={bout.score?.[0]} won={done && bout.winner === bout.a} lost={done && bout.winner !== bout.a} />
      <div className="mx-1 my-1 h-px bg-white/[0.06]" />
      <Side t={t} index={bout.b} score={bout.score?.[1]} won={done && bout.winner === bout.b} lost={done && bout.winner !== bout.b} />
      {action && (
        <span className={`absolute top-1/2 right-3 -translate-y-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${yours ? 'bg-accent text-black' : 'bg-white/10 text-fg'}`}>
          {simulating ? <span className="inline-flex items-center gap-1.5"><span className="sim-dot" />Live</span> : action}
        </span>
      )}
    </button>
  );
}

function Side({ t, index, score, won, lost }: { t: Tournament; index: number | null; score?: number; won: boolean; lost: boolean }) {
  if (index === null) {
    return (
      <div className="flex h-[30px] items-center gap-2.5 px-1">
        <span className="size-[24px] rounded-[8px] bg-white/[0.04]" />
        <span className="text-[14px] text-faint">—</span>
      </div>
    );
  }
  const e: Entrant = t.entrants[index];
  const profile = entrantProfile(e);
  return (
    <div className={`flex h-[30px] items-center gap-2.5 px-1 transition-opacity duration-500 ${lost ? 'opacity-35' : ''}`}>
      {profile ? <BotEmblem bot={profile} size={24} /> : <YouMark />}
      <span className={`min-w-0 flex-1 truncate text-[14px] ${won ? 'font-semibold' : 'font-medium'}`}>{e.name}</span>
      {e.bot && <span className="tabular text-[10px] text-faint">L{e.level}</span>}
      {score !== undefined && <span className={`tabular w-4 text-right text-[14px] ${won ? 'text-fg' : 'text-faint'}`}>{score}</span>}
    </div>
  );
}

function YouMark() {
  return (
    <span className="grid size-[24px] place-items-center rounded-[8px] bg-accent text-[10px] font-bold text-black">
      ME
    </span>
  );
}

function Trophy({ entrant, you, style }: { entrant: Entrant; you: boolean; style: CSSProperties }) {
  const profile = entrantProfile(entrant);
  return (
    <div className="animate-pop absolute flex w-[180px] flex-col items-start" style={style}>
      <div className="rounded-[28px] p-1" style={{ boxShadow: `0 0 60px -10px ${entrant.color}` }}>
        {profile ? <BotEmblem bot={profile} size={80} glow /> : <span className="grid size-20 place-items-center rounded-[26px] bg-accent text-[22px] font-bold text-black">ME</span>}
      </div>
      <div className="label mt-3" style={{ color: entrant.color }}>
        Champion
      </div>
      <div className="mt-1 text-[24px] font-medium tracking-[-0.025em]">{you ? 'You' : entrant.name}</div>
    </div>
  );
}
