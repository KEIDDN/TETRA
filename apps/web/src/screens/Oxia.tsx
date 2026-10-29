import { BOTS } from '@tetra/bot';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { music } from '../audio/music';
import { SKIN_ORDER } from '../game/skins';
import { useMenuNav } from '../lib/nav';
import { CUPS } from '../lib/tournament';
import type { ExperienceScene, Formation } from '../ui/experience/ExperienceScene';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** Where OXIA lives online. Empty links are placeholders until the profiles are live. */
const SOCIALS: { name: string; url: string }[] = [
  { name: 'X', url: '' },
  { name: 'Instagram', url: '' },
  { name: 'LinkedIn', url: '' },
  { name: 'Website', url: '' },
];

const PILLARS: [string, string][] = [
  ['Design', 'Interfaces that feel inevitable. Nothing decorative, nothing missing.'],
  ['Engineering', 'Software built to the frame: fast, precise, quietly robust.'],
  ['Sound', 'Audio treated as a material, not an afterthought.'],
];

const MANIFESTO =
  'We love this game. We love the music that keeps a room moving until sunrise. Put them together and something happens: the stack and the beat lock in, and you slip into a kind of trance. TETRA was built for that moment.';

/** Each section asks the 3D stage for its own formation, centred or set to the right of the text. */
type Section = { formation: Formation; centered: boolean };

/** Why TETRA: a landing for the curious. Who OXIA Labs is, why we built TETRA, and where to find us. */
export function Oxia({ onBack, onExperience }: { onBack: () => void; onExperience: () => void }) {
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExperienceScene | null>(null);
  const [section, setSection] = useState<Section>({ formation: 'oxia', centered: true });
  useMenuNav(onBack, true);

  useEffect(() => {
    let disposed = false;
    void import('../ui/experience/ExperienceScene').then(({ ExperienceScene }) => {
      if (disposed || !stage.current) return;
      const scene = new ExperienceScene(stage.current);
      scene.formation = 'oxia';
      scene.centered = true;
      sceneRef.current = scene;
    });
    let raf = 0;
    const tick = () => {
      if (sceneRef.current) sceneRef.current.bands = music.analyse();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.formation = section.formation;
    scene.centered = section.centered;
  }, [section]);

  const enter = (s: Section) => () => setSection((current) => (current.formation === s.formation && current.centered === s.centered ? current : s));

  return (
    <div ref={scroller} className="fixed inset-0 overflow-x-hidden overflow-y-auto bg-black text-fg">
      <div ref={stage} className="fixed inset-0" aria-hidden />
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 transition-opacity duration-1000 ${section.centered ? 'opacity-100' : 'opacity-0'} bg-[radial-gradient(55%_48%_at_50%_55%,rgba(0,0,0,0.88),rgba(0,0,0,0.5)_55%,rgba(0,0,0,0.05)_90%)]`}
      />
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 transition-opacity duration-1000 ${section.centered ? 'opacity-0' : 'opacity-100'} bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.65)_50%,rgba(0,0,0,0.1)_82%)]`}
      />

      <header className="fixed inset-x-0 top-0 z-20 flex h-20 items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-8 sm:px-12">
        <span className="font-mono text-[11px] font-medium tracking-[0.24em] uppercase">
          OXIA Labs <span className="text-white/40">· Why TETRA</span>
        </span>
        <button data-nav onClick={onBack} className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}>
          Close
        </button>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <InView root={scroller} onEnter={enter({ formation: 'oxia', centered: true })}>
          <section className="flex min-h-screen flex-col items-center justify-center px-8 pt-[28vh] text-center">
            <Reveal root={scroller}>
              <span className="font-mono text-[11px] tracking-[0.3em] text-white/55 uppercase">Why we made TETRA</span>
            </Reveal>
            <Reveal root={scroller} delay={120}>
              <h1 className="mt-6 text-[clamp(56px,9vw,168px)] leading-[0.98] font-[600] tracking-[-0.06em]">Feel the blocks.</h1>
            </Reveal>
            <Reveal root={scroller} delay={320}>
              <p className="mx-auto mt-8 max-w-[36ch] text-[clamp(17px,1.4vw,22px)] leading-relaxed text-white/60">
                An audiovisual experience where the music and the blocks lock together, until you slip into something close to a trance.
              </p>
            </Reveal>
            <Reveal root={scroller} delay={600}>
              <p className="exp-blink mt-20 font-mono text-[10px] tracking-[0.3em] text-white/40 uppercase">Scroll</p>
            </Reveal>
          </section>
        </InView>

        {/* Who we are */}
        <InView root={scroller} onEnter={enter({ formation: 'design', centered: false })}>
          <section className="mx-auto flex min-h-screen max-w-[1320px] flex-col justify-center px-8 py-24 sm:px-12 lg:pl-[8vw]">
            <Kicker root={scroller} n="01" label="Who we are" />
            <Reveal root={scroller} delay={100}>
              <h2 className="mt-6 max-w-[13ch] text-[clamp(44px,5.6vw,100px)] leading-[1.03] font-[560] tracking-[-0.05em]">An independent creative technology studio.</h2>
            </Reveal>
            <Reveal root={scroller} delay={240}>
              <p className="mt-8 max-w-[46ch] text-[clamp(16px,1.25vw,20px)] leading-relaxed text-white/55">
                OXIA Labs is a creative technology studio. We obsess over design, over the technology underneath it, and over making everything
                feel right and look beautiful. Every decision is deliberate, and nothing ships until it feels inevitable.
              </p>
            </Reveal>
            <div className="mt-16 grid max-w-[880px] gap-10 sm:grid-cols-3">
              {PILLARS.map(([name, text], i) => (
                <Reveal key={name} root={scroller} delay={360 + i * 120}>
                  <div className="border-t border-white/15 pt-5">
                    <div className="text-[20px] font-[560] tracking-[-0.02em]">{name}</div>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/50">{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        </InView>

        {/* Why: the manifesto lights up as you read */}
        <InView root={scroller} onEnter={enter({ formation: 'welcome', centered: true })}>
          <section className="mx-auto flex min-h-[140vh] max-w-[1100px] flex-col justify-center px-8 py-24 text-center">
            <Kicker root={scroller} n="02" label="Why" centered />
            <ScrollText root={scroller} text={MANIFESTO} />
          </section>
        </InView>

        {/* What we made */}
        <InView root={scroller} onEnter={enter({ formation: 'rooms', centered: false })}>
          <section className="mx-auto flex min-h-screen max-w-[1320px] flex-col justify-center px-8 py-24 sm:px-12 lg:pl-[8vw]">
            <Kicker root={scroller} n="03" label="What we made" />
            <Reveal root={scroller} delay={100}>
              <h2 className="mt-6 max-w-[14ch] text-[clamp(44px,5.6vw,100px)] leading-[1.03] font-[560] tracking-[-0.05em]">A game you hear as much as you play.</h2>
            </Reveal>
            <div className="mt-16 grid max-w-[880px] grid-cols-2 gap-x-10 gap-y-12 sm:grid-cols-4">
              <Stat root={scroller} value={SKIN_ORDER.length} label="Skins, each a room of light" />
              <Stat root={scroller} value={BOTS.length} label="Bots that play like people" />
              <Stat root={scroller} value={CUPS.length} label="Cups to fight through" />
              <Stat root={scroller} value={6} label="Ways to play" />
            </div>
          </section>
        </InView>

        {/* Independent */}
        <InView root={scroller} onEnter={enter({ formation: 'sound', centered: true })}>
          <section className="flex min-h-screen flex-col items-center justify-center px-8 py-24 text-center">
            <Kicker root={scroller} n="04" label="Independent" centered />
            {['No ads.', 'No store.', 'No tricks.'].map((line, i) => (
              <Reveal key={line} root={scroller} delay={150 + i * 180}>
                <div className="text-[clamp(52px,8vw,150px)] leading-[1.02] font-[600] tracking-[-0.06em]">{line}</div>
              </Reveal>
            ))}
            <Reveal root={scroller} delay={800}>
              <p className="mx-auto mt-10 max-w-[38ch] text-[clamp(16px,1.3vw,20px)] leading-relaxed text-white/55">
                TETRA is independent and built out of love for the game and its music. That is the whole business plan.
              </p>
            </Reveal>
          </section>
        </InView>

        {/* Who is behind it */}
        <InView root={scroller} onEnter={enter({ formation: 'mark', centered: false })}>
          <section className="mx-auto flex min-h-screen max-w-[1320px] flex-col justify-center px-8 py-24 sm:px-12 lg:pl-[8vw]">
            <Kicker root={scroller} n="05" label="Designed and directed by" />
            <Reveal root={scroller} delay={100}>
              <div className="mt-6 text-[clamp(52px,7vw,128px)] leading-[1.02] font-[600] tracking-[-0.06em]">Miki Herrero</div>
            </Reveal>
            <Reveal root={scroller} delay={220}>
              <div className="mt-4 text-[clamp(16px,1.3vw,20px)] text-white/55">CEO &amp; Lead Designer, OXIA Labs</div>
            </Reveal>
            <Reveal root={scroller} delay={380}>
              <div className="mt-16 flex flex-wrap items-center gap-10">
                <TextLink onClick={onExperience} strong>
                  Take the Experience
                </TextLink>
                <TextLink onClick={onBack}>Play TETRA</TextLink>
              </div>
            </Reveal>
          </section>
        </InView>

        <footer className="relative mx-auto flex max-w-[1320px] flex-wrap items-end justify-between gap-8 border-t border-white/10 px-8 pt-10 pb-14 sm:px-12">
          <div>
            <div className="text-[22px] font-[600] tracking-[-0.03em]">OXIA Labs</div>
            <div className="mt-1 text-[13px] text-white/40">Creative technology. Independent.</div>
          </div>
          <nav className="flex flex-wrap items-center gap-8">
            {SOCIALS.map((s) =>
              s.url ? (
                <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className={`font-mono text-[11px] tracking-[0.24em] text-white/70 uppercase transition-colors hover:text-fg ${focusRing}`}>
                  {s.name}
                </a>
              ) : (
                <span key={s.name} className="font-mono text-[11px] tracking-[0.24em] text-white/30 uppercase" title="Coming soon">
                  {s.name} <span className="text-white/20">· soon</span>
                </span>
              ),
            )}
          </nav>
        </footer>
      </main>
    </div>
  );
}

function Kicker({ root, n, label, centered = false }: { root: RefObject<HTMLDivElement | null>; n: string; label: string; centered?: boolean }) {
  return (
    <Reveal root={root}>
      <div className={`flex items-center gap-4 font-mono text-[11px] tracking-[0.24em] uppercase ${centered ? 'justify-center' : ''}`}>
        <span className="text-white/35">{n}</span>
        <span className="h-px w-10 bg-white/30" />
        <span className="text-white/70">{label}</span>
      </div>
    </Reveal>
  );
}

function TextLink({ onClick, strong = false, children }: { onClick: () => void; strong?: boolean; children: ReactNode }) {
  return (
    <button data-nav onClick={onClick} className={`group inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] uppercase ${strong ? 'text-white/85' : 'text-white/50'} ${focusRing}`}>
      <span className={`border-b pb-1 transition-colors ${strong ? 'border-white/30 group-hover:border-white' : 'border-white/15 group-hover:border-white/60'}`}>{children}</span>
      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
    </button>
  );
}

/** A number that counts up once it scrolls into view. */
function Stat({ root, value, label }: { root: RefObject<HTMLDivElement | null>; value: number; label: string }) {
  const [shown, setShown] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!shown) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setN(Math.round(value * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shown, value]);
  return (
    <InView root={root} onEnter={() => setShown(true)}>
      <div className={`transition-[opacity,transform] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
        <div className="tabular text-[clamp(52px,5vw,88px)] leading-none font-[560] tracking-[-0.05em]">{n}</div>
        <div className="mt-3 text-[13px] leading-snug text-white/50">{label}</div>
      </div>
    </InView>
  );
}

/** The manifesto: every word starts dim and lights up as the section scrolls past. */
function ScrollText({ root, text }: { root: RefObject<HTMLDivElement | null>; text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const scroller = root.current;
    const el = ref.current;
    if (!scroller || !el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // From the paragraph's top entering the lower third to its bottom passing the middle.
      const p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height + vh * 0.25)));
      setLit(Math.round(p * words.length));
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    return () => scroller.removeEventListener('scroll', update);
  }, [root, words.length]);
  return (
    <p ref={ref} className="mt-10 text-[clamp(30px,3.6vw,60px)] leading-[1.18] font-[560] tracking-[-0.035em]">
      {words.map((w, i) => (
        <span key={i} className={`transition-colors duration-500 ${i < lit ? 'text-fg' : 'text-white/15'}`}>
          {w}{' '}
        </span>
      ))}
    </p>
  );
}

/** Calls `onEnter` when its content reaches the middle of the screen. */
function InView({ root, onEnter, children }: { root: RefObject<HTMLDivElement | null>; onEnter: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const enter = useRef(onEnter);
  enter.current = onEnter;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && enter.current(), { root: root.current, rootMargin: '-45% 0px -45% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);
  return <div ref={ref}>{children}</div>;
}

/** Rises in once it scrolls into view, and stays. */
function Reveal({ root, delay = 0, children }: { root: RefObject<HTMLDivElement | null>; delay?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { root: root.current, threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);
  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform,filter] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${shown ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[6px]'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
