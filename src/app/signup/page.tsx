import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';
import { Glow, Wordmark } from '@/components/landing/decor';
import { Button } from '@/components/shared/ui';

export const metadata: Metadata = { title: 'Create your account' };

// Self-service sign-up is closed by default (invite-only). To open a public
// trial window, set NEXT_PUBLIC_SIGNUPS_OPEN=true in the Netlify environment and
// re-enable "Allow new users to sign up" in Supabase Auth — both must be on for
// self-registration to actually work.
const SIGNUPS_OPEN = process.env.NEXT_PUBLIC_SIGNUPS_OPEN === 'true';

export default async function SignupPage() {
  if (await getSessionUser()) redirect('/studio');
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-ink px-5 py-12">
      <Glow className="left-1/2 top-[-160px] h-[440px] w-[640px] -translate-x-1/2" />
      <Glow color="cyan" className="right-[-140px] bottom-[10%] h-[320px] w-[320px]" />
      {SIGNUPS_OPEN ? (
        <Suspense fallback={null}>
          <AuthForm mode="signup" />
        </Suspense>
      ) : (
        <section className="relative w-full max-w-sm text-center">
          <div className="mb-8 flex flex-col items-center gap-3">
            <Link href="/" aria-label="PulseDeck home">
              <Wordmark />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-fg">Access is by invitation</h1>
            <p className="text-sm text-fg-dim">
              PulseDeck is currently open to invited members of the Ruavira Collective only.
              If you already have an account, sign in below. To request access, reach out to
              your host.
            </p>
          </div>
          <Link href="/login" className="block">
            <Button size="lg" className="w-full">
              Sign in
            </Button>
          </Link>
          <p className="mt-6 text-xs text-fg-dim">
            Joining a live session as a participant? You don&rsquo;t need an account — just open
            the join link or code your presenter shared.
          </p>
        </section>
      )}
    </main>
  );
}
