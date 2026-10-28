import { BOTS, type BotProfile } from '@tetra/bot';
import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { toProfile, useCustomBots } from '../lib/customBots';
import { useMenuNav } from '../lib/nav';
import { startTournament, type Seeding } from '../lib/tournament';
import { BotEmblem } from '../ui/BotEmblem';
import { Row, Section, Segmented, ToggleRow } from '../ui/controls';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const SIZES = ['4', '8', '16'] as const;
type Size = (typeof SIZES)[number];
const DEFAULT_FORMATS: Record<Size, number[]> = { '4': [3, 4], '8': [2, 3, 4], '16': [1, 2, 3, 4] };

function roundLabel(rounds: number, r: number): string {
  const left = rounds - r;
  return left === 1 ? 'Final' : left === 2 ? 'Semifinals' : left === 3 ? 'Quarterfinals' : `Round of ${2 ** left}`;
}

export function TournamentBuilder({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  useMenuNav(onBack, true);
  const custom = useCustomBots().map(toProfile);
  const roster: BotProfile[] = [...BOTS, ...custom];
  const [size, setSize] = useState<Size>('8');
  const [withYou, setWithYou] = useState(true);
  const [picks, setPicks] = useState<string[]>([]);
  const [formats, setFormats] = useState<number[]>(DEFAULT_FORMATS['8']);
  const [seeding, setSeeding] = useState<Seeding>('level');
  const [name, setName] = useState('Open');

  const seats = Number(size) - (withYou ? 1 : 0);
  const count = (id: string) => picks.filter((p) => p === id).length;
  const add = (id: string) => {
    if (picks.length >= seats) return;
    setPicks([...picks, id]);
    sfx.ui('move');
  };
  const remove = (id: string) => {
    const i = picks.lastIndexOf(id);
    if (i >= 0) setPicks(picks.filter((_, k) => k !== i));
  };
  const resize = (s: Size) => {
    setSize(s);
    setFormats(DEFAULT_FORMATS[s]);
    setPicks((p) => p.slice(0, Number(s) - (withYou ? 1 : 0)));
  };
  const fill = () => {
    const next = [...picks];
    while (next.length < seats) next.push(roster[Math.floor(Math.random() * roster.length)].id);
    setPicks(next);
  };
  const start = () => {
    const bots = picks.map((id) => roster.find((b) => b.id === id)!);
    startTournament({ name: name.trim() || 'Open', tier: 1, bots, withYou, formats, seeding });
    onStart();
  };

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div className="relative mx-auto w-full max-w-[1120px] px-6 pb-20 sm:px-10">
        <header className="flex h-24 items-center justify-between">
          <button data-nav onClick={onBack} className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted hover:text-fg ${focusRing}`}>
            ← Back <span className="label ml-2">Esc</span>
          </button>
          <span className="label">Custom bracket</span>
        </header>

        <input
          data-nav
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent text-[clamp(44px,6vw,80px)] leading-none font-[480] tracking-[-0.045em] outline-none placeholder:text-faint"
          placeholder="Name it"
        />

        <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <Section label="Field" note={`${picks.length} / ${seats} bots`}>
              <div className="grid gap-1 p-3 sm:grid-cols-2">
                {roster.map((bot) => {
                  const n = count(bot.id);
                  return (
                    <div key={bot.id} className="flex items-center gap-3 rounded-[18px] px-3 py-2" style={{ background: n ? `${bot.color}14` : undefined }}>
                      <BotEmblem bot={bot} size={34} glow={n > 0} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium">{bot.name}</div>
                        <div className="label">{bot.id.startsWith('custom-') ? 'Custom' : `Level ${bot.level}`}</div>
                      </div>
                      <button data-nav onClick={() => remove(bot.id)} disabled={!n} className={`size-8 rounded-full text-[18px] text-muted enabled:hover:bg-white/10 disabled:opacity-20 ${focusRing}`}>
                        −
                      </button>
                      <span className="tabular w-4 text-center text-[14px]">{n}</span>
                      <button data-nav onClick={() => add(bot.id)} disabled={picks.length >= seats} className={`size-8 rounded-full text-[18px] text-muted enabled:hover:bg-white/10 disabled:opacity-20 ${focusRing}`}>
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
            </Section>
            <p className="mt-3 px-1 text-[13px] text-faint">Pick a bot twice and the second one enters as a clone with its own name.</p>
          </div>

          <div>
            <Section label="Bracket">
              <Row name="Size">
                <Segmented value={size} onChange={resize} options={SIZES.map((s) => [s, s])} />
              </Row>
              <ToggleRow name="Play in it" hint="Off to just watch the bots" value={withYou} onChange={(v) => {
                setWithYou(v);
                setPicks((p) => p.slice(0, Number(size) - (v ? 1 : 0)));
              }} />
              <Row name="Seeding" hint={seeding === 'level' ? 'Strongest meet last' : 'Anyone can meet anyone'}>
                <Segmented value={seeding} onChange={setSeeding} options={[['level', 'Level'], ['random', 'Random']]} />
              </Row>
            </Section>

            <Section label="Format">
              {formats.map((ft, r) => (
                <Row key={r} name={roundLabel(formats.length, r)}>
                  <Segmented
                    small
                    value={String(ft)}
                    onChange={(v) => setFormats(formats.map((f, k) => (k === r ? Number(v) : f)))}
                    options={['1', '2', '3', '4', '5'].map((v) => [v, `FT${v}`])}
                  />
                </Row>
              ))}
            </Section>

            <div className="mt-8 flex gap-3">
              <button data-nav onClick={fill} disabled={picks.length >= seats} className={`hairline flex-1 rounded-full bg-tile py-3.5 text-[15px] font-medium disabled:opacity-40 ${focusRing}`}>
                Fill randomly
              </button>
              <button
                data-nav
                onClick={start}
                disabled={picks.length !== seats}
                className={`flex-1 rounded-full bg-accent py-3.5 text-[15px] font-semibold text-black transition-transform duration-250 ease-spring enabled:hover:scale-[1.03] disabled:opacity-40 ${focusRing}`}
              >
                Start
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
