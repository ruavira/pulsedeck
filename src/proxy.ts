// Next.js 16 "proxy" (formerly middleware; nodejs runtime). Refreshes the
// Supabase auth session cookie on presenter-surface navigations so server
// components and route handlers see a fresh session. Scoped by the matcher to
// the presenter/billing surfaces only — audience routes (/j, /present, /remote,
// /report, /addin) stay cookie-free and fast.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() rotates an expiring token and writes the refreshed cookie.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/studio/:path*',
    '/account/:path*',
    '/login',
    '/signup',
    '/pricing',
    '/api/decks/:path*',
    '/api/account/:path*',
    '/api/billing/:path*',
  ],
};
