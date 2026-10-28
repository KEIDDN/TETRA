import { useState } from 'react';
import { Home } from './screens/Home';
import { Play } from './screens/Play';

type Screen = { name: 'home' } | { name: 'play' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  if (screen.name === 'play') return <Play onExit={() => setScreen({ name: 'home' })} />;
  return <Home onPlay={() => setScreen({ name: 'play' })} />;
}
