'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

export function OpsTelemetry() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    void trackEvent('page_view', pathname);
  }, [pathname]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void captureClientError({
        message: event.message || 'Browser error',
        stack: event.error instanceof Error ? event.error.stack : undefined,
        route: window.location.pathname,
        source: 'browser',
        severity: 'error',
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      void captureClientError({
        message: reason instanceof Error ? reason.message : String(reason || 'Unhandled promise rejection'),
        stack: reason instanceof Error ? reason.stack : undefined,
        route: window.location.pathname,
        source: 'browser',
        severity: 'error',
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}

async function trackEvent(eventName: string, route: string) {
  try {
    const supabase = createSupabaseBrowser();
    await supabase.from('app_events').insert({
      event_name: eventName,
      feature_key: featureKeyForPath(route),
      route,
      event_source: 'web',
      properties: {
        title: document.title,
      },
    });
  } catch {
    // Telemetry should never disrupt a live presentation or editor workflow.
  }
}

async function captureClientError(input: {
  message: string;
  stack?: string;
  route: string;
  source: 'browser';
  severity: 'error';
}) {
  try {
    const supabase = createSupabaseBrowser();
    await supabase.from('client_errors').insert({
      message: input.message.slice(0, 1000),
      stack: input.stack?.slice(0, 6000) ?? null,
      route: input.route,
      source: input.source,
      severity: input.severity,
      browser: navigator.userAgent,
      metadata: {
        feature_key: featureKeyForPath(input.route),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });
  } catch {
    // Error capture is best-effort; avoid recursive logging loops.
  }
}

function featureKeyForPath(pathname: string) {
  if (pathname.startsWith('/admin')) return 'ops-dashboard';
  if (pathname.startsWith('/studio/')) return 'deck-builder';
  if (pathname.startsWith('/studio')) return 'studio-home';
  if (pathname.startsWith('/present') || pathname.startsWith('/remote')) return 'live-session';
  if (pathname.startsWith('/j')) return 'audience-join';
  if (pathname.startsWith('/account') || pathname.startsWith('/pricing')) return 'billing';
  if (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/auth')) return 'auth-login';
  return 'support-policy';
}
