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
  const [notes, setNotes] = useState(false);
  const account = useAccount();
  useMenuNav(() => setQuitting(true), !quitting && !notes);
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.2)_70%,rgba(0,0,0,0.6)_100%)]"
      />

      <div className="relative mx-auto grid h-full max-w-[1400px] items-center px-[clamp(32px,6vw,96px)]">
        <div>
          {/* The lockup: the T sits on the wordmark's cap height, the way the logo is drawn everywhere else. */}
          <h1 className="animate-rise flex items-center gap-[0.18em] text-[clamp(96px,12vw,184px)] leading-none font-[600] tracking-[-0.06em]">
            <svg viewBox="4 12 56 36.5" className="h-[0.72em] w-auto shrink-0 translate-y-[0.05em]" aria-hidden>
              <g fill="#fbfbfc">
                <rect x="4" y="12" width="17" height="17" rx="4.5" />
                <rect x="23.5" y="12" width="17" height="17" rx="4.5" />
                <rect x="43" y="12" width="17" height="17" rx="4.5" />
                <rect x="23.5" y="31.5" width="17" height="17" rx="4.5" />
              </g>
            </svg>
            TETRA
          </h1>
          <p className="animate-rise mt-6 text-[clamp(22px,2.2vw,32px)] font-[500] tracking-[-0.02em] text-white/80 [animation-delay:100ms]">
            Feel the blocks.
          </p>
          <div className="animate-rise mt-3 font-mono text-[11px] tracking-[0.3em] text-white/45 uppercase [animation-delay:160ms]">By OXIA Labs</div>

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
            <button
              data-nav
              onClick={onSettings}
              className={`glass flex h-14 items-center gap-3 rounded-full px-8 text-[17px] font-medium ${focusRing}`}
            >
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
        <span className="flex items-center gap-6">
          <button
            data-nav
            onClick={() => setNotes(true)}
            className={`glass flex items-center gap-3 rounded-full py-2 pr-4 pl-3 font-sans text-[13px] font-medium tracking-normal text-fg normal-case ${focusRing}`}
          >
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black">New</span>
            What's new in {PATCH_NOTES[0].version}
          </button>
          <span>
            {[
              account.mode === 'user' ? account.email : account.mode === 'guest' ? 'Guest' : null,
              `v${__APP_VERSION__}`,
              `© ${new Date().getFullYear()} OXIA Labs`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </footer>

      {notes && (
        <PatchNotes
          onClose={() => {
            setNotes(false);
            requestAnimationFrame(() => play.current?.focus({ preventScroll: true }));
          }}
        />
      )}
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

/** Every version's notes, over a dimmed title screen. */
function PatchNotes({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useMenuNav(onClose, true);
  useEffect(() => close.current?.focus({ preventScroll: true }), []);
  return (
    <div className="animate-fade fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xl" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What's new"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-[760px] px-8 py-[10vh]"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">What's new</span>
          <button
            ref={close}
            data-nav
            onClick={onClose}
            className={`glass flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`}
          >
            Close <Glyph k="back" className="text-white/45" />
          </button>
        </div>
        {PATCH_NOTES.map((release, i) => (
          <section key={release.version} className={`animate-rise ${i ? 'mt-14 opacity-60' : 'mt-10'}`} style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-4">
              <h2 className="text-[clamp(36px,4vw,56px)] leading-none font-[560] tracking-[-0.045em]">TETRA {release.version}</h2>
              <span className="text-[14px] text-white/45">{release.date}</span>
            </div>
            <ul className="mt-6 space-y-3.5">
              {release.notes.map((note) => (
                <li key={note} className="flex gap-4 text-[17px] leading-relaxed text-white/75">
                  <span className="mt-[11px] size-1.5 shrink-0 rounded-[2px] bg-white/50" />
                  {note}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quit-title"
        className="glass-panel animate-rise w-[min(420px,90vw)] rounded-[32px] p-8 text-center"
      >
        <h2 id="quit-title" className="text-[28px] font-[560] tracking-[-0.03em]">
          Quit TETRA?
        </h2>
        <p className="mt-2 text-[15px] text-white/55">
          {account.mode === 'guest' ? "As a guest, this session's progress isn't kept." : 'Your progress is saved.'}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <button ref={stay} data-nav onClick={onStay} className={`glass h-12 rounded-full text-[16px] font-medium ${focusRing}`}>
            Stay
          </button>
          <button
            data-nav
            onClick={() => desktop?.quit?.() ?? window.close()}
            className={`glass-light h-12 rounded-full text-[16px] font-semibold ${focusRing}`}
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
