import { randomBytes } from 'node:crypto';
import { getAdmin } from '@/lib/supabase/admin';
import { hashGammaSecret, sanitizeControllerLabel } from '@/lib/server/gamma-sync-auth';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';

const PAIR_ALPHABET = '23456789ACDEFGHJKMNPQRSTUVWXYZ';

function makePairingCode(): string {
  // Rejection sampling avoids modulo bias while keeping the code easy to type.
  const accepted: string[] = [];
  const unbiasedLimit = Math.floor(256 / PAIR_ALPHABET.length) * PAIR_ALPHABET.length;
  while (accepted.length < 9) {
    for (const byte of randomBytes(16)) {
      if (byte < unbiasedLimit) accepted.push(PAIR_ALPHABET[byte % PAIR_ALPHABET.length]);
      if (accepted.length === 9) break;
    }
  }
  const raw = accepted.join('');
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
}

export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const deckId = await verifySessionKey(sessionId, req.headers.get('x-presenter-key'));
  if (!deckId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const admin = getAdmin();
  const now = new Date().toISOString();

  // Keep one outstanding credential per live session. Redeemed rows remain as
  // an audit trail; any earlier unused code stops working immediately.
  const { error: expireError } = await admin
    .from('gamma_pairing_codes')
    .update({ expires_at: now })
    .eq('session_id', sessionId)
    .is('redeemed_at', null)
    .gt('expires_at', now);
  if (expireError) return Response.json({ error: expireError.message }, { status: 500 });

  const code = makePairingCode();
  // Postgres keeps a NOT NULL expiry column for compatibility. Infinity means
  // this one-use credential remains valid until redeemed or superseded.
  const expiresAt = 'infinity';
  const { error } = await admin.from('gamma_pairing_codes').insert({
    session_id: sessionId,
    code_hash: hashGammaSecret(code.replace(/-/g, '')),
    label: sanitizeControllerLabel(body?.label),
    expires_at: expiresAt,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(
    { code, expiresAt: null, neverExpires: true, trustedDevice: true },
    { headers: { 'cache-control': 'no-store, max-age=0' } },
  );
}
