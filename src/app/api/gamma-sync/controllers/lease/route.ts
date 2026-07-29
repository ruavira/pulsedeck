import {
  claimGammaLease,
  releaseGammaLease,
  verifyGammaController,
} from '@/lib/server/gamma-sync-auth';

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
  const access = await verifyGammaController(
    sessionId,
    req.headers.get('x-gamma-controller-token'),
  );
  if (!access) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }
  const action = body?.action;
  if (action === 'release') {
    await releaseGammaLease(sessionId, access.controllerId);
    return Response.json({ ok: true, released: true }, { headers: CORS_HEADERS });
  }
  if (!['claim', 'renew', 'takeover'].includes(action)) {
    return Response.json({ error: 'bad_request' }, { status: 400, headers: CORS_HEADERS });
  }
  const lease = await claimGammaLease(
    sessionId,
    access.controllerId,
    action === 'takeover',
  );
  return Response.json(
    { ok: lease.granted, lease },
    { status: lease.granted ? 200 : 409, headers: CORS_HEADERS },
  );
}
