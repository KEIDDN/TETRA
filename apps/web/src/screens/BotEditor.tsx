import { BOTS } from '@tetra/bot';
import { useMemo, useState } from 'react';
import { CUSTOM_COLORS, deleteCustomBot, newSpec, saveCustomBot, toProfile, type CustomBotSpec } from '../lib/customBots';
import { useMenuNav } from '../lib/nav';
import { useSettings } from '../lib/settings';
import { BotEmblem } from '../ui/BotEmblem';
import { Section, SliderRow, ToggleRow } from '../ui/controls';
import { DemoBoard } from '../ui/DemoBoard';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** Create or edit a custom bot: a few big dials up front, everything else under Advanced. */
export function BotEditor({ spec: initial, onDone, onPlay }: { spec?: CustomBotSpec; onDone: () => void; onPlay: (id: string) => void }) {
  const { appearance } = useSettings();
  const [spec, setSpec] = useState<CustomBotSpec>(initial ?? newSpec());
  const [advanced, setAdvanced] = useState(false);
  useMenuNav(onDone);
  const set = (patch: Partial<CustomBotSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const setAdv = (patch: Partial<CustomBotSpec['advanced']>) => setSpec((s) => ({ ...s, advanced: { ...s.advanced, ...patch } }));
  const setWeight = (patch: Partial<CustomBotSpec['advanced']['weights']>) =>
    setSpec((s) => ({ ...s, advanced: { ...s.advanced, weights: { ...s.advanced.weights, ...patch } } }));
  const profile = useMemo(() => toProfile(spec), [spec]);
  const rebase = (id: string) => {
    const base = BOTS.find((b) => b.id === id)!;
    const fresh = newSpec(base);
    setSpec((s) => ({ ...fresh, id: s.id, name: s.name, color: s.color }));
  };

  return (
    <div className="fixed inset-0 overflow-y-auto">
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ background: `radial-gradient(60% 50% at 85% 5%, ${spec.color}22, transparent 70%)` }} />
      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-24 sm:px-10">
        <header className="flex h-24 items-center justify-between">
          <button data-nav onClick={onDone} className={`-ml-4 rounded-full px-4 py-2 text-[14px] font-medium text-muted hover:text-fg ${focusRing}`}>
            ← Back <span className="label ml-2">Esc</span>
          </button>
          <span className="label">Custom bot</span>
        </header>

        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
          <main>
            <input
              data-nav
              value={spec.name}
              maxLength={18}
              onChange={(e) => set({ name: e.target.value })}
              className="w-full bg-transparent text-[clamp(44px,6vw,80px)] leading-none font-[480] tracking-[-0.045em] outline-none placeholder:text-white/20"
              placeholder="Name"
            />
            <div className="mt-6 flex flex-wrap gap-2">
              {CUSTOM_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Color ${c}`}
                  onClick={() => set({ color: c })}
                  className="size-8 rounded-full transition-transform duration-250 ease-spring hover:scale-110"
                  style={{ background: c, boxShadow: spec.color === c ? `0 0 0 3px #000, 0 0 0 5px ${c}` : undefined }}
                />
              ))}
            </div>

            <Section label="Based on" note="Sets every dial below to that bot's values.">
              <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
                {BOTS.map((b) => (
                  <button
                    key={b.id}
                    data-nav
                    onClick={() => rebase(b.id)}
                    className={`flex items-center gap-2 bg-[#0b0b0c] px-4 py-3 text-left text-[14px] font-medium transition-colors hover:bg-[#121214] ${focusRing} focus-visible:ring-inset ${
                      spec.base === b.id ? 'text-fg' : 'text-white/40'
                    }`}
                  >
                    <BotEmblem bot={b} size={22} />
                    {b.name}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Personality">
              <SliderRow name="Speed" hint="Pieces per second" min={0.3} max={5} step={0.05} value={spec.pps} display={(v) => `${v.toFixed(2)}`} sub={() => 'PPS'} onChange={(pps) => set({ pps })} />
              <SliderRow
                name="Aggression"
                hint="Sends early and takes risks, or stays safe"
                min={0}
                max={1}
                step={0.05}
                value={spec.aggression}
                display={(v) => `${Math.round(v * 100)}%`}
                onChange={(aggression) => set({ aggression })}
              />
              <SliderRow
                name="Mistakes"
                hint="Misdrops, hesitation, worse choices"
                min={0}
                max={1}
                step={0.05}
                value={spec.mistakes}
                display={(v) => `${Math.round(v * 100)}%`}
                onChange={(mistakes) => set({ mistakes })}
              />
            </Section>

            <button
              data-nav
              onClick={() => setAdvanced((a) => !a)}
              className={`mt-10 flex items-center gap-2 rounded-full px-1 text-[14px] font-medium text-muted hover:text-fg ${focusRing}`}
            >
              <span className={`inline-block transition-transform duration-250 ease-spring ${advanced ? 'rotate-90' : ''}`}>›</span> Advanced
            </button>
            {advanced && (
              <div className="animate-fade">
                <Section label="Search">
                  <SliderRow name="Look-ahead" hint="Pieces it plans ahead" min={1} max={3} step={1} value={spec.advanced.depth} display={(v) => String(v)} onChange={(depth) => setAdv({ depth })} />
                  <SliderRow name="Width" hint="Lines of play it keeps in mind" min={1} max={30} step={1} value={spec.advanced.beam} display={(v) => String(v)} onChange={(beam) => setAdv({ beam })} />
                  <ToggleRow name="Spins and tucks" hint="Looks for T-spins and slides under overhangs" value={spec.advanced.spins} onChange={(spins) => setAdv({ spins })} />
                  <ToggleRow name="Hold" hint="Uses the hold slot" value={spec.advanced.useHold} onChange={(useHold) => setAdv({ useHold })} />
                </Section>
                <Section label="Hands">
                  <SliderRow name="Reaction" hint="Before it notices garbage" min={100} max={2000} step={25} value={spec.advanced.reaction} display={(v) => `${v}`} sub={() => 'ms'} onChange={(reaction) => setAdv({ reaction })} />
                  <SliderRow name="Tap speed" hint="Time between key presses" min={25} max={150} step={1} value={spec.advanced.tap} display={(v) => `${v}`} sub={() => 'ms'} onChange={(tap) => setAdv({ tap })} />
                  <SliderRow name="DAS" hint="Its own auto-shift delay" min={60} max={250} step={1} value={spec.advanced.das} display={(v) => `${v}`} sub={() => 'ms'} onChange={(das) => setAdv({ das })} />
                  <SliderRow name="ARR" hint="0 slides straight to the wall" min={0} max={80} step={1} value={spec.advanced.arr} display={(v) => `${v}`} sub={() => 'ms'} onChange={(arr) => setAdv({ arr })} />
                </Section>
                <Section label="Strategy">
                  <SliderRow name="T-spin slots" hint="How much it values a ready T-spin" min={0} max={14} step={0.5} value={spec.advanced.weights.tslot} display={(v) => v.toFixed(1)} onChange={(tslot) => setWeight({ tslot })} />
                  <SliderRow name="Quad well" hint="How much it values a ready well" min={0} max={8} step={0.25} value={spec.advanced.weights.well} display={(v) => v.toFixed(1)} onChange={(well) => setWeight({ well })} />
                  <SliderRow name="Burn penalty" hint="Avoids clears that send nothing" min={-14} max={0} step={0.5} value={spec.advanced.weights.burn} display={(v) => v.toFixed(1)} onChange={(burn) => setWeight({ burn })} />
                  <SliderRow name="Back-to-back" hint="Reward for keeping a streak" min={0} max={5} step={0.25} value={spec.advanced.weights.b2b} display={(v) => v.toFixed(1)} onChange={(b2b) => setWeight({ b2b })} />
                  <SliderRow name="Holes" hint="Penalty per covered hole" min={-14} max={0} step={0.5} value={spec.advanced.weights.holes} display={(v) => v.toFixed(1)} onChange={(holes) => setWeight({ holes })} />
                </Section>
              </div>
            )}
          </main>

          <aside className="sticky top-8 overflow-hidden rounded-[44px] bg-gradient-to-b from-[#1c1c1f] to-[#111113] p-8" style={{ boxShadow: `inset 0 0 0 1px ${spec.color}33, 0 40px 120px -50px ${spec.color}55` }}>
            <div className="flex items-center gap-5">
              <BotEmblem bot={profile} size={72} glow />
              <div>
                <div className="label">Custom · {profile.pps.toFixed(1)} PPS</div>
                <div className="mt-2 text-[34px] leading-none font-[480] tracking-[-0.04em]">{profile.name}</div>
              </div>
            </div>
            <div className="relative mt-6 h-[300px] overflow-hidden rounded-[28px] bg-black/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <DemoBoard mode="sprint" skin={appearance.skin} bot={profile} className="absolute inset-0" />
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-faint">Saved bots appear in Versus and in custom tournaments.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button
                data-nav
                onClick={() => {
                  saveCustomBot(spec);
                  onPlay(spec.id);
                }}
                className={`rounded-full py-3.5 text-[16px] font-semibold text-black transition-transform duration-250 ease-spring hover:scale-[1.02] ${focusRing}`}
                style={{ background: spec.color }}
              >
                Save and play
              </button>
              <button
                data-nav
                onClick={() => {
                  saveCustomBot(spec);
                  onDone();
                }}
                className={`hairline rounded-full bg-tile py-3.5 text-[16px] font-medium transition-transform duration-250 ease-spring hover:scale-[1.02] ${focusRing}`}
              >
                Save
              </button>
              {initial && (
                <button
                  data-nav
                  onClick={() => {
                    if (window.confirm(`Delete ${spec.name}?`)) {
                      deleteCustomBot(spec.id);
                      onDone();
                    }
                  }}
                  className={`rounded-full py-2 text-[14px] font-medium text-[#ff6b6b]/80 hover:text-[#ff6b6b] ${focusRing}`}
                >
                  Delete
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
