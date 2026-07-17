'use client';
// Browser Supabase client (anon/publishable key only — safe to expose).
// All writes go through SECURITY DEFINER RPCs; tables are RLS-locked.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      // 40/s: the stage carries results-rebroadcasts + self-echo AND must not
      // drop inbound reactions/signals during busy voting moments. The old cap of
      // 5/s was below Supabase's default (10) and silently dropped signal events
      // whenever results traffic spiked the connection past 5 msg/s.
      realtime: { params: { eventsPerSecond: 40 } },
    });
  }
  return _client;
}

/** Call a Postgres RPC with typed result. Throws on transport error; returns data. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}
