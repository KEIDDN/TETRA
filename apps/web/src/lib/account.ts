import { useSyncExternalStore } from 'react';
import type { Provider } from '@supabase/supabase-js';
import { desktop } from './platform';
import { clearData, restore, setStoragePolicy, snapshot } from './storage';
import { getProfile, setName } from './profile';
import { toast } from '../ui/toast';
import { supabase, supabaseKey, supabaseUrl } from './supabase';

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
    // A new account adopts whatever was played here before signing in, under the name chosen at sign-up.
    const { data: who } = await supabase.auth.getUser();
    const chosen = (who.user?.user_metadata as { name?: string } | undefined)?.name;
    if (chosen && getProfile().name === 'Player') setName(chosen);
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
    if (event === 'PASSWORD_RECOVERY') setRecovering(true);
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

/** Where email links land: the website, so they open on any device (a phone too). */
const WEB = desktop ? 'https://tetra-blocks.vercel.app' : location.origin;

/** The website opened from the desktop app's "Forgot password?": go straight to the reset form. */
export const askedForReset =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('reset') && !new URLSearchParams(location.search).has('code');

// Coming back from an email link: say what happened, and tidy the address bar.
if (supabase && typeof location !== 'undefined') {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.slice(1));
  const problem = hash.get('error_description') ?? query.get('error_description');
  if (problem) setTimeout(() => toast(problem.replace(/\+/g, ' ')), 1200);
  else if (query.has('confirmed')) {
    void supabase.auth.getSession().then(({ data }) =>
      setTimeout(() => toast(data.session ? 'Email confirmed. Welcome to TETRA.' : 'Email confirmed. Sign in on any device to start playing.'), 1200),
    );
  }
  if (problem || query.has('confirmed') || query.has('reset')) history.replaceState(null, '', location.pathname);
}

// ── Password recovery ──────────────────────────────────────────

let recovering = false;
const recoveryListeners = new Set<() => void>();
function setRecovering(on: boolean): void {
  recovering = on;
  recoveryListeners.forEach((l) => l());
}
/** True after following a reset-password link: time to choose a new one. */
export function useRecovering(): boolean {
  return useSyncExternalStore(
    (l) => {
      recoveryListeners.add(l);
      return () => recoveryListeners.delete(l);
    },
    () => recovering,
  );
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

const friendly = (message: string): string =>
  /email not confirmed/i.test(message)
    ? 'Confirm your email first: open the link we sent you, on any device.'
    : /invalid login credentials/i.test(message)
      ? 'That email and password don’t match.'
      : /rate limit/i.test(message)
        ? 'Too many emails for now. Try again in a few minutes.'
        : message;

export type SignUpResult = { error: string } | { confirm: true } | { signedIn: true } | { exists: true };

/** Creates an account. The confirmation link can be opened on any device; then sign in here. */
export async function signUp(email: string, password: string, name: string): Promise<SignUpResult> {
  if (!supabase) return { error: 'Accounts are not available yet.' };
  const clean = name.trim().slice(0, 24);
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name: clean }, emailRedirectTo: `${WEB}/?confirmed=1` },
  });
  if (error) return { error: friendly(error.message) };
  // Supabase answers a known email with an empty identity list instead of an error.
  if (data.user && data.user.identities?.length === 0) return { exists: true };
  if (clean) setName(clean);
  return data.session ? { signedIn: true } : { confirm: true };
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? friendly(error.message) : null;
}

export async function resendConfirmation(email: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${WEB}/?confirmed=1` } });
  return error ? friendly(error.message) : null;
}

/**
 * Sends a reset link. The link has to be opened in the same browser that asked
 * for it, so the desktop app sends players to the website to do it there.
 */
export async function forgotPassword(email: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  if (desktop) {
    desktop.openExternal(`${WEB}/?reset=1`);
    return null;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${WEB}/?reset=1` });
  return error ? friendly(error.message) : null;
}

export async function setNewPassword(password: string): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return friendly(error.message);
  setRecovering(false);
  return null;
}

/** Which of Google and Apple are switched on in the project, so the others aren't offered. */
export async function signInProviders(): Promise<{ google: boolean; apple: boolean }> {
  const none = { google: false, apple: false };
  if (!supabase || !supabaseUrl || !supabaseKey) return none;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } });
    const { external } = (await res.json()) as { external?: Record<string, boolean> };
    return { google: !!external?.google, apple: !!external?.apple };
  } catch {
    return none;
  }
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

/** Everything the account keeps, as a JSON file the player can save. */
export function downloadMyData(): void {
  const file = { exported: new Date().toISOString(), email: account.email, data: snapshot() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tetra-my-data.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deletes the account and all its data for good, then starts fresh on this device. */
export async function deleteAccount(): Promise<string | null> {
  if (!supabase) return 'Accounts are not available yet.';
  clearTimeout(pushTimer);
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return error.message;
  await supabase.auth.signOut({ scope: 'local' });
  clearData();
  localStorage.removeItem(SYNC);
  localStorage.removeItem(KEY);
  location.reload();
  return null;
}
