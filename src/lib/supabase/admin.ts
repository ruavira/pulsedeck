// SERVER-ONLY privileged Supabase client. Never import from client components.
//
// Privilege model: the anon key + an `x-server-secret` header. RLS policies
// (migration 004_server_gate) grant full access only when public.is_server()
// verifies the header against a secret held in a private schema. This is
// equivalent in power to a service-role key but fully self-contained.
import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config';

function serverSecret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // holds the server gate secret
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return key;
}

let _admin: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-server-secret': serverSecret() } },
    });
  }
  return _admin;
}

/**
 * Broadcast a realtime event on the session channel from the server.
 * Uses Realtime's HTTP broadcast endpoint — no websocket handshake per serverless
 * invocation (verified delivering to public-channel subscribers on this project).
 */
export async function broadcast(sessionId: string, event: string, payload: unknown) {
  const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ topic: `session:${sessionId}`, event, payload }],
    }),
  });
  if (!res.ok) {
    // Non-fatal: clients heal via resync polls, but log for observability.
    console.error(`broadcast failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
}
