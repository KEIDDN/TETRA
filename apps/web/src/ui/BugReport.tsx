import { useEffect, useRef, useState } from 'react';
import { getAccount } from '../lib/account';
import { closeBugReport, diagnostics, FEEDBACK_EMAIL, sendReport, type ReportKind } from '../lib/feedback';
import { useMenuNav } from '../lib/nav';
import { Glyph } from './Glyph';
import { Icon } from './Icon';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';
const field =
  'glass-panel w-full rounded-[18px] px-5 py-3.5 text-[15px] leading-relaxed outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-accent/60';

const KINDS: [ReportKind, string][] = [
  ['bug', 'Bug'],
  ['visual', 'Visual glitch'],
  ['idea', 'Idea'],
  ['other', 'Other'],
];

/** Tell us what broke (or what you'd love): it reaches the studio's inbox. */
export function BugReportForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [kind, setKind] = useState<ReportKind>('bug');
  const [message, setMessage] = useState('');
  const [steps, setSteps] = useState('');
  const [contact, setContact] = useState(getAccount().email ?? '');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const first = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) first.current?.focus();
  }, [autoFocus]);
  const stop = (e: React.KeyboardEvent) => e.key !== 'Escape' && e.stopPropagation();

  if (sent) {
    return (
      <div className="glass-panel animate-rise rounded-[28px] px-8 py-10 text-center">
        <span className="glass mx-auto grid size-14 place-items-center rounded-full">
          <Icon name="check" size={18} />
        </span>
        <h3 className="mt-5 text-[26px] font-[560] tracking-[-0.03em]">Thanks. It's with us.</h3>
        <p className="mx-auto mt-2 max-w-[36ch] text-[15px] leading-relaxed text-white/55">
          We read every report. If you left your email, we may write back when it's fixed.
        </p>
        <button
          data-nav
          onClick={() => {
            setSent(false);
            setMessage('');
            setSteps('');
          }}
          className={`glass mt-7 rounded-full px-5 py-2.5 text-[14px] font-medium ${focusRing}`}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void sendReport({ kind, message, steps, contact, includeDetails }).then((problem) => {
          setBusy(false);
          if (problem) setError(problem);
          else setSent(true);
        });
      }}
      className="grid gap-5"
    >
      <div className="flex flex-wrap gap-2">
        {KINDS.map(([id, name]) => (
          <button
            key={id}
            type="button"
            data-nav
            onClick={() => setKind(id)}
            className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-200 ${focusRing} ${
              kind === id ? 'bg-white text-black' : 'glass text-white/70 hover:text-fg'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <label className="grid gap-2">
        <span className="px-1 text-[13px] font-medium text-white/60">{kind === 'idea' ? 'Your idea' : 'What happened?'}</span>
        <textarea
          ref={first}
          required
          minLength={3}
          maxLength={4000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={stop}
          placeholder={kind === 'idea' ? 'What would make TETRA better?' : 'The board froze after a T-spin in Blitz…'}
          className={`${field} resize-none`}
        />
      </label>

      {kind !== 'idea' && (
        <label className="grid gap-2">
          <span className="px-1 text-[13px] font-medium text-white/60">
            How can we see it? <span className="text-white/35">Optional</span>
          </span>
          <textarea
            maxLength={4000}
            rows={3}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            onKeyDown={stop}
            placeholder={'1. Open Blitz\n2. …'}
            className={`${field} resize-none`}
          />
        </label>
      )}

      <label className="grid gap-2">
        <span className="px-1 text-[13px] font-medium text-white/60">
          Your email <span className="text-white/35">Optional, if you'd like a reply</span>
        </span>
        <input
          type="email"
          maxLength={200}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          onKeyDown={stop}
          placeholder="you@example.com"
          className={`${field} h-12 py-0`}
        />
      </label>

      <div className="px-1">
        <label className="flex cursor-pointer items-center gap-3 text-[14px] text-white/70">
          <input
            type="checkbox"
            checked={includeDetails}
            onChange={(e) => setIncludeDetails(e.target.checked)}
            className="size-4 accent-white"
          />
          Include version and device details
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className={`text-[13px] text-white/40 underline decoration-white/20 underline-offset-2 hover:text-fg ${focusRing}`}
          >
            {showDetails ? 'Hide' : 'What is sent?'}
          </button>
        </label>
        {showDetails && (
          <pre className="mt-3 max-h-40 overflow-auto rounded-[14px] bg-black/40 p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-white/50">
            {Object.entries(diagnostics())
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')}
          </pre>
        )}
      </div>

      {error && <p className="px-1 text-[14px] text-[#ff6b6b]">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          data-nav
          disabled={busy || message.trim().length < 3}
          className={`glass-light flex h-12 items-center gap-2.5 rounded-full px-7 text-[15px] font-semibold disabled:opacity-50 ${focusRing}`}
        >
          {busy ? 'Sending…' : 'Send report'}
        </button>
        <span className="text-[13px] text-white/40">
          Or write to{' '}
          <a href={`mailto:${FEEDBACK_EMAIL}`} className="text-white/70 underline decoration-white/20 underline-offset-2 hover:text-fg">
            {FEEDBACK_EMAIL}
          </a>
        </span>
      </div>
    </form>
  );
}

/** The same form over whatever screen you're on. */
export function BugReportDialog() {
  useMenuNav(closeBugReport, true);
  return (
    <div className="animate-fade fixed inset-0 z-[66] overflow-y-auto bg-black/75 backdrop-blur-xl" onClick={closeBugReport}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-rise mx-auto max-w-[620px] px-6 py-[8vh]"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Playtest</span>
          <button data-nav onClick={closeBugReport} className={`glass flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ${focusRing}`}>
            Close <Glyph k="back" className="text-white/45" />
          </button>
        </div>
        <h2 id="report-title" className="mt-6 text-[clamp(36px,4vw,52px)] leading-[1.02] font-[560] tracking-[-0.045em]">
          Found a bug?
        </h2>
        <p className="mt-3 mb-8 text-[16px] leading-relaxed text-white/55">Tell us what happened. It goes straight to the studio, and helps us make TETRA better for everyone.</p>
        <BugReportForm autoFocus />
      </div>
    </div>
  );
}
