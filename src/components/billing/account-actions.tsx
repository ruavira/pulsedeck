'use client';
// Client actions for the account page: manage billing (Stripe portal),
// upgrade, and sign out.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import { Button } from '@/components/shared/ui';

export function AccountActions({ plan }: { plan: 'free' | 'pro' }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'portal' | 'signout'>(null);
  const [error, setError] = useState<string | null>(null);

  const manageBilling = async () => {
    setBusy('portal');
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError('Could not open the billing portal. Please try again.');
    } catch {
      setError('Could not reach the billing service.');
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy('signout');
    await createSupabaseBrowser().auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {plan === 'pro' ? (
        <Button size="lg" disabled={busy !== null} onClick={manageBilling}>
          {busy === 'portal' ? 'Opening…' : 'Manage billing'}
        </Button>
      ) : (
        <Button size="lg" onClick={() => router.push('/pricing')}>
          Upgrade to Pro
        </Button>
      )}
      <Button variant="ghost" disabled={busy !== null} onClick={signOut}>
        {busy === 'signout' ? 'Signing out…' : 'Sign out'}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
