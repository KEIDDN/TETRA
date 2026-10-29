const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70 rounded-sm';

/** OXIA Labs elsewhere. Empty links show as "soon" until they exist. */
export const SOCIALS: { name: string; url: string }[] = [
  { name: 'X', url: '' },
  { name: 'Instagram', url: '' },
  { name: 'LinkedIn', url: '' },
  { name: 'Website', url: '' },
];

/** The studio's sign-off at the bottom of the long pages: who made it, where to find them, and the legal links. */
export function SiteFooter({ onLegal }: { onLegal?: (doc: 'terms' | 'privacy') => void }) {
  return (
    <footer className="relative mx-auto max-w-[1320px] border-t border-white/10 px-8 pt-10 pb-12 sm:px-12">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <div className="text-[22px] font-[600] tracking-[-0.03em]">OXIA Labs</div>
          <div className="mt-1 text-[13px] text-white/40">Creative technology. Independent.</div>
        </div>
        <nav className="flex flex-wrap items-center gap-8">
          {SOCIALS.map((s) =>
            s.url ? (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className={`font-mono text-[11px] tracking-[0.24em] text-white/70 uppercase transition-colors hover:text-fg ${focusRing}`}
              >
                {s.name}
              </a>
            ) : (
              <span key={s.name} className="font-mono text-[11px] tracking-[0.24em] text-white/30 uppercase" title="Coming soon">
                {s.name} <span className="text-white/20">· soon</span>
              </span>
            ),
          )}
        </nav>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-[12px] text-white/35">
        <span>© {new Date().getFullYear()} OXIA Labs. All rights reserved.</span>
        {onLegal && (
          <span className="flex items-center gap-6">
            <button onClick={() => onLegal('terms')} className={`transition-colors hover:text-fg ${focusRing}`}>
              Terms of use
            </button>
            <button onClick={() => onLegal('privacy')} className={`transition-colors hover:text-fg ${focusRing}`}>
              Privacy
            </button>
          </span>
        )}
      </div>
    </footer>
  );
}
