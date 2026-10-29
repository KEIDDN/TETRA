import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Decides how progress is kept before anything reads its saved state.
import './lib/account';
import { App } from './App';
import { registerServiceWorker } from './lib/platform';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
