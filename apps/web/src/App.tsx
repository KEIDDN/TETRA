import type { ModeId } from '@tetra/engine';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { sfx } from './audio/sfx';
import { gamepads } from './game/gamepad';
import { Toasts } from './ui/toast';
import { DevBadge } from './ui/DevBadge';
import { UpdateBanner } from './ui/UpdateBanner';
import { LogoIntro } from './ui/LogoIntro';
import { director } from './audio/director';
import { getSettings as readSettings } from './lib/settings';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { VersusPlay } from './screens/VersusPlay';
import { getCustomBots } from './lib/customBots';
import type { ProfileSection } from './screens/Profile';
import { Title } from './screens/Title';
import { desktop } from './lib/platform';
import type { LegalDoc } from './screens/Legal';
import { accountsEnabled, askedForReset, getAccount, useAccount, useRecovering } from './lib/account';
import { NamePrompt } from './ui/NamePrompt';
import { BugReportDialog } from './ui/BugReport';
import { useBugReportOpen } from './lib/feedback';
import { useProfile } from './lib/profile';
import { load, save } from './lib/storage';
import { updateSettings } from './lib/settings';
import { entrantProfile, getTournament, isYou, report, roundName, runner } from './lib/tournament';

// Screens load when first opened (and quietly in the background once the first one is up), so start-up stays light.
const loadSettings = () => import('./screens/Settings');
const Settings = lazy(() => loadSettings().then((m) => ({ default: m.Settings })));
const loadVersusSelect = () => import('./screens/VersusSelect');
const VersusSelect = lazy(() => loadVersusSelect().then((m) => ({ default: m.VersusSelect })));
const loadBotEditor = () => import('./screens/BotEditor');
const BotEditor = lazy(() => loadBotEditor().then((m) => ({ default: m.BotEditor })));
const loadTournaments = () => import('./screens/Tournaments');
const Tournaments = lazy(() => loadTournaments().then((m) => ({ default: m.Tournaments })));
const loadTournamentBuilder = () => import('./screens/TournamentBuilder');
const TournamentBuilder = lazy(() => loadTournamentBuilder().then((m) => ({ default: m.TournamentBuilder })));
const loadBracket = () => import('./screens/Bracket');
const Bracket = lazy(() => loadBracket().then((m) => ({ default: m.Bracket })));
const loadMusicLab = () => import('./screens/MusicLab');
const MusicLab = lazy(() => loadMusicLab().then((m) => ({ default: m.MusicLab })));
const loadExperience = () => import('./screens/Experience');
const Experience = lazy(() => loadExperience().then((m) => ({ default: m.Experience })));
const loadOxia = () => import('./screens/Oxia');
const Oxia = lazy(() => loadOxia().then((m) => ({ default: m.Oxia })));
const loadDownload = () => import('./screens/Download');
const Download = lazy(() => loadDownload().then((m) => ({ default: m.Download })));
const loadAccount = () => import('./screens/Account');
const Account = lazy(() => loadAccount().then((m) => ({ default: m.Account })));
const loadLanding = () => import('./screens/Landing');
const Landing = lazy(() => loadLanding().then((m) => ({ default: m.Landing })));
const loadLegal = () => import('./screens/Legal');
const Legal = lazy(() => loadLegal().then((m) => ({ default: m.Legal })));
const loadProfile = () => import('./screens/Profile');
const Profile = lazy(() => loadProfile().then((m) => ({ default: m.Profile })));
const PRELOAD = [loadSettings, loadVersusSelect, loadBotEditor, loadTournaments, loadTournamentBuilder, loadBracket, loadMusicLab, loadExperience, loadOxia, loadDownload, loadAccount, loadLanding, loadLegal, loadProfile];

const VIEW_TRANSITIONS = typeof document !== 'undefined' && 'startViewTransition' in document;

type SettingsTab = 'appearance' | 'sound' | 'controls';
type Screen =
  | { name: 'home' }
  | { name: 'play'; mode: ModeId; back?: 'musiclab' }
  | { name: 'musiclab' }
  | { name: 'experience'; firstRun?: boolean; back?: 'settings' }
  | { name: 'oxia' }
  | { name: 'download' }
  | { name: 'account'; back?: boolean; reset?: boolean }
  | { name: 'landing' }
  | { name: 'title' }
  | { name: 'legal'; doc: LegalDoc }
  | { name: 'settings'; tab?: SettingsTab }
  | { name: 'versus' }
  | { name: 'editor'; id?: string }
  | { name: 'match'; botId: string; firstTo: number }
  | { name: 'profile'; section?: ProfileSection }
  | { name: 'cups' }
  | { name: 'builder' }
  | { name: 'bracket' }
  | { name: 'bout'; r: number; i: number };

export function App() {
  // First visit: the landing, then the Experience, then (with accounts) sign in or play as guest.
  // Later launches ask once if they never chose.
  // The desktop app opens on its title screen, and goes straight into the Experience the very first time.
  const [screen, setScreenNow] = useState<Screen>(() => {
    if (!load('onboarded', false)) {
      if (!desktop) return { name: 'landing' };
      save('onboarded', true);
      return { name: 'experience', firstRun: true };
    }
    if (askedForReset) return { name: 'account', back: true, reset: true };
    if (desktop) return { name: 'title' };
    return accountsEnabled && getAccount().mode === 'unknown' ? { name: 'account' } : { name: 'home' };
  });
  // Pages you step into and out of (downloads, legal, the studio) go back to wherever you came from.
  const previous = useRef<Screen[]>([]);
  const account = useAccount();
  const recovering = useRecovering();
  const profile = useProfile();
  const reportOpen = useBugReportOpen();
  // Screens change inside a view transition: the old one settles back, the new one rises, shared elements fly between them.
  const setScreen = (next: Screen) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!VIEW_TRANSITIONS || reduced) return setScreenNow(next);
    document.startViewTransition(() => flushSync(() => setScreenNow(next)));
  };
  const home = () => {
    previous.current = [];
    setScreen({ name: 'home' });
  };
  const visit = (next: Screen) => {
    previous.current.push(screen);
    setScreen(next);
  };
  const back = () => setScreen(previous.current.pop() ?? { name: 'home' });
  const backOrHome = () => (previous.current.length ? back() : home());
  const finishOnboarding = () => {
    save('onboarded', true);
    home();
  };

  // Music follows the screen: one continuous menu track, the skin's track in a game.
  useEffect(() => {
    if (screen.name === 'play' || screen.name === 'match' || screen.name === 'bout') director.enterGame(readSettings().appearance.skin);
    else director.enterMenu();
  }, [screen]);

  useEffect(() => {
    if (screen.name === 'account' && account.mode === 'user') {
      save('onboarded', true);
      setScreenNow({ name: 'home' });
    }
  }, [screen.name, account.mode]);

  // First screen drawn: the desktop splash can go, and the other screens load while nobody is waiting on them.
  useEffect(() => {
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        // The title screen says so itself, once its 3D is drawing.
        if (screen.name !== 'title') desktop?.ready?.();
      });
    });
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 1500));
    const warm = window.setTimeout(() => idle(() => PRELOAD.forEach((load) => void load())), 2500);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(warm);
    };
    // Only the first screen counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Browsers only allow audio after a gesture: unlock on the first one.
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const unsubscribe = gamepads.subscribe(unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      unsubscribe();
    };
  }, []);

  let content;
  switch (screen.name) {
    case 'play':
      content = <Play key={screen.mode} mode={screen.mode} onExit={screen.back ? () => setScreen({ name: screen.back! }) : home} />;
      break;
    case 'settings':
      content = (
        <Settings
          initialTab={screen.tab}
          onBack={backOrHome}
          onMusicLab={() => setScreen({ name: 'musiclab' })}
          onExperience={() => setScreen({ name: 'experience', back: 'settings' })}
        />
      );
      break;
    case 'versus':
      content = (
        <VersusSelect
          onBack={home}
          onPlay={(botId, firstTo) => setScreen({ name: 'match', botId, firstTo })}
          onEdit={(id) => setScreen({ name: 'editor', id })}
        />
      );
      break;
    case 'editor':
      content = (
        <BotEditor
          spec={getCustomBots().find((s) => s.id === screen.id)}
          onDone={() => setScreen({ name: 'versus' })}
          onPlay={(botId) => setScreen({ name: 'match', botId, firstTo: 3 })}
        />
      );
      break;
    case 'match':
      content = (
        <VersusPlay
          key={screen.botId}
          botId={screen.botId}
          firstTo={screen.firstTo}
          onExit={() => setScreen({ name: 'versus' })}
          onNext={(botId) => setScreen({ name: 'match', botId, firstTo: screen.firstTo })}
        />
      );
      break;
    case 'experience':
      content = (
        <Experience
          firstRun={screen.firstRun}
          onDone={() =>
            screen.back ? setScreen({ name: 'settings' }) : accountsEnabled && getAccount().mode === 'unknown' ? setScreen({ name: 'account' }) : home()
          }
          onOxia={() => visit({ name: 'oxia' })}
        />
      );
      break;
    case 'account':
      content = (
        <Account
          key={screen.reset ? 'reset' : 'account'}
          initial={screen.reset ? 'forgot' : 'signup'}
          onDone={finishOnboarding}
          onBack={screen.back ? backOrHome : undefined}
          onLegal={(doc) => visit({ name: 'legal', doc })}
        />
      );
      break;
    case 'download':
      content = <Download onBack={back} onLegal={(doc) => visit({ name: 'legal', doc })} />;
      break;
    case 'oxia':
      content = <Oxia onBack={back} onExperience={() => setScreen({ name: 'experience' })} onLegal={(doc) => visit({ name: 'legal', doc })} />;
      break;
    case 'title':
      content = (
        <Title
          onPlay={() => (accountsEnabled && getAccount().mode === 'unknown' ? visit({ name: 'account', back: true }) : home())}
          onSettings={() => visit({ name: 'settings' })}
        />
      );
      break;
    case 'legal':
      content = <Legal doc={screen.doc} onBack={back} />;
      break;
    case 'landing':
      content = (
        <Landing
          onEnter={() => {
            // Once is enough: from here on the Experience waits in the top bar.
            save('onboarded', true);
            setScreen({ name: 'experience', firstRun: true });
          }}
          onSignIn={() => visit({ name: 'account', back: true })}
          onDownload={() => visit({ name: 'download' })}
          onWhy={() => visit({ name: 'oxia' })}
          onLegal={(doc) => visit({ name: 'legal', doc })}
        />
      );
      break;
    case 'musiclab':
      content = (
        <MusicLab
          onBack={() => setScreen({ name: 'settings', tab: 'sound' })}
          onTry={(skin) => {
            updateSettings((s) => ({ ...s, appearance: { ...s.appearance, skin } }));
            setScreen({ name: 'play', mode: 'endless', back: 'musiclab' });
          }}
        />
      );
      break;
    case 'profile':
      content = (
        <Profile
          onBack={home}
          onSignIn={() => visit({ name: 'account', back: true })}
          onPrivacy={() => visit({ name: 'legal', doc: 'privacy' })}
          section={screen.section}
        />
      );
      break;
    case 'cups':
      content = <Tournaments onBack={home} onBracket={() => setScreen({ name: 'bracket' })} onCustom={() => setScreen({ name: 'builder' })} />;
      break;
    case 'builder':
      content = <TournamentBuilder onBack={() => setScreen({ name: 'cups' })} onStart={() => setScreen({ name: 'bracket' })} />;
      break;
    case 'bracket':
      content = <Bracket onBack={() => setScreen({ name: 'cups' })} onBout={(r, i) => setScreen({ name: 'bout', r, i })} />;
      break;
    case 'bout': {
      const t = getTournament();
      const bout = t?.rounds[screen.r]?.[screen.i];
      if (!t || !bout || bout.a === null || bout.b === null) {
        content = null;
        break;
      }
      // You always play on the left; when two bots meet, you watch from the left one's side.
      const flip = isYou(t, bout.b);
      const left = t.entrants[flip ? bout.b : bout.a];
      const right = t.entrants[flip ? bout.a : bout.b];
      const spectating = left.bot !== null;
      const { r, i } = screen;
      if (spectating) runner.watch(r, i);
      const back = () => {
        if (spectating) runner.unwatch(r, i);
        setScreen({ name: 'bracket' });
      };
      content = (
        <VersusPlay
          key={`${t.id}-${r}-${i}`}
          botId={right.key}
          profile={entrantProfile(right)!}
          left={entrantProfile(left) ?? undefined}
          firstTo={t.formats[r]}
          bout={{
            label: `${t.name} · ${roundName(t, r)}`,
            onResult: (score) => report(r, i, flip ? [score[1], score[0]] : score),
          }}
          onExit={back}
        />
      );
      break;
    }
    default:
      content = (
        <Home
          onPlay={(mode) => setScreen({ name: 'play', mode })}
          onVersus={() => setScreen({ name: 'versus' })}
          onCups={() => setScreen({ name: 'cups' })}
          onProfile={(section) => setScreen({ name: 'profile', section })}
          onExperience={() => setScreen({ name: 'experience' })}
          onOxia={() => visit({ name: 'oxia' })}
          onDownload={() => visit({ name: 'download' })}
          onSignIn={() => visit({ name: 'account', back: true })}
          onLegal={(doc) => visit({ name: 'legal', doc })}
          onBack={desktop ? () => setScreen({ name: 'title' }) : undefined}
          onSettings={(tab) => setScreen({ name: 'settings', tab })}
        />
      );
  }
  // Opacity-only transition: a transform here would break the game's fixed layout.
  return (
    <>
      <div key={screen.name} className={`min-h-full ${VIEW_TRANSITIONS ? '' : 'animate-fade'}`}>
        <Suspense fallback={null}>{content}</Suspense>
      </div>
      {!['play', 'match', 'bout', 'experience', 'oxia', 'account', 'download', 'landing', 'legal', 'title'].includes(screen.name) && <DevBadge key={`dev-${screen.name}`} />}
      {!['play', 'match', 'bout'].includes(screen.name) && <UpdateBanner />}
      {recovering && (
        <div className="fixed inset-0 z-[70]">
          <Suspense fallback={null}>
            <Account initial="newPassword" onDone={home} />
          </Suspense>
        </div>
      )}
      {/* Signed in without a player name yet (Google, Apple, or an older account): ask once. */}
      {account.mode === 'user' && profile.name === 'Player' && !recovering && !['play', 'match', 'bout', 'experience'].includes(screen.name) && <NamePrompt />}
      {reportOpen && <BugReportDialog />}
      <Toasts />
      {screen.name === 'home' && !desktop && <LogoIntro />}
    </>
  );
}
