import { useEffect, useState, type ReactNode } from 'react';
import {
  forgotPassword,
  playAsGuest,
  resendConfirmation,
  setNewPassword,
  signInProviders,
  signInWith,
  signInWithPassword,
  signUp,
} from '../lib/account';
import { desktop } from '../lib/platform';
import { useMenuNav } from '../lib/nav';
import { Icon, type IconName } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { Stage3D } from '../ui/experience/Stage3D';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/**
 * Sign in to keep your progress everywhere, or play as a guest. Email and
 * password work on every device; the confirmation link opens anywhere.
 */
const SAVED: [IconName, string][] = [
  ['profile', 'Level and XP'],
  ['records', 'Records'],
  ['trophy', 'Trophies'],
  ['skin', 'Skins'],
  ['music', 'Music'],
  ['settings', 'Settings'],
];

type Mode = 'signin' | 'signup' | 'check' | 'forgot' | 'newPassword';
const input =
  'glass-panel h-12 w-full rounded-full px-5 text-[15px] outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-accent/60';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="px-2 text-[12px] font-medium text-white/50">{label}</span>
      {children}
    </label>
  );
}

export function Account({
  onDone,
  onBack,
  onLegal,
  initial = 'signup',
}: {
  onDone: () => void;
  onBack?: () => void;
  onLegal?: (doc: 'terms' | 'privacy') => void;
  initial?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setNote(null);
  };
  const [providers, setProviders] = useState({ google: false, apple: false });
  useEffect(() => {
    void signInProviders().then(setProviders);
  }, []);
  useMenuNav(onBack, !!onBack);

  const run = async (task: () => Promise<string | null>, then?: () => void) => {
    setBusy(true);
    setError(null);
    setNote(null);
    const message = await task();
    setBusy(false);
    if (message) setError(message);
    else then?.();
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-fg">
      <Stage3D formation="welcome" className="animate-fade pointer-events-none fixed inset-0 opacity-75 [animation-duration:2.4s]" />
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(30%_42%_at_50%_58%,rgba(0,0,0,0.85),transparent_100%)]" />
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

      <div className="relative mx-auto flex min-h-[calc(100%-6rem)] max-w-[560px] flex-col items-center justify-center px-6 pb-16 text-center">
        <div className="animate-rise flex flex-col items-center">
          <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Your account</span>
          <h1 className="mt-5 text-[clamp(44px,5.4vw,80px)] leading-[1] font-[560] tracking-[-0.055em] sm:whitespace-nowrap">Keep your progress.</h1>
          <p className="mt-5 max-w-[38ch] text-[clamp(16px,1.25vw,18px)] leading-relaxed text-white/55">
            Sign in once and TETRA remembers you: on the web, on your phone and on your desktop.
          </p>
          <ul className="mt-7 flex flex-wrap justify-center gap-2">
            {SAVED.map(([icon, label]) => (
              <li key={label} className="glass flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-3 text-[13px] text-white/70">
                <Icon name={icon} size={11} />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 w-full max-w-[440px] text-left">
          <div className="glass-panel animate-rise rounded-[36px] p-8 [animation-delay:120ms] sm:p-10">
            {mode === 'signin' || mode === 'signup' ? (
              <>
                <div className="glass inline-flex w-full rounded-full p-1">
                  {(
                    [
                      ['signin', 'Sign in'],
                      ['signup', 'Create account'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      data-nav
                      onClick={() => go(id)}
                      className={`flex-1 rounded-full py-2.5 text-[14px] font-medium transition-colors duration-300 ${focusRing} ${
                        mode === id ? 'bg-white text-black' : 'text-white/60 hover:text-fg'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {(providers.apple || providers.google) && (
                  <>
                    <div className="mt-6 grid gap-3">
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

                    <div className="my-6 flex items-center gap-4 font-mono text-[10px] tracking-[0.24em] text-white/35 uppercase">
                      <span className="h-px flex-1 bg-white/10" />
                      or with email
                      <span className="h-px flex-1 bg-white/10" />
                    </div>
                  </>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mode === 'signin') void run(() => signInWithPassword(email, password), onDone);
                    else
                      void run(async () => {
                        const result = await signUp(email, password, name);
                        if ('error' in result) return result.error;
                        if ('exists' in result) {
                          go('signin');
                          return 'You already have an account with this email. Sign in, or reset your password.';
                        }
                        if ('signedIn' in result) onDone();
                        else go('check');
                        return null;
                      });
                  }}
                  className={`grid gap-3 ${providers.apple || providers.google ? '' : 'mt-6'}`}
                >
                  {mode === 'signup' && (
                    <Field label="Player name">
                      <input
                        required
                        maxLength={24}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="How others will see you"
                        autoComplete="nickname"
                        className={input}
                      />
                    </Field>
                  )}
                  <Field label="Email">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={input}
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className={input}
                    />
                  </Field>
                  <button disabled={busy} className={`glass-light mt-2 h-14 rounded-full text-[16px] font-semibold disabled:opacity-50 ${focusRing}`}>
                    {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => go('forgot')}
                      className={`text-[13px] text-white/45 transition-colors hover:text-fg ${focusRing}`}
                    >
                      Forgot your password?
                    </button>
                  )}
                </form>
              </>
            ) : mode === 'check' ? (
              <div className="grid gap-4">
                <h2 className="text-[24px] font-[560] tracking-[-0.02em]">Check your email.</h2>
                <p className="text-[15px] leading-relaxed text-white/60">
                  We sent a link to <span className="text-fg">{email}</span>. Open it on any device, your phone is fine, to confirm your account. Then
                  come back and sign in.
                </p>
                <button data-nav onClick={() => go('signin')} className={`glass-light mt-2 h-14 rounded-full text-[16px] font-semibold ${focusRing}`}>
                  I've confirmed, sign in
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => resendConfirmation(email),
                      () => setNote('Sent again. It can take a minute to arrive.'),
                    )
                  }
                  className={`text-[13px] text-white/45 transition-colors hover:text-fg ${focusRing}`}
                >
                  Didn't get it? Send it again
                </button>
              </div>
            ) : mode === 'forgot' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () => forgotPassword(email),
                    () =>
                      setNote(
                        desktop
                          ? 'We opened TETRA in your browser: reset your password there.'
                          : 'Check your email for a link to choose a new password. Open it in this browser.',
                      ),
                  );
                }}
                className="grid gap-3"
              >
                <h2 className="text-[24px] font-[560] tracking-[-0.02em]">Reset your password</h2>
                <p className="text-[15px] leading-relaxed text-white/60">
                  {desktop ? 'This opens TETRA in your browser, where you can reset it.' : "We'll email you a link to choose a new one."}
                </p>
                {!desktop && (
                  <Field label="Email">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={input}
                    />
                  </Field>
                )}
                <button disabled={busy} className={`glass-light mt-2 h-14 rounded-full text-[16px] font-semibold disabled:opacity-50 ${focusRing}`}>
                  {desktop ? 'Open in browser' : busy ? 'Sending…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  onClick={() => go('signin')}
                  className={`text-[13px] text-white/45 transition-colors hover:text-fg ${focusRing}`}
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => setNewPassword(password), onDone);
                }}
                className="grid gap-3"
              >
                <h2 className="text-[24px] font-[560] tracking-[-0.02em]">Choose a new password</h2>
                <Field label="New password">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className={input}
                  />
                </Field>
                <button disabled={busy} className={`glass-light mt-2 h-14 rounded-full text-[16px] font-semibold disabled:opacity-50 ${focusRing}`}>
                  {busy ? 'Saving…' : 'Save and play'}
                </button>
              </form>
            )}

            {note && <p className="mt-5 text-[14px] text-white/70">{note}</p>}
            {error && <p className="mt-5 text-[14px] text-[#ff6b6b]">{error}</p>}

            {(mode === 'signin' || mode === 'signup') && (
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
            )}
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
