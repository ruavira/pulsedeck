// POST /api/billing/webhook — Stripe -> PulseDeck sync.
// Verifies the signature against the raw body, then flips profiles.plan
// between 'free' and 'pro' and mirrors the subscription row. This is the ONLY
// thing that grants Pro — never trust the client.
import type Stripe from 'stripe';
import { getStripe, WEBHOOK_SECRET } from '@/lib/stripe/server';
import { getAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const ACTIVE = new Set(['active', 'trialing', 'past_due']); // keep Pro through a grace period

async function resolveUserId(
  stripe: Stripe,
  customerId: string | null,
  metaUserId?: string | null,
): Promise<string | null> {
  if (metaUserId) return metaUserId;
  if (!customerId) return null;
  // Fall back to our stored mapping.
  const { data } = await getAdmin()
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (data?.id) return data.id as string;
  // Last resort: the customer's own metadata.
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.metadata?.userId) return customer.metadata.userId;
  } catch {
    /* ignore */
  }
  return null;
}

async function syncSubscription(stripe: Stripe, sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = await resolveUserId(stripe, customerId, sub.metadata?.userId);
  if (!userId) {
    console.error('webhook: could not resolve user for subscription', sub.id);
    return;
  }
  const item = sub.items.data[0];
  const isActive = ACTIVE.has(sub.status);
  const admin = getAdmin();

  await admin.from('subscriptions').upsert({
    id: sub.id,
    user_id: userId,
    status: sub.status,
    price_id: item?.price.id ?? null,
    plan_interval: item?.price.recurring?.interval ?? null,
    current_period_end: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
  });

  await admin
    .from('profiles')
    .update({ plan: isActive ? 'pro' : 'free', stripe_customer_id: customerId })
    .eq('id', userId);
}

export async function POST(req: Request) {
  const secret = WEBHOOK_SECRET();
  if (!secret) return Response.json({ error: 'webhook_unconfigured' }, { status: 501 });

  const sig = req.headers.get('stripe-signature');
  if (!sig) return Response.json({ error: 'no_signature' }, { status: 400 });

  const raw = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
  } catch (err) {
    return Response.json(
      { error: `signature_verification_failed: ${err instanceof Error ? err.message : ''}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          if (session.client_reference_id && !sub.metadata?.userId) {
            sub.metadata = { ...sub.metadata, userId: session.client_reference_id };
          }
          await syncSubscription(stripe, sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(stripe, event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('webhook handler error', err);
    return Response.json({ error: 'handler_error' }, { status: 500 });
  }

  return Response.json({ received: true });
}
