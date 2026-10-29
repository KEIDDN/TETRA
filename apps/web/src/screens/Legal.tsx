import { useState, type ReactNode } from 'react';
import { useMenuNav } from '../lib/nav';
import { Logo } from '../ui/Logo';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

export type LegalDoc = 'terms' | 'privacy';

const UPDATED = 'October 29, 2026';
/** Where players can write to OXIA Labs about their data. Empty until there is a public address. */
export const LEGAL_CONTACT = '';

function Contact() {
  return LEGAL_CONTACT ? (
    <a href={`mailto:${LEGAL_CONTACT}`} className="text-fg underline decoration-white/30 underline-offset-4 hover:decoration-white">
      {LEGAL_CONTACT}
    </a>
  ) : (
    <>OXIA Labs through the channels listed on the Why TETRA page</>
  );
}

/** Terms of use and the privacy policy, in plain words. */
export function Legal({ doc: initial = 'privacy', onBack }: { doc?: LegalDoc; onBack: () => void }) {
  const [doc, setDoc] = useState<LegalDoc>(initial);
  useMenuNav(onBack, true);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-fg">
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between bg-gradient-to-b from-black via-black/90 to-transparent px-8 sm:px-12">
        <Logo />
        <button data-nav onClick={onBack} className={`font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase transition-colors hover:text-fg ${focusRing}`}>
          Close
        </button>
      </header>

      <main className="mx-auto max-w-[720px] px-8 pt-16 pb-28 sm:px-12">
        <div className="glass inline-flex rounded-full p-1">
          {(
            [
              ['terms', 'Terms'],
              ['privacy', 'Privacy'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              data-nav
              onClick={() => setDoc(id)}
              className={`rounded-full px-5 py-2 text-[14px] font-medium transition-colors duration-300 ${focusRing} ${
                doc === id ? 'bg-white text-black' : 'text-white/60 hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <article key={doc} className="animate-fade mt-14">
          <h1 className="text-[clamp(40px,5vw,64px)] leading-[1.04] font-[560] tracking-[-0.045em]">{doc === 'terms' ? 'Terms of use.' : 'Your data.'}</h1>
          <p className="mt-4 font-mono text-[11px] tracking-[0.2em] text-white/40 uppercase">Last updated {UPDATED}</p>
          {doc === 'terms' ? <Terms /> : <Privacy />}
        </article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[22px] font-[560] tracking-[-0.02em]">{title}</h2>
      <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-white/60 [&_b]:font-medium [&_b]:text-fg [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <>
      <p className="mt-8 text-[18px] leading-relaxed text-white/70">
        TETRA keeps as little about you as it can. No ads, no analytics, no tracking, and nothing is ever sold. This page says exactly what is kept, where, and how to take
        it back.
      </p>

      <Section title="Who is responsible">
        <p>
          TETRA is made by <b>OXIA Labs</b>, an independent studio, which is responsible for your data. Questions or requests: contact <Contact />.
        </p>
      </Section>

      <Section title="Playing without an account">
        <p>
          As a guest, or before you sign in, nothing about you reaches us. Settings and progress live only in your browser or app on this device, and a guest's stats aren't
          kept at all.
        </p>
      </Section>

      <Section title="What your account keeps">
        <ul>
          <li>
            <b>Your email address</b>, and the account id from Google or Apple if you sign in with them.
          </li>
          <li>
            <b>Your game</b>: player name, level and XP, time played, records and recent runs, trophies, cups, skins, music choices and settings.
          </li>
          <li>When it was last saved.</li>
        </ul>
        <p>That's all. We use it for one thing: to keep your progress and give it back to you on every device.</p>
      </Section>

      <Section title="Where it lives">
        <ul>
          <li>
            <b>Supabase</b> runs the sign-in and the database. Your data is stored in the European Union (Stockholm, Sweden).
          </li>
          <li>
            <b>Vercel</b> serves the website. Like any web server it sees your IP address to send you the page.
          </li>
          <li>
            <b>GitHub</b> hosts the desktop downloads and updates.
          </li>
          <li>
            <b>Google</b> or <b>Apple</b>, only if you choose to sign in with them.
          </li>
          <li>
            Some music streams from the <b>Internet Archive</b> (archive.org), so your device connects to it while those tracks play.
          </li>
        </ul>
        <p>Each of them only handles what it needs to do its part.</p>
      </Section>

      <Section title="Cookies">
        <p>
          TETRA uses no cookies for ads or tracking. It saves your settings and progress in your browser's local storage, and keeps you signed in, because the game needs that
          to work.
        </p>
      </Section>

      <Section title="Your rights">
        <ul>
          <li>
            <b>See and take your data</b>: Profile → Download my data.
          </li>
          <li>
            <b>Correct it</b>: change your name in Profile at any time.
          </li>
          <li>
            <b>Delete it</b>: Profile → Delete account. Your account and everything in it are removed at once.
          </li>
        </ul>
        <p>
          The legal basis is providing the service you asked for (GDPR art. 6.1.b). You can also object, ask for limits on use, or complain to your data protection
          authority (in Spain, the AEPD).
        </p>
      </Section>

      <Section title="How long">
        <p>Until you delete your account. Copies in our providers' backups expire on their own schedule.</p>
      </Section>

      <Section title="Children">
        <p>If you are under 14, ask a parent or guardian before creating an account.</p>
      </Section>

      <Section title="Changes">
        <p>If this changes, the date at the top changes too, and anything important is announced in the game.</p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <p className="mt-8 text-[18px] leading-relaxed text-white/70">
        TETRA is a game. These terms keep it fair and simple: play it, enjoy it, and don't use it to harm anyone or the game itself.
      </p>

      <Section title="The game">
        <p>
          TETRA is made by OXIA Labs and is free to play for your own personal, non-commercial use, in the browser, as an installed web app, or as the desktop app. We
          improve it often, so features can change, and some (like Multiplayer and Leaderboards) are still on their way.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>An account is optional. You can play everything as a guest.</li>
          <li>One account per person. Keep access to your email or sign-in provider safe; anything done with your account is your responsibility.</li>
          <li>Pick a player name that doesn't impersonate anyone or offend.</li>
          <li>You can delete your account at any time from your Profile.</li>
        </ul>
      </Section>

      <Section title="Play fair">
        <p>
          Don't cheat, tamper with saved data or scores, attack or overload the service, or try to reach other players' data. We may reset records or close accounts
          that do.
        </p>
      </Section>

      <Section title="What belongs to whom">
        <p>
          The TETRA name, design, code, sound and the OXIA Originals music belong to OXIA Labs. Other music is used under the licences shown in the Music library, with
          credit to its artists. Please don't copy or redistribute the game or its music.
        </p>
      </Section>

      <Section title="No guarantees">
        <p>
          We make TETRA with care, but it is provided as it is, without warranties. As far as the law allows, OXIA Labs isn't liable for indirect losses, or for lost
          progress caused by things outside our control. Nothing here limits rights you have as a consumer.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If these terms change, the date at the top changes too. These terms are governed by Spanish law. Questions: contact <Contact />.
        </p>
      </Section>
    </>
  );
}
