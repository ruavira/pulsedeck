// SERVER-ONLY Stripe client + price config. Everything reads from env so the
// app builds and runs with billing disabled (routes return 501) until the
// secret key + price IDs are set.
import 'server-only';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** True only when the secret key AND both price IDs are configured. */
export function billingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_MONTHLY &&
      process.env.STRIPE_PRICE_YEARLY,
  );
}

export function priceIdFor(interval: 'month' | 'year'): string {
  const id = interval === 'year' ? process.env.STRIPE_PRICE_YEARLY : process.env.STRIPE_PRICE_MONTHLY;
  if (!id) throw new Error(`No Stripe price configured for interval ${interval}`);
  return id;
}

export const WEBHOOK_SECRET = () => process.env.STRIPE_WEBHOOK_SECRET ?? '';
