import { issueGammaController } from '@/lib/server/gamma-sync-auth';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const deckId = await verifySessionKey(sessionId, req.headers.get('x-presenter-key'));
  if (!deckId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  try {
    const controller = await issueGammaController(sessionId, body?.label);
    return Response.json(
      { sessionId, ...controller },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  } catch {
    return Response.json({ error: 'controller_create_failed' }, { status: 500 });
  }
}
