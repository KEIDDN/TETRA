import { useEffect, useState, type ReactNode } from 'react';
import { useMenuNav } from '../lib/nav';
import { canPromptInstall, detectOs, DOWNLOADS, onInstallAvailable, promptInstall } from '../lib/platform';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** Get the app: the desktop builds, and how to put TETRA on a phone's home screen. */
export function Download({ onBack }: { onBack: () => void }) {
  const os = detectOs();
  const [installable, setInstallable] = useState(canPromptInstall());
  useMenuNav(onBack, true);
  useEffect(() => onInstallAvailable(() => setInstallable(true)), []);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-fg">
      <header className="fixed inset-x-0 top-0 z-20 flex h-20 items-center justify-between bg-gradient-to-b from-black to-transparent px-8 sm:px-12">
        <span className="font-mono text-[11px] font-medium tracking-[0.24em] uppercase">
          TETRA <span className="text-white/40">· Get the app</span>
        </span>
        <button data-nav onClick={onBack} className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}>
          Close
        </button>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 pt-36 pb-24 sm:px-12">
        <div className="animate-rise">
          <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Desktop</span>
          <h1 className="mt-5 max-w-[14ch] text-[clamp(44px,6vw,96px)] leading-[1.03] font-[560] tracking-[-0.05em]">TETRA, in its own window.</h1>
          <p className="mt-6 max-w-[44ch] text-[clamp(16px,1.3vw,20px)] leading-relaxed text-white/55">
            The full Experience without a browser around it: true fullscreen, nothing in the way, and your progress with you.
          </p>
        </div>

        <div className="animate-rise mt-12 grid gap-4 [animation-delay:120ms] sm:grid-cols-2">
          <Platform name="macOS" detail="Apple silicon and Intel · .dmg" href={DOWNLOADS.mac} suggested={os === 'mac'} />
          <Platform name="Windows" detail="Windows 10 and 11 · installer" href={DOWNLOADS.windows} suggested={os === 'windows'} />
        </div>
        {installable && (
          <button onClick={() => void promptInstall()} className={`glass mt-4 rounded-full px-5 py-2.5 text-[14px] font-medium ${focusRing}`}>
            Or install it from this browser
          </button>
        )}

        <div className="animate-rise mt-28 [animation-delay:240ms]">
          <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Phone and tablet</span>
          <h2 className="mt-5 max-w-[16ch] text-[clamp(36px,4.4vw,72px)] leading-[1.04] font-[560] tracking-[-0.045em]">Put TETRA on your home screen.</h2>
          <p className="mt-6 max-w-[48ch] text-[clamp(16px,1.2vw,19px)] leading-relaxed text-white/55">
            No store needed. It opens fullscreen like any app and keeps working offline. Pair a controller or a keyboard to play.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Steps
              title="iPhone and iPad"
              note="In Safari"
              highlighted={os === 'ios'}
              steps={[
                'Open TETRA in Safari.',
                <>
                  Tap <b className="font-medium text-fg">Share</b>, the square with an arrow.
                </>,
                <>
                  Choose <b className="font-medium text-fg">Add to Home Screen</b>.
                </>,
                <>
                  Tap <b className="font-medium text-fg">Add</b>. TETRA is on your home screen.
                </>,
              ]}
            />
            <Steps
              title="Android"
              note="In Chrome"
              highlighted={os === 'android'}
              steps={[
                'Open TETRA in Chrome.',
                <>
                  Tap the <b className="font-medium text-fg">⋮</b> menu, top right.
                </>,
                <>
                  Choose <b className="font-medium text-fg">Install app</b> or <b className="font-medium text-fg">Add to Home screen</b>.
                </>,
                <>
                  Confirm with <b className="font-medium text-fg">Install</b>.
                </>,
              ]}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function Platform({ name, detail, href, suggested }: { name: string; detail: string; href: string; suggested: boolean }) {
  return (
    <a href={href} className={`${suggested ? 'glass-light' : 'glass'} group flex items-center justify-between rounded-[30px] px-8 py-7 ${focusRing}`}>
      <span>
        <span className="block text-[28px] font-[560] tracking-[-0.03em]">{name}</span>
        <span className={`mt-1 block font-mono text-[10px] tracking-[0.2em] uppercase ${suggested ? 'text-black/55' : 'text-white/45'}`}>{detail}</span>
      </span>
      <span className="flex items-center gap-3">
        {suggested && <span className="font-mono text-[10px] tracking-[0.2em] text-black/55 uppercase">For you</span>}
        <span className="text-[22px] transition-transform duration-300 group-hover:translate-y-0.5">↓</span>
      </span>
    </a>
  );
}

function Steps({ title, note, steps, highlighted }: { title: string; note: string; steps: ReactNode[]; highlighted: boolean }) {
  return (
    <div className={`glass-panel rounded-[30px] p-8 ${highlighted ? 'ring-1 ring-white/30' : ''}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-[22px] font-[560] tracking-[-0.02em]">{title}</span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">{note}</span>
      </div>
      <ol className="mt-6 space-y-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-4 text-[15px] leading-relaxed text-white/60">
            <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.08] font-mono text-[12px] text-white/80">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
