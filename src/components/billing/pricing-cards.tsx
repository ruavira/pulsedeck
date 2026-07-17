'use client';
// Free vs Pro comparison with a monthly/annual toggle. CTA adapts to auth state:
// logged-out -> signup; logged-in free -> Stripe Checkout; logged-in pro -> account.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/shared/ui';

// Display prices — keep in sync with the Stripe Price objects (USD).
const MONTHLY = 19;
const ANNUAL = 180; // ≈ 2½ months free vs monthly

const CHECK = (
  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 text-emerald">
    <path fill="currentColor" d="M8.2 13.4 4.8 10l-1.2 1.2 4.6 4.6 9-9L16 5.6z" />
  </svg>
);
const DASH = (
  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 text-fg-dim/50">
    <path fill="currentColor" d="M5 9.2h10v1.6H5z" />
  </svg>
);

function Row({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-fg">
      {on ? CHECK : DASH}
      <span className={on ? '' : 'text-fg-dim'}>{children}</span>
    </li>
  );
}

export function PricingCards({ signedIn, plan }: { signedIn: boolean; plan: 'free' | 'pro' }) {
  const router = useRouter();
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goPro = async () => {
    if (!signedIn) {
      router.push('/signup?next=/pricing');
      return;
    }
    if (plan === 'pro') {
      router.push('/account');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(
        data.error === 'billing_unconfigured'
          ? 'Billing is being switched on — check back shortly.'
          : 'Could not start checkout. Please try again.',
      );
    } catch {
      setError('Could not reach the billing service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const price = interval === 'year' ? ANNUAL : MONTHLY;
  const per = interval === 'year' ? '/year' : '/month';

  return (
    <div className="w-full max-w-4xl">
      {/* Billing interval toggle */}
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-edge bg-panel p-1 shadow-soft">
          {(['month', 'year'] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                interval === i ? 'bg-accent text-white shadow-accent-glow' : 'text-fg-dim hover:text-fg'
              }`}
            >
              {i === 'month' ? 'Monthly' : 'Annual'}
              {i === 'year' && (
                <span className={`ml-1.5 text-xs ${interval === 'year' ? 'text-white/80' : 'text-emerald'}`}>
                  save 21%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border border-edge bg-panel p-6 shadow-soft">
          <h3 className="text-lg font-bold text-fg">Free</h3>
          <p className="mt-1 text-sm text-fg-dim">Everything to run your first interactive rooms.</p>
          <p className="mt-4 text-4xl font-bold text-fg">
            $0<span className="text-base font-medium text-fg-dim">/forever</span>
          </p>
          <ul className="mt-6 flex flex-1 flex-col gap-3">
            <Row on>Up to 3 saved decks</Row>
            <Row on>Up to 50 participants per room</Row>
            <Row on>All slide & activity types</Row>
            <Row on>QR join · live results · leaderboard</Row>
            <Row on={false}>AI deck & quiz generation</Row>
            <Row on={false}>Result exports (Excel / CSV)</Row>
          </ul>
          <Button
            variant="secondary"
            size="lg"
            className="mt-6 w-full"
            onClick={() => router.push(signedIn ? '/studio' : '/signup')}
          >
            {signedIn ? 'Go to your studio' : 'Start free'}
          </Button>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-2xl border-2 border-accent bg-panel p-6 shadow-accent-glow">
          <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
            Most popular
          </span>
          <h3 className="text-lg font-bold text-fg">Pro</h3>
          <p className="mt-1 text-sm text-fg-dim">For professionals running real events.</p>
          <p className="mt-4 text-4xl font-bold text-fg">
            ${price}
            <span className="text-base font-medium text-fg-dim">{per}</span>
          </p>
          <ul className="mt-6 flex flex-1 flex-col gap-3">
            <Row on>Unlimited decks</Row>
            <Row on>Up to 1,000 participants per room</Row>
            <Row on>AI deck & quiz generation</Row>
            <Row on>Direct video upload</Row>
            <Row on>Result exports (Excel / CSV / PDF)</Row>
            <Row on>Priority support</Row>
          </ul>
          <Button size="lg" className="mt-6 w-full" disabled={busy} onClick={goPro}>
            {plan === 'pro' ? 'Manage your plan' : busy ? 'Starting checkout…' : 'Go Pro'}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-center text-sm text-red">
              {error}
            </p>
          )}
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-fg-dim">
        Cancel anytime. Secure payment by Stripe — your card details never touch PulseDeck.
      </p>
    </div>
  );
}
