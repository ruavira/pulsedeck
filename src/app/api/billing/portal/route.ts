// POST /api/billing/portal -> { url }
// Opens the Stripe customer portal so a subscriber can update card, view
// invoices, or cancel — all on Stripe's hosted pages.
import { getSessionUser, getProfile } from '@/lib/auth';
import { getStripe, billingConfigured } from '@/lib/stripe/server';
import { APP_ORIGIN } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST() {
  if (!billingConfigured()) {
    return Response.json({ error: 'billing_unconfigured' }, { status: 501 });
  }
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const profile = await getProfile(user.id);
  if (!profile?.stripe_customer_id) {
    return Response.json({ error: 'no_customer' }, { status: 400 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${APP_ORIGIN}/account`,
  });
  return Response.json({ url: session.url });
}
