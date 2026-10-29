import { useEffect, useState } from 'react';
import { playAsGuest, sendEmailCode, signInProviders, signInWith, verifyEmailCode } from '../lib/account';
import { useMenuNav } from '../lib/nav';
import { Icon, type IconName } from '../ui/Icon';
import { Logo } from '../ui/Logo';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/**
 * Sign in to keep your progress everywhere, or play as a guest. Email gets a
 * six-digit code; Google and Apple go through their own sign-in.
 */
const SAVED: [IconName, string][] = [
  ['profile', 'Level and XP'],
  ['records', 'Records'],
  ['trophy', 'Trophies'],
  ['skin', 'Skins'],
  ['music', 'Music'],
  ['settings', 'Settings'],
];

export function Account({ onDone, onBack, onLegal }: { onDone: () => void; onBack?: () => void; onLegal?: (doc: 'terms' | 'privacy') => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withCode, setWithCode] = useState(false);
  const [providers, setProviders] = useState({ google: false, apple: false });
  useEffect(() => {
    void signInProviders().then(setProviders);
  }, []);
  useMenuNav(onBack, !!onBack);

  const run = async (task: () => Promise<string | null>, then?: () => void) => {
    setBusy(true);
    setError(null);
    const message = await task();
    setBusy(false);
    if (message) setError(message);
    else then?.();
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-fg">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(50%_60%_at_25%_40%,rgba(237,235,250,0.07),transparent_70%)]"
      />
      <header className="relative z-10 flex h-24 items-center justify-between px-8 sm:px-12">
        <Logo className="animate-rise" />
        {onBack && (
          <button
            data-nav
            onClick={onBack}
            className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}
          >
            Close
          </button>
        )}
      </header>

      <div className="relative mx-auto grid min-h-[calc(100%-6rem)] max-w-[1180px] items-center gap-16 px-8 pb-16 sm:px-12 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="animate-rise">
          <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Your account</span>
          <h1 className="mt-6 max-w-[11ch] text-[clamp(48px,6vw,96px)] leading-[0.98] font-[560] tracking-[-0.055em]">Keep your progress.</h1>
          <p className="mt-6 max-w-[36ch] text-[clamp(16px,1.3vw,19px)] leading-relaxed text-white/55">
            Sign in once and TETRA remembers you, on the web, on your phone and on your desktop.
          </p>
          <ul className="mt-10 grid max-w-[460px] grid-cols-2 gap-x-8 gap-y-5">
            {SAVED.map(([icon, label]) => (
              <li key={label} className="flex items-center gap-3 text-[15px] text-white/70">
                <span className="glass grid size-9 shrink-0 place-items-center rounded-full">
                  <Icon name={icon} size={13} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel animate-rise rounded-[36px] p-8 [animation-delay:120ms] sm:p-10">
          <h2 className="text-[22px] font-[560] tracking-[-0.02em]">Sign in or create an account</h2>
          <p className="mt-2 text-[14px] text-white/45">No password. Same steps for both.</p>
          {(providers.apple || providers.google) && (
            <>
              <div className="mt-8 grid gap-3">
                {providers.apple && (
                  <button
                    disabled={busy}
                    onClick={() => void run(() => signInWith('apple'))}
                    className={`glass-light flex h-14 items-center justify-center gap-3 rounded-full text-[16px] font-semibold disabled:opacity-60 ${focusRing}`}
                  >
                    <AppleGlyph /> Continue with Apple
                  </button>
                )}
                {providers.google && (
                  <button
                    disabled={busy}
                    onClick={() => void run(() => signInWith('google'))}
                    className={`glass flex h-14 items-center justify-center gap-3 rounded-full text-[16px] font-medium disabled:opacity-60 ${focusRing}`}
                  >
                    <GoogleGlyph /> Continue with Google
                  </button>
                )}
              </div>

              <div className="my-8 flex items-center gap-4 font-mono text-[10px] tracking-[0.24em] text-white/35 uppercase">
                <span className="h-px flex-1 bg-white/10" />
                or with email
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </>
          )}

          <div className={providers.apple || providers.google ? '' : 'mt-8'}>
            {!sent ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () => sendEmailCode(email),
                    () => setSent(true),
                  );
                }}
                className="grid gap-3"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="glass-panel h-14 rounded-full px-6 text-[16px] outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <button disabled={busy || !email} className={`glass h-14 rounded-full text-[16px] font-medium disabled:opacity-50 ${focusRing}`}>
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
              </form>
            ) : !withCode ? (
              <div className="grid gap-3">
                <div className="glass-panel rounded-[28px] px-6 py-5">
                  <p className="text-[16px] font-medium">Check your email.</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                    We sent a sign-in link to <span className="text-fg">{email}</span>. Open it on this device and you're in.
                  </p>
                </div>
                <div className="flex justify-between px-2">
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className={`text-[13px] text-white/45 transition-colors hover:text-fg ${focusRing}`}
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithCode(true)}
                    className={`text-[13px] text-white/45 transition-colors hover:text-fg ${focusRing}`}
                  >
                    I have a code
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => verifyEmailCode(email, code), onDone);
                }}
                className="grid gap-3"
              >
                <p className="text-[14px] leading-relaxed text-white/55">
                  Type the code from the email sent to <span className="text-fg">{email}</span>.
                </p>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="123456"
                  className="glass-panel tabular h-14 rounded-full px-6 text-center text-[22px] tracking-[0.5em] outline-none placeholder:text-white/20 focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <button
                  disabled={busy || code.length < 6}
                  className={`glass-light h-14 rounded-full text-[16px] font-semibold disabled:opacity-50 ${focusRing}`}
                >
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  onClick={() => setWithCode(false)}
                  className={`text-[13px] text-white/45 transition-colors hover:text-fg ${focusRing}`}
                >
                  Back
                </button>
              </form>
            )}
          </div>

          {error && <p className="mt-5 text-[14px] text-[#ff6b6b]">{error}</p>}

          <div className="mt-8 border-t border-white/10 pt-7 text-center">
            <button
              onClick={() => {
                playAsGuest();
                onDone();
              }}
              className={`group inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.24em] text-white/70 uppercase ${focusRing}`}
            >
              <span className="border-b border-white/25 pb-1 transition-colors group-hover:border-white">Play as guest</span>
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
            <p className="mt-3 text-[13px] text-white/35">As a guest you can play everything, but nothing is saved.</p>
          </div>
          <p className="mt-8 text-center text-[12px] leading-relaxed text-white/35">
            By continuing you agree to the{' '}
            <button onClick={() => onLegal?.('terms')} className={`underline decoration-white/25 underline-offset-2 hover:text-fg ${focusRing}`}>
              Terms
            </button>{' '}
            and{' '}
            <button onClick={() => onLegal?.('privacy')} className={`underline decoration-white/25 underline-offset-2 hover:text-fg ${focusRing}`}>
              Privacy Policy
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.6-.75 3-.75 1.4 0 1.79.75 3.01.73 1.25-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.46-3.72zM14.08 5.85c.64-.78 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.02.08 2.07-.52 2.71-1.28z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        fillOpacity="0.9"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.35z"
      />
      <path
        fill="#fff"
        fillOpacity="0.75"
        d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.58A10 10 0 0 0 12 22z"
      />
      <path fill="#fff" fillOpacity="0.6" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.07a10 10 0 0 0 0 9z" />
      <path
        fill="#fff"
        fillOpacity="0.85"
        d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.58C7.2 7.72 9.4 5.96 12 5.96z"
      />
    </svg>
  );
}
