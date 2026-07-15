import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser, getProfile } from '@/lib/auth';
import { getAdmin } from '@/lib/supabase/admin';
import { PLAN_LABELS, limitsFor } from '@/lib/plans';
import { AccountActions } from '@/components/billing/account-actions';
import { Card, Pill } from '@/components/shared/ui';
import { Wordmark } from '@/components/landing/decor';

export const metadata: Metadata = { title: 'Your account' };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/account');

  const profile = await getProfile(user.id);
  const plan = profile?.plan ?? 'free';
  const limits = limitsFor(plan);

  const { data: sub } = await getAdmin()
    .from('subscriptions')
    .select('status, plan_interval, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  const renews =
    sub?.current_period_end && new Date(sub.current_period_end as string).toLocaleDateString();

  return (
    <main className="relative flex min-h-dvh flex-col bg-ink">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="PulseDeck home">
          <Wordmark />
        </Link>
        <Link href="/studio" className="text-sm font-semibold text-fg-dim transition hover:text-fg">
          Studio
        </Link>
      </header>

      <section className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16 pt-6 sm:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-fg">Your account</h1>
        <p className="mt-1 text-sm text-fg-dim">{profile?.email ?? user.email}</p>

        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-fg">{PLAN_LABELS[plan]} plan</span>
              <Pill tone={plan === 'pro' ? 'accent' : 'dim'}>
                {plan === 'pro' ? 'Active' : 'Free tier'}
              </Pill>
            </div>
          </div>

          {plan === 'pro' && sub && (
            <p className="mt-2 text-sm text-fg-dim">
              {sub.cancel_at_period_end
                ? `Cancels on ${renews}. You keep Pro until then.`
                : renews
                  ? `Renews ${renews} · billed ${sub.plan_interval === 'year' ? 'annually' : 'monthly'}.`
                  : `Billed ${sub.plan_interval === 'year' ? 'annually' : 'monthly'}.`}
            </p>
          )}

          <ul className="mt-5 grid gap-2 text-sm text-fg-dim sm:grid-cols-2">
            <li>
              Decks:{' '}
              <span className="font-semibold text-fg">
                {limits.maxDecks === Infinity ? 'Unlimited' : `Up to ${limits.maxDecks}`}
              </span>
            </li>
            <li>
              Participants:{' '}
              <span className="font-semibold text-fg">Up to {limits.maxParticipants.toLocaleString()}</span>
            </li>
            <li>
              AI generation: <span className="font-semibold text-fg">{limits.ai ? 'Included' : '—'}</span>
            </li>
            <li>
              Exports: <span className="font-semibold text-fg">{limits.exports ? 'Included' : '—'}</span>
            </li>
          </ul>

          <div className="mt-6">
            <AccountActions plan={plan} />
          </div>
        </Card>

        {plan === 'free' && (
          <p className="mt-4 text-center text-sm text-fg-dim">
            Need bigger rooms, AI decks or exports?{' '}
            <Link href="/pricing" className="font-semibold text-accent hover:underline">
              See Pro
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
