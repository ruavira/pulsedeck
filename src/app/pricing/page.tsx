import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser, getUserPlan } from '@/lib/auth';
import { PricingCards } from '@/components/billing/pricing-cards';
import { Wordmark } from '@/components/landing/decor';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start free, upgrade to Pro for bigger rooms, AI decks and exports.',
};

export default async function PricingPage() {
  const user = await getSessionUser();
  const plan = user ? await getUserPlan(user.id) : 'free';

  return (
    <main className="relative flex min-h-dvh flex-col bg-ink">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="PulseDeck home">
          <Wordmark />
        </Link>
        <Link
          href={user ? '/studio' : '/login'}
          className="text-sm font-semibold text-fg-dim transition hover:text-fg"
        >
          {user ? 'Studio' : 'Sign in'}
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-5 pb-20 pt-8 sm:px-8">
        <h1 className="text-balance text-center text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          Simple pricing that scales with your room
        </h1>
        <p className="mt-3 max-w-xl text-balance text-center text-fg-dim">
          Build and present for free. Upgrade to Pro when you need bigger audiences, AI-generated
          decks, and exports.
        </p>
        <div className="mt-10 flex w-full justify-center">
          <PricingCards signedIn={!!user} plan={plan} />
        </div>
      </section>
    </main>
  );
}
