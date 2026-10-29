/** Where TETRA is running, and how it can be installed. */

/** Bridge exposed by the desktop app's preload script. */
export interface DesktopBridge {
  platform: string;
  openExternal(url: string): void;
  onAuthCallback(listener: (url: string) => void): () => void;
  onUpdate?(listener: (update: DesktopUpdate) => void): () => void;
  installUpdate?(): void;
}

/** A newer TETRA: ready to restart into (Windows), or to download (macOS). */
export type DesktopUpdate = { state: 'ready'; version: string } | { state: 'download'; version: string; url: string };

declare global {
  interface Window {
    tetraDesktop?: DesktopBridge;
  }
}

export type Os = 'mac' | 'windows' | 'ios' | 'android' | 'linux' | 'other';

export const desktop: DesktopBridge | null = typeof window !== 'undefined' ? (window.tetraDesktop ?? null) : null;

/** Running as an installed app: the desktop build or a home-screen PWA. */
export function installed(): boolean {
  if (desktop) return true;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return !!standalone || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
}

export function detectOs(): Os {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(ua)) return 'mac';
  if (/Win/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return 'linux';
  return 'other';
}

/** Desktop downloads: the latest GitHub release of the desktop app. */
export const DOWNLOADS = {
  mac: 'https://github.com/keiddn/tetra/releases/latest/download/TETRA-mac.dmg',
  windows: 'https://github.com/keiddn/tetra/releases/latest/download/TETRA-windows.exe',
};

// The browser's own install prompt (Chrome, Edge, Android), kept until the player asks for it.
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function onInstallAvailable(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === 'accepted';
}

/** Offline support and installability, on the web only. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || desktop || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
