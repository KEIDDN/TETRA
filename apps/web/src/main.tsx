import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Decides how progress is kept before anything reads its saved state.
import 'pixi.js/unsafe-eval'; // Pixi without eval(), so the site can forbid it.
import './lib/account';
import { App } from './App';
import { registerServiceWorker } from './lib/platform';

registerServiceWorker();

// No text selection, and so no iPhone magnifier, outside fields and the legal pages.
const selectable = (t: EventTarget | null) => {
  const el = t instanceof Element ? t : t instanceof Node ? t.parentElement : null;
  return !!el?.closest('input, textarea, [contenteditable], .selectable');
};
document.addEventListener('selectstart', (e) => {
  if (!selectable(e.target)) e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  if (!selectable(e.target) && matchMedia('(pointer: coarse)').matches) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
