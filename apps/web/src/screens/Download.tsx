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
        <button
          data-nav
          onClick={onBack}
          className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}
        >
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
          <h2 className="mt-5 max-w-[16ch] text-[clamp(36px,4.4vw,72px)] leading-[1.04] font-[560] tracking-[-0.045em]">
            Put TETRA on your home screen.
          </h2>
          <p className="mt-6 max-w-[48ch] text-[clamp(16px,1.2vw,19px)] leading-relaxed text-white/55">
            No store needed. It opens fullscreen like any app and keeps working offline. Pair a controller or a keyboard to play.
          </p>
          <PhoneGuide initial={os === 'android' ? 'android' : 'ios'} />
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
        <span className={`mt-1 block font-mono text-[10px] tracking-[0.2em] uppercase ${suggested ? 'text-black/55' : 'text-white/45'}`}>
          {detail}
        </span>
      </span>
      <span className="flex items-center gap-3">
        {suggested && <span className="font-mono text-[10px] tracking-[0.2em] text-black/55 uppercase">For you</span>}
        <span className="text-[22px] transition-transform duration-300 group-hover:translate-y-0.5">↓</span>
      </span>
    </a>
  );
}

type Phone = 'ios' | 'android';

const GUIDE: Record<Phone, { label: string; browser: string; steps: { screen: ReactNode; text: ReactNode }[] }> = {
  ios: {
    label: 'iPhone and iPad',
    browser: 'Safari',
    steps: [
      {
        screen: <SafariBar />,
        text: (
          <>
            Open TETRA in Safari and tap <b className="font-medium text-fg">Share</b>. If you don't see it, it's in the{' '}
            <b className="font-medium text-fg">⋯</b> menu.
          </>
        ),
      },
      {
        screen: <MenuSheet rows={['Copy', 'Add Bookmark', 'Add to Home Screen', 'Find on Page']} pick={2} />,
        text: (
          <>
            Scroll down and choose <b className="font-medium text-fg">Add to Home Screen</b>.
          </>
        ),
      },
      {
        screen: <HomeScreen />,
        text: (
          <>
            Tap <b className="font-medium text-fg">Add</b>. TETRA opens fullscreen from its own icon.
          </>
        ),
      },
    ],
  },
  android: {
    label: 'Android',
    browser: 'Chrome',
    steps: [
      {
        screen: <ChromeBar />,
        text: (
          <>
            Open TETRA in Chrome and tap the <b className="font-medium text-fg">⋮</b> menu, top right.
          </>
        ),
      },
      {
        screen: <MenuSheet rows={['New tab', 'Bookmarks', 'Install app', 'Settings']} pick={2} top />,
        text: (
          <>
            Choose <b className="font-medium text-fg">Install app</b> (on some phones, <b className="font-medium text-fg">Add to Home screen</b>).
          </>
        ),
      },
      {
        screen: <InstallDialog />,
        text: (
          <>
            Confirm with <b className="font-medium text-fg">Install</b>. TETRA joins your apps.
          </>
        ),
      },
    ],
  },
};

/** Three illustrated steps per platform: a tiny phone shows exactly where to tap. */
function PhoneGuide({ initial }: { initial: Phone }) {
  const [phone, setPhone] = useState<Phone>(initial);
  const guide = GUIDE[phone];
  return (
    <div className="mt-10">
      <div className="glass inline-flex rounded-full p-1">
        {(Object.keys(GUIDE) as Phone[]).map((id) => (
          <button
            key={id}
            data-nav
            onClick={() => setPhone(id)}
            className={`rounded-full px-5 py-2 text-[14px] font-medium transition-colors duration-300 ${focusRing} ${
              phone === id ? 'bg-white text-black' : 'text-white/60 hover:text-fg'
            }`}
          >
            {GUIDE[id].label}
          </button>
        ))}
      </div>
      <div key={phone} className="animate-fade mt-8 grid gap-4 md:grid-cols-3">
        {guide.steps.map((step, i) => (
          <div key={i} className="glass-panel flex flex-col rounded-[30px] p-6">
            <div className="grid h-[270px] place-items-center overflow-hidden rounded-[22px] bg-gradient-to-b from-white/[0.05] to-transparent">
              <PhoneFrame>{step.screen}</PhoneFrame>
            </div>
            <div className="mt-6 flex gap-4">
              <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.1] font-mono text-[12px] text-white/85">
                {i + 1}
              </span>
              <p className="pt-0.5 text-[15px] leading-relaxed text-white/60">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-white/40">In {guide.browser}. No store, no download: TETRA updates itself every time you open it.</p>
    </div>
  );
}

/** A phone seen from the front, small enough to show the whole screen. */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[236px] w-[128px] rounded-[28px] bg-[#0c0c0e] p-[6px] shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.16),0_30px_60px_-20px_rgba(0,0,0,0.8)]">
      <div className="relative h-full overflow-hidden rounded-[24px] bg-[#161618]">{children}</div>
    </div>
  );
}

/** The thing to tap: a soft ring that keeps breathing. */
function Target({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-grid place-items-center ${className}`}>
      <span className="absolute -inset-1.5 animate-ping rounded-full bg-white/25 [animation-duration:1.8s]" />
      <span className="absolute -inset-1.5 rounded-full ring-2 ring-white/80" />
      <span className="relative">{children}</span>
    </span>
  );
}

function PageLines() {
  return (
    <div className="space-y-2 px-4 pt-14">
      <div className="h-2 w-16 rounded-full bg-white/20" />
      <div className="h-1.5 w-24 rounded-full bg-white/10" />
      <div className="h-1.5 w-20 rounded-full bg-white/10" />
      <div className="mt-4 grid grid-cols-4 gap-1">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="aspect-square rounded-[3px] bg-white/[0.08]" />
        ))}
      </div>
    </div>
  );
}

function SafariBar() {
  return (
    <>
      <PageLines />
      <div className="absolute inset-x-2 bottom-3 flex h-9 items-center justify-between rounded-full bg-white/[0.12] px-3 text-white/60 backdrop-blur">
        <span className="text-[11px]">‹</span>
        <span className="font-mono text-[7px] tracking-wide">tetra-blocks</span>
        <Target>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" />
          </svg>
        </Target>
      </div>
    </>
  );
}

function ChromeBar() {
  return (
    <>
      <div className="absolute inset-x-2 top-3 flex h-8 items-center gap-2 rounded-full bg-white/[0.12] pr-2 pl-3 text-white/60">
        <span className="flex-1 truncate font-mono text-[7px] tracking-wide">tetra-blocks.vercel.app</span>
        <Target>
          <span className="block px-1 text-[13px] leading-none font-bold text-white">⋮</span>
        </Target>
      </div>
      <PageLines />
    </>
  );
}

function MenuSheet({ rows, pick, top }: { rows: string[]; pick: number; top?: boolean }) {
  return (
    <>
      <PageLines />
      <div className="absolute inset-0 bg-black/50" />
      <div className={`absolute inset-x-2 rounded-[16px] bg-[#2a2a2d] py-1.5 ${top ? 'top-3' : 'bottom-3'}`}>
        {rows.map((row, i) =>
          i === pick ? (
            <div key={row} className="relative mx-1.5 my-0.5 rounded-[10px] bg-white px-2.5 py-2 text-[9px] font-semibold text-black">
              <span className="absolute -inset-0.5 animate-pulse rounded-[12px] ring-2 ring-white/70" />
              {row}
            </div>
          ) : (
            <div key={row} className="px-4 py-2 text-[9px] text-white/50">
              {row}
            </div>
          ),
        )}
      </div>
    </>
  );
}

function HomeScreen() {
  return (
    <div className="grid grid-cols-4 gap-x-2 gap-y-3 px-3 pt-12">
      {Array.from({ length: 11 }, (_, i) => (
        <div key={i} className="aspect-square rounded-[8px] bg-white/[0.1]" />
      ))}
      <Target className="aspect-square w-full">
        <img src="/apple-touch-icon.png" alt="" className="w-full rounded-[8px]" />
      </Target>
    </div>
  );
}

function InstallDialog() {
  return (
    <>
      <PageLines />
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-[16px] bg-[#2a2a2d] p-3">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" className="size-6 rounded-[6px]" />
          <span className="text-[10px] font-semibold">Install TETRA?</span>
        </div>
        <div className="mt-4 flex justify-end gap-3 text-[9px]">
          <span className="py-1 text-white/50">Cancel</span>
          <Target>
            <span className="block rounded-full bg-white px-3 py-1 font-semibold text-black">Install</span>
          </Target>
        </div>
      </div>
    </>
  );
}
