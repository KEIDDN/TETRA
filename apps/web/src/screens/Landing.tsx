import { useEffect, useRef } from 'react';
import { accountsEnabled } from '../lib/account';
import { useMenuNav } from '../lib/nav';
import { installed } from '../lib/platform';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Stage3D } from '../ui/experience/Stage3D';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/**
 * The front door, for a first visit: what TETRA is in one breath, and the way in.
 * Blocks drift in 3D behind it and move with the music once it plays.
 */
export function Landing({
  onEnter,
  onSignIn,
  onDownload,
  onWhy,
  onLegal,
}: {
  onEnter: () => void;
  onSignIn: () => void;
  onDownload: () => void;
  onWhy: () => void;
  onLegal: (doc: 'terms' | 'privacy') => void;
}) {
  const enter = useRef<HTMLButtonElement>(null);
  useMenuNav(undefined, true);

  useEffect(() => {
    enter.current?.focus({ preventScroll: true });
  }, []);

  const quiet = `rounded-sm text-[13px] text-white/50 transition-colors hover:text-fg ${focusRing}`;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-fg">
      <Stage3D formation="welcome" className="animate-fade absolute inset-0 opacity-70 [animation-duration:2.4s]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_50%,rgba(0,0,0,0.75),transparent_100%)]" />

      <header className="relative z-10 flex h-24 items-center justify-between px-8 sm:px-12">
        <Logo large className="animate-rise" />
        <nav className="animate-rise flex items-center gap-6 [animation-delay:120ms]">
          <button onClick={onWhy} className={quiet}>
            Why TETRA
          </button>
          {accountsEnabled && (
            <button onClick={onSignIn} className={`glass rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`}>
              Sign in
            </button>
          )}
        </nav>
      </header>

      <main className="relative z-10 grid h-[calc(100%-12rem)] place-items-center px-8 text-center">
        <div className="flex flex-col items-center">
          <span className="animate-rise font-mono text-[11px] tracking-[0.3em] text-white/50 uppercase [animation-delay:200ms]">
            OXIA Labs presents
          </span>
          <h1 className="animate-rise mt-7 text-[clamp(56px,9vw,148px)] leading-[0.95] font-[560] tracking-[-0.055em] [animation-delay:320ms]">
            Feel the blocks.
          </h1>
          <p className="animate-rise mt-8 max-w-[40ch] text-[clamp(16px,1.35vw,20px)] leading-relaxed text-white/60 [animation-delay:440ms]">
            A game of falling blocks made as an audiovisual experience: every drop lands on the beat. Free, with no ads.
          </p>
          <div className="animate-rise mt-12 flex flex-wrap items-center justify-center gap-4 [animation-delay:560ms]">
            <button
              ref={enter}
              data-nav
              onClick={onEnter}
              className={`glass-light group flex h-14 items-center gap-3 rounded-full pr-3 pl-7 text-[17px] font-semibold ${focusRing}`}
            >
              Enter TETRA
              <span className="grid size-9 place-items-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5">
                <Icon name="next" size={12} />
              </span>
            </button>
            {!installed() && (
              <button
                data-nav
                onClick={onDownload}
                className={`glass flex h-14 items-center gap-2.5 rounded-full px-6 text-[16px] font-medium ${focusRing}`}
              >
                <Icon name="download" size={13} />
                Get the app
              </button>
            )}
          </div>
        </div>
      </main>

      <footer className="animate-fade absolute inset-x-0 bottom-0 z-10 flex h-24 items-center justify-between px-8 [animation-delay:800ms] sm:px-12">
        <span className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
          <Icon name="headphones" size={11} /> Best with headphones
        </span>
        <span className="flex items-center gap-6">
          <button onClick={() => onLegal('terms')} className={quiet}>
            Terms
          </button>
          <button onClick={() => onLegal('privacy')} className={quiet}>
            Privacy
          </button>
          <span className="hidden text-[13px] text-white/30 sm:inline">© {new Date().getFullYear()} OXIA Labs</span>
        </span>
      </footer>
    </div>
  );
}
