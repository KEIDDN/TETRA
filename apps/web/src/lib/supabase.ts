import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Accepts the full project URL, or just the project id (`abcd1234`). */
function projectUrl(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, '');
  if (!value) return null;
  if (/^[a-z0-9]{20}$/.test(value)) return `https://${value}.supabase.co`;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.protocol === 'https:' || url.hostname === 'localhost' ? url.origin : null;
  } catch {
    return null;
  }
}

export const supabaseUrl = projectUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
export const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || null;

function connect(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    return createClient(supabaseUrl, supabaseKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (error) {
    // A bad setting must never stop the game from starting.
    console.warn('Accounts are off: Supabase is misconfigured.', error);
    return null;
  }
}

/**
 * The Supabase client, or null when the project isn't configured: then
 * TETRA runs as before, everything saved on this device and no accounts.
 */
export const supabase: SupabaseClient | null = connect();
