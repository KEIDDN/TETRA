import { useEffect, useRef, useState } from 'react';
import { useAccount } from '../lib/account';
import { useMenuNav } from '../lib/nav';
import { PATCH_NOTES } from '../lib/patchNotes';
import { desktop } from '../lib/platform';
import { Glyph } from '../ui/Glyph';
import { Icon } from '../ui/Icon';
import { Stage3D } from '../ui/experience/Stage3D';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/**
 * The desktop app's title screen: the name, the way in, and the way out.
 * Blocks circle in 3D behind it; what's new sits on the right.
 */
export function Title({ onPlay, onSettings }: { onPlay: () => void; onSettings: () => void }) {
  const play = useRef<HTMLButtonElement>(null);
  const [quitting, setQuitting] = useState(false);
  const account = useAccount();
  useMenuNav(() => setQuitting(true), !quitting);
  useEffect(() => {
    play.current?.focus({ preventScroll: true });
    // The splash stays up until the 3D is drawing, so nothing stutters on the way in.
    const fallback = window.setTimeout(() => desktop?.ready?.(), 4000);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-fg">
      <Stage3D
        formation="welcome"
        onReady={() => desktop?.ready?.()}
        className="animate-fade pointer-events-none absolute inset-0 opacity-80 [animation-duration:2.4s]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.2)_70%,rgba(0,0,0,0.6)_100%)]" />

      <div className="relative mx-auto grid h-full max-w-[1400px] grid-cols-[minmax(0,1fr)_minmax(320px,400px)] items-center gap-16 px-[clamp(32px,6vw,96px)]">
        <div>
          <div className="animate-rise flex items-center gap-5">
            <svg width="72" height="72" viewBox="0 0 64 64" aria-hidden>
              <g fill="#fbfbfc">
                <rect x="4" y="12" width="17" height="17" rx="4.5" />
                <rect x="23.5" y="12" width="17" height="17" rx="4.5" />
                <rect x="43" y="12" width="17" height="17" rx="4.5" />
                <rect x="23.5" y="31.5" width="17" height="17" rx="4.5" />
              </g>
            </svg>
          </div>
          <h1 className="animate-rise mt-6 text-[clamp(96px,13vw,200px)] leading-[0.86] font-[600] tracking-[-0.06em] [animation-delay:80ms]">TETRA</h1>
          <div className="animate-rise mt-5 font-mono text-[11px] tracking-[0.3em] text-white/50 uppercase [animation-delay:160ms]">
            Feel the blocks · OXIA Labs
          </div>

          <nav className="animate-rise mt-14 flex w-[min(340px,100%)] flex-col gap-3 [animation-delay:260ms]">
            <button
              ref={play}
              data-nav
              onClick={onPlay}
              className={`glass-light group flex h-16 items-center justify-between rounded-full pr-3 pl-8 text-[20px] font-semibold ${focusRing}`}
            >
              Play
              <span className="grid size-10 place-items-center rounded-full bg-black/10 transition-transform duration-300 group-hover:translate-x-0.5">
                <Icon name="play" size={12} />
              </span>
            </button>
            <button data-nav onClick={onSettings} className={`glass flex h-14 items-center gap-3 rounded-full px-8 text-[17px] font-medium ${focusRing}`}>
              <Icon name="settings" size={13} /> Settings
            </button>
            <button
              data-nav
              onClick={() => setQuitting(true)}
              className={`glass flex h-14 items-center gap-3 rounded-full px-8 text-[17px] font-medium text-white/80 ${focusRing}`}
            >
              <Icon name="close" size={12} /> Quit game
            </button>
          </nav>
        </div>

        <aside className="glass-panel animate-rise max-h-[min(70vh,620px)] overflow-y-auto rounded-[32px] p-8 [animation-delay:340ms]">
          <div className="font-mono text-[10px] tracking-[0.24em] text-white/45 uppercase">What's new</div>
          {PATCH_NOTES.map((release, i) => (
            <section key={release.version} className={i ? 'mt-8 border-t border-white/[0.07] pt-6 opacity-60' : 'mt-4'}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[24px] font-[560] tracking-[-0.03em]">TETRA {release.version}</span>
                <span className="text-[12px] text-white/40">{release.date}</span>
              </div>
              <ul className="mt-4 space-y-2.5">
                {release.notes.map((note) => (
                  <li key={note} className="flex gap-3 text-[14px] leading-snug text-white/65">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/40" />
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-between px-[clamp(32px,6vw,96px)] font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">
        <span className="flex items-center gap-6">
          <span className="flex items-center gap-2">
            <Glyph k="vertical" /> Select
          </span>
          <span className="flex items-center gap-2">
            <Glyph k="confirm" /> Confirm
          </span>
          <span className="flex items-center gap-2">
            <Glyph k="back" /> Quit
          </span>
        </span>
        <span>
          {[account.mode === 'user' ? account.email : account.mode === 'guest' ? 'Guest' : null, `v${__APP_VERSION__}`, `© ${new Date().getFullYear()} OXIA Labs`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </footer>

      {quitting && (
        <QuitDialog
          onStay={() => {
            setQuitting(false);
            requestAnimationFrame(() => play.current?.focus({ preventScroll: true }));
          }}
        />
      )}
    </div>
  );
}

/** Are you sure? Stay is the default, so a stray press never closes the game. */
export function QuitDialog({ onStay }: { onStay: () => void }) {
  const stay = useRef<HTMLButtonElement>(null);
  const account = useAccount();
  useMenuNav(onStay, true);
  useEffect(() => stay.current?.focus({ preventScroll: true }), []);
  return (
    <div className="animate-fade fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby="quit-title" className="glass-panel animate-rise w-[min(420px,90vw)] rounded-[32px] p-8 text-center">
        <h2 id="quit-title" className="text-[28px] font-[560] tracking-[-0.03em]">
          Quit TETRA?
        </h2>
        <p className="mt-2 text-[15px] text-white/55">{account.mode === 'guest' ? "As a guest, this session's progress isn't kept." : 'Your progress is saved.'}</p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button ref={stay} data-nav onClick={onStay} className={`glass h-12 rounded-full text-[16px] font-medium ${focusRing}`}>
            Stay
          </button>
          <button data-nav onClick={() => desktop?.quit?.() ?? window.close()} className={`glass-light h-12 rounded-full text-[16px] font-semibold ${focusRing}`}>
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
