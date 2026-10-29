import type { ModeId } from '@tetra/engine';
import { useEffect, useRef, useState } from 'react';
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
import { Settings } from './screens/Settings';
import { VersusPlay } from './screens/VersusPlay';
import { VersusSelect } from './screens/VersusSelect';
import { BotEditor } from './screens/BotEditor';
import { getCustomBots } from './lib/customBots';
import { Tournaments } from './screens/Tournaments';
import { TournamentBuilder } from './screens/TournamentBuilder';
import { Bracket } from './screens/Bracket';
import { Profile, type ProfileSection } from './screens/Profile';
import { MusicLab } from './screens/MusicLab';
import { Experience } from './screens/Experience';
import { Oxia } from './screens/Oxia';
import { Download } from './screens/Download';
import { Account } from './screens/Account';
import { Landing } from './screens/Landing';
import { Legal, type LegalDoc } from './screens/Legal';
import { accountsEnabled, getAccount, useAccount } from './lib/account';
import { load, save } from './lib/storage';
import { updateSettings } from './lib/settings';
import { entrantProfile, getTournament, isYou, report, roundName, runner } from './lib/tournament';

const VIEW_TRANSITIONS = typeof document !== 'undefined' && 'startViewTransition' in document;

type SettingsTab = 'appearance' | 'sound' | 'controls';
type Screen =
  | { name: 'home' }
  | { name: 'play'; mode: ModeId; back?: 'musiclab' }
  | { name: 'musiclab' }
  | { name: 'experience'; firstRun?: boolean; back?: 'settings' }
  | { name: 'oxia' }
  | { name: 'download' }
  | { name: 'account'; back?: boolean }
  | { name: 'landing' }
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
  const [screen, setScreenNow] = useState<Screen>(() =>
    !load('onboarded', false) ? { name: 'landing' } : accountsEnabled && getAccount().mode === 'unknown' ? { name: 'account' } : { name: 'home' },
  );
  // Pages you step into and out of (downloads, legal, the studio) go back to wherever you came from.
  const previous = useRef<Screen[]>([]);
  const account = useAccount();
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
          onBack={home}
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
      content = <Account onDone={finishOnboarding} onBack={screen.back ? back : undefined} onLegal={(doc) => visit({ name: 'legal', doc })} />;
      break;
    case 'download':
      content = <Download onBack={back} />;
      break;
    case 'oxia':
      content = <Oxia onBack={back} onExperience={() => setScreen({ name: 'experience' })} />;
      break;
    case 'legal':
      content = <Legal doc={screen.doc} onBack={back} />;
      break;
    case 'landing':
      content = (
        <Landing
          onEnter={() => setScreen({ name: 'experience', firstRun: true })}
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
          onSettings={(tab) => setScreen({ name: 'settings', tab })}
        />
      );
  }
  // Opacity-only transition: a transform here would break the game's fixed layout.
  return (
    <>
      <div key={screen.name} className={`min-h-full ${VIEW_TRANSITIONS ? '' : 'animate-fade'}`}>
        {content}
      </div>
      {!['play', 'match', 'bout', 'experience', 'oxia', 'account', 'download', 'landing', 'legal'].includes(screen.name) && <DevBadge key={`dev-${screen.name}`} />}
      {!['play', 'match', 'bout'].includes(screen.name) && <UpdateBanner />}
      <Toasts />
      {screen.name === 'home' && <LogoIntro />}
    </>
  );
}
