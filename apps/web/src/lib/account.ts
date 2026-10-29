import { useSyncExternalStore } from 'react';
import type { Provider } from '@supabase/supabase-js';
import { desktop } from './platform';
import { clearData, restore, setStoragePolicy, snapshot } from './storage';
import { supabase } from './supabase';

/**
 * Who is playing.
 * - `local`: accounts aren't configured; everything is kept on this device, as always.
 * - `unknown`: accounts exist but the player hasn't chosen yet (ask them once).
 * - `guest`: plays freely, but no stats are kept.
 * - `user`: signed in; everything syncs to their account.
 */
export type AccountMode = 'local' | 'unknown' | 'guest' | 'user';

export interface Account {
  mode: AccountMode;
  email: string | null;
}

const KEY = 'tetra.account';
const SYNC = 'tetra.sync';
const DESKTOP_REDIRECT = 'tetra://auth';

function initialMode(): AccountMode {
  if (!supabase) return 'local';
  const saved = localStorage.getItem(KEY);
  // A saved session means a user; the auth client confirms it moments later.
  if (saved === 'user' || saved === 'guest') return saved;
  return 'unknown';
}

let account: Account = { mode: initialMode(), email: null };
const listeners = new Set<() => void>();

function set(next: Partial<Account>): void {
  account = { ...account, ...next };
  if (account.mode === 'guest' || account.mode === 'user') localStorage.setItem(KEY, account.mode);
  else if (account.mode === 'unknown') localStorage.removeItem(KEY);
  applyPolicy();
  listeners.forEach((l) => l());
}

// ── Saving and syncing ─────────────────────────────────────────

let pushTimer = 0;

function applyPolicy(): void {
  if (account.mode === 'guest') setStoragePolicy({ persistStats: false });
  else if (account.mode === 'user') setStoragePolicy({ persistStats: true, onWrite: schedulePush });
  else setStoragePolicy({ persistStats: true });
}
// Before any other module reads its saved state.
applyPolicy();

function schedulePush(): void {
  clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void push(), 2500);
}

interface SyncState {
  user: string;
  at: string;
}

function syncState(): SyncState | null {
  try {
    return JSON.parse(localStorage.getItem(SYNC) ?? 'null') as SyncState | null;
  } catch {
    return null;
  }
}

async function push(): Promise<void> {
  if (!supabase || account.mode !== 'user') return;
  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;
  if (!user) return;
  const data = snapshot();
  const name = (data.profile as { name?: string } | undefined)?.name ?? null;
  const at = new Date().toISOString();
  const { error } = await supabase.from('player_data').upsert({ user_id: user.id, name, data, updated_at: at });
  if (!error) localStorage.setItem(SYNC, JSON.stringify({ user: user.id, at }));
}

/**
 * On sign-in (or opening the app signed in): the newer side wins. A fresh
 * account takes this device's progress; an existing one replaces it.
 */
async function reconcile(userId: string): Promise<void> {
  if (!supabase) return;
  const { data: row, error } = await supabase.from('player_data').select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) return;
  const local = syncState();
  if (!row) {
    // A new account adopts whatever was played here before signing in.
    await push();
    return;
  }
  const remoteNewer = !local || local.user !== userId || new Date(row.updated_at) > new Date(local.at);
  if (remoteNewer) {
    // Reload once with the account's data; every module reads its state at start-up.
    if (sessionStorage.getItem('tetra.restored') === row.updated_at) return;
    sessionStorage.setItem('tetra.restored', row.updated_at);
    restore(row.data as Record<string, unknown>);
    localStorage.setItem(SYNC, JSON.stringify({ user: userId, at: row.updated_at }));
    location.reload();
  } else {
    await push();
  }
}

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      const first = account.mode !== 'user' || event === 'SIGNED_IN';
      set({ mode: 'user', email: session.user.email ?? null });
      if (first || event === 'INITIAL_SESSION') void reconcile(session.user.id);
    } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && account.mode === 'user')) {
      set({ mode: account.mode === 'user' ? 'unknown' : account.mode, email: null });
    }
  });
  // Leaving or hiding the app sends whatever is pending.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && account.mode === 'user') {
      clearTimeout(pushTimer);
      void push();
    }
  });
  // Desktop: Google and Apple finish in the browser and come back here.
  desktop?.onAuthCallback(async (url) => {
    const code = new URL(url).searchParams.get('code');
    if (code) await supabase!.auth.exchangeCodeForSession(code);
  });
}

// ── Actions ────────────────────────────────────────────────────

export function getAccount(): Account {
  return account;
}

export function useAccount(): Account {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => account,
  );
}

export const accountsEnabled = !!supabase;

/** Play without an account: everything works, nothing is kept. */
export function playAsGuest(): void {
  set({ mode: 'guest' });
}

/** Sends a sign-in email with a 6-digit code (and a link that works in this browser). */
export async function sendEmailCode(email: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: desktop ? undefined : location.origin },
  });
  return error?.message ?? null;
}

export async function verifyEmailCode(email: string, code: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  return error?.message ?? null;
}

export async function signInWith(provider: Extract<Provider, 'google' | 'apple'>): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  if (desktop) {
    // The browser does the sign-in; tetra:// brings the code back to the app.
    const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: DESKTOP_REDIRECT, skipBrowserRedirect: true } });
    if (error) return error.message;
    if (data.url) desktop.openExternal(data.url);
    return null;
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin } });
  return error?.message ?? null;
}

/** Signs out and forgets this account's data on the device. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  clearTimeout(pushTimer);
  await push();
  await supabase.auth.signOut();
  clearData();
  localStorage.removeItem(SYNC);
  localStorage.removeItem(KEY);
  location.reload();
}
