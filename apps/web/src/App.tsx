import type { ModeId } from '@tetra/engine';
import { useState } from 'react';
import { Home } from './screens/Home';
import { Play } from './screens/Play';
import { Settings } from './screens/Settings';

type Screen = { name: 'home' } | { name: 'play'; mode: ModeId } | { name: 'settings' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const home = () => setScreen({ name: 'home' });

  switch (screen.name) {
    case 'play':
      return <Play key={screen.mode} mode={screen.mode} onExit={home} />;
    case 'settings':
      return <Settings onBack={home} />;
    default:
      return <Home onPlay={(mode) => setScreen({ name: 'play', mode })} onSettings={() => setScreen({ name: 'settings' })} />;
  }
}
