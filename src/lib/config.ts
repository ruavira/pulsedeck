// Public runtime configuration.
// The Supabase URL + publishable (anon) key are public by design (tables are RLS-locked;
// all access flows through hardened RPCs). Baked values are fallbacks so the deployed
// file tree works without dashboard env setup; env vars override when present.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://jykgeyomiqtrvbfstmmh.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_XjQjRGNlN_fOBFM-3dSoKw_EA5o6BM1';

export const APP_NAME = 'PulseDeck';
export const APP_TAGLINE = 'Presentations with a pulse.';

/** Absolute origin for join links/QR codes (set after first deploy). */
export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://pulsedeck-live.netlify.app';
