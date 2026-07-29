import { getAdmin } from '@/lib/supabase/admin';
import {
  hashGammaSecret,
  issueGammaController,
  sanitizeControllerLabel,
} from '@/lib/server/gamma-sync-auth';

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
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
  const code = typeof body?.code === 'string' ? body.code.replace(/[^a-z0-9]/gi, '').toUpperCase() : '';
  if (!/^[A-Z2-9]{9}$/.test(code)) {
    return Response.json({ error: 'invalid_pairing_code' }, { status: 400, headers: CORS_HEADERS });
  }

  const admin = getAdmin();
  const now = new Date().toISOString();
  const { data: redeemed, error } = await admin
    .from('gamma_pairing_codes')
    .update({ redeemed_at: now })
    .eq('code_hash', hashGammaSecret(code))
    .is('redeemed_at', null)
    .gt('expires_at', now)
    .select('session_id, label')
    .single();
  if (error || !redeemed) {
    return Response.json(
      { error: 'pairing_code_expired_or_used' },
      { status: 410, headers: CORS_HEADERS },
    );
  }

  try {
    const controller = await issueGammaController(
      redeemed.session_id as string,
      sanitizeControllerLabel(body?.label ?? redeemed.label),
      admin,
    );
    return Response.json(
      { sessionId: redeemed.session_id, ...controller },
      { headers: CORS_HEADERS },
    );
  } catch {
    return Response.json({ error: 'controller_create_failed' }, { status: 500, headers: CORS_HEADERS });
  }
}
