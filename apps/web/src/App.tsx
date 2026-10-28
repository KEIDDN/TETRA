import type { ModeId } from '@tetra/engine';
import { useEffect, useState } from 'react';
import { sfx } from './audio/sfx';
import { gamepads } from './game/gamepad';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { Settings } from './screens/Settings';

type SettingsTab = 'appearance' | 'sound' | 'controls';
type Screen = { name: 'home' } | { name: 'play'; mode: ModeId } | { name: 'settings'; tab?: SettingsTab };

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
    default:
      content = <Home onPlay={(mode) => setScreen({ name: 'play', mode })} onSettings={(tab) => setScreen({ name: 'settings', tab })} />;
  }
  // Opacity-only transition: a transform here would break the game's fixed layout.
  return (
    <div key={screen.name} className="animate-fade min-h-full">
      {content}
    </div>
  );
}
