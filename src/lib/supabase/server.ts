// Auth-aware Supabase client for Server Components and Route Handlers.
// Reads the presenter's session from cookies via @supabase/ssr. Distinct from
// getAdmin() (server-secret, full privilege) and getSupabase() (anonymous
// audience/realtime client). Use this only where we need "who is signed in".
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config';

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component render — cookies are read-only there.
          // proxy.ts refreshes the session cookie on navigation, so this is safe to ignore.
        }
      },
    },
  });
}
