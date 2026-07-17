'use client';
// Auth-aware browser client (persisted session, cookie-synced with the server
// via @supabase/ssr). Used by the login/signup/account/studio surfaces so
// auth.uid() resolves in RLS. Kept SEPARATE from getSupabase() in client.ts,
// which stays anonymous for audience realtime + storage uploads.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config';

let _client: SupabaseClient | null = null;

export function createSupabaseBrowser(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _client;
}
