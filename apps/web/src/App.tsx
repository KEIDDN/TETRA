import type { ModeId } from '@tetra/engine';
import { useEffect, useState } from 'react';
import { sfx } from './audio/sfx';
import { gamepads } from './game/gamepad';
import { Toasts } from './ui/toast';
import { DevBadge } from './ui/DevBadge';
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
import { entrantProfile, getTournament, isYou, report, roundName, runner } from './lib/tournament';

type SettingsTab = 'appearance' | 'sound' | 'controls';
type Screen =
  | { name: 'home' }
  | { name: 'play'; mode: ModeId }
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
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });

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
      content = <Play key={screen.mode} mode={screen.mode} onExit={home} />;
      break;
    case 'settings':
      content = <Settings initialTab={screen.tab} onBack={home} />;
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
    case 'profile':
      content = <Profile onBack={home} section={screen.section} />;
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
          onSettings={(tab) => setScreen({ name: 'settings', tab })}
        />
      );
  }
  // Opacity-only transition: a transform here would break the game's fixed layout.
  return (
    <>
      <div key={screen.name} className="animate-fade min-h-full">
        {content}
      </div>
      {!['play', 'match', 'bout'].includes(screen.name) && <DevBadge />}
      <Toasts />
    </>
  );
}
