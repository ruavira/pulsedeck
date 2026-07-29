import { getAdmin } from '@/lib/supabase/admin';
import { gammaLeaseIsActive, verifyGammaController } from '@/lib/server/gamma-sync-auth';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-gamma-controller-token',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store, max-age=0',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
  const documentSlug = typeof body?.documentSlug === 'string' ? body.documentSlug.trim() : '';
  const fingerprint = typeof body?.fingerprint === 'string' ? body.fingerprint.trim() : '';
  const cardCount = Number.isInteger(body?.cardCount) ? body.cardCount : 0;
  if (
    !/^[0-9a-f-]{36}$/i.test(sessionId) ||
    !/^[^/]{6,240}$/.test(documentSlug) ||
    !/^[0-9a-f]{16}$/i.test(fingerprint) ||
    cardCount < 1 ||
    cardCount > 2000
  ) {
    return Response.json({ error: 'bad_request' }, { status: 400, headers: CORS_HEADERS });
  }
  const admin = getAdmin();
  const access = await verifyGammaController(
    sessionId,
    req.headers.get('x-gamma-controller-token'),
    admin,
  );
  if (!access) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }
  const lease = await gammaLeaseIsActive(sessionId, access.controllerId, admin);
  if (!lease.granted) {
    return Response.json({ error: 'controller_conflict', lease }, { status: 409, headers: CORS_HEADERS });
  }
  const capturedAt = new Date().toISOString();
  const { error } = await admin.from('gamma_deck_baselines').upsert(
    {
      deck_id: access.deckId,
      document_slug: documentSlug,
      fingerprint,
      card_count: cardCount,
      captured_at: capturedAt,
    },
    { onConflict: 'deck_id,document_slug' },
  );
  if (error) return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return Response.json(
    { ok: true, baseline: { documentSlug, fingerprint, cardCount, capturedAt } },
    { headers: CORS_HEADERS },
  );
}
