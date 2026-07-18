// POST /api/presenter/[sessionId]/lms-push — manual (re)send of this session's
// results to the deck's configured LMS endpoint. Used by the report page for
// retries and for sessions that ended before the bridge was configured.
import { getAdmin } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';
import { pushSessionToLms } from '@/lib/server/lms-bridge';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const deckId = await verifySessionKey(sessionId, req.headers.get('x-presenter-key'));
  if (!deckId) return unauthorized();

  const delivery = await pushSessionToLms(getAdmin(), sessionId, 'manual');
  const status = delivery.ok ? 200 : delivery.error === 'not_configured' ? 409 : 502;
  return Response.json(delivery, { status });
}
