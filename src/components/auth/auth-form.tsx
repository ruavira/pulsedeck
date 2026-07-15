'use client';
// Shared sign-in / sign-up form. Email+password, Google OAuth, and a
// passwordless magic-link fallback. Cookie-synced via the SSR browser client,
// so a successful sign-in is immediately visible to server components.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { Button, Input } from '@/components/shared/ui';
import { Wordmark } from '@/components/landing/decor';

type Mode = 'login' | 'signup';

// Mirrors the server-side gate in app/signup/page.tsx: self-service sign-up is
// closed by default (invite-only) unless NEXT_PUBLIC_SIGNUPS_OPEN=true.
const SIGNUPS_OPEN = process.env.NEXT_PUBLIC_SIGNUPS_OPEN === 'true';

const INVITE_ONLY_MSG =
  'That email isn’t on the access list yet. PulseDeck is invitation-only right now — ask your host to add you.';

/** Turn raw Supabase auth errors into calm, human copy. */
function friendlyAuthError(raw: string | null | undefined): string {
  const m = (raw ?? '').toLowerCase();
  if (/signup.?disabled|signups? not allowed|not allowed for otp|access_denied/.test(m)) {
    return INVITE_ONLY_MSG;
  }
  if (/invalid login credentials/.test(m)) {
    return 'That email and password didn’t match. Try again, or use the magic link.';
  }
  if (/email not confirmed/.test(m)) {
    return 'Please confirm your email first — check your inbox for the link.';
  }
  if (!raw) return 'Something went wrong — please try again.';
  return raw;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');
  const next = nextParam && nextParam.startsWith('/') ? nextParam : '/studio';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'google' | 'magic'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Surface OAuth / magic-link callback failures cleanly. Supabase returns them
  // either as ?error=link (our callback) or as a URL hash
  // (#error=access_denied&error_code=signup_disabled). Read both, show human
  // copy, then scrub the URL so a refresh doesn't re-show a stale error.
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hashCode = /error_code=([^&]+)/.exec(hash)?.[1] ?? '';
    const queryErr = params.get('error');
    if (hashCode || queryErr) {
      if (/signup_disabled|access_denied/i.test(hashCode)) {
        setError(INVITE_ONLY_MSG);
      } else if (hashCode || queryErr === 'link') {
        setError('That sign-in link didn’t work — please try again.');
      }
      if (typeof window !== 'undefined' && hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const supabase = createSupabaseBrowser();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      : undefined;

  const signInWithGoogle = async () => {
    setError(null);
    setBusy('google');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      setError(
        /provider is not enabled/i.test(error.message)
          ? 'Google sign-in isn’t switched on yet — use email for now.'
          : friendlyAuthError(error.message),
      );
      setBusy(null);
    }
    // On success the browser navigates away to Google.
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy('email');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setNotice('Check your inbox to confirm your email, then sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : null));
    } finally {
      setBusy((b) => (b === 'email' ? null : b));
    }
  };

  const sendMagicLink = async () => {
    if (!email) {
      setError('Enter your email first, then tap the magic-link option.');
      return;
    }
    setError(null);
    setNotice(null);
    setBusy('magic');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: mode === 'signup' },
    });
    if (error) setError(friendlyAuthError(error.message));
    else setNotice(`We emailed a one-click sign-in link to ${email}.`);
    setBusy(null);
  };

  const busyAny = busy !== null;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Link href="/" aria-label="PulseDeck home">
          <Wordmark />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-fg">
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-fg-dim">
          {mode === 'signup'
            ? 'Free to start — build interactive decks in minutes.'
            : 'Sign in to your PulseDeck studio.'}
        </p>
      </div>

      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busyAny}
        className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-full border border-edge bg-panel font-semibold text-fg shadow-soft transition hover:border-accent/50 disabled:opacity-50"
      >
        <GoogleIcon />
        {busy === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-edge" />
        <span className="text-xs font-semibold uppercase tracking-widest text-fg-dim">or</span>
        <div className="h-px flex-1 bg-edge" />
      </div>

      <form onSubmit={submitEmail} className="flex flex-col gap-3">
        <Input
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={8}
          placeholder={mode === 'signup' ? 'Create a password (8+ chars)' : 'Your password'}
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" size="lg" className="w-full" disabled={busyAny}>
          {busy === 'email'
            ? 'Working…'
            : mode === 'signup'
              ? 'Create account'
              : 'Sign in'}
        </Button>
      </form>

      <button
        type="button"
        onClick={sendMagicLink}
        disabled={busyAny}
        className="mt-3 w-full text-center text-sm font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
      >
        {busy === 'magic' ? 'Sending…' : 'Email me a magic link instead'}
      </button>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red/40 bg-red/10 px-4 py-2.5 text-sm text-red">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 rounded-xl border border-emerald/40 bg-emerald/10 px-4 py-2.5 text-sm text-fg">
          {notice}
        </p>
      )}

      <p className="mt-8 text-center text-sm text-fg-dim">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : SIGNUPS_OPEN ? (
          <>
            New to PulseDeck?{' '}
            <Link href="/signup" className="font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>Access is invitation-only — contact your host to be added.</>
        )}
      </p>
    </div>
  );
}
