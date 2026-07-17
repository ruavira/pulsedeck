// POST /api/billing/checkout { interval: 'month' | 'year' } -> { url }
// Starts a Stripe Checkout session (subscription mode). The card is entered on
// Stripe's hosted page; we never see it. Requires a signed-in presenter.
import { getSessionUser, getProfile } from '@/lib/auth';
import { getAdmin } from '@/lib/supabase/admin';
import { getStripe, billingConfigured, priceIdFor } from '@/lib/stripe/server';
import { APP_ORIGIN } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!billingConfigured()) {
    return Response.json({ error: 'billing_unconfigured' }, { status: 501 });
  }
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { interval?: 'month' | 'year' };
  const interval = body.interval === 'year' ? 'year' : 'month';

  const stripe = getStripe();
  const profile = await getProfile(user.id);

  // Reuse or create the Stripe customer, and remember it on the profile.
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await getAdmin().from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceIdFor(interval), quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { userId: user.id } },
    success_url: `${APP_ORIGIN}/account?upgraded=1`,
    cancel_url: `${APP_ORIGIN}/pricing?canceled=1`,
  });

  return Response.json({ url: session.url });
}
