import { getAdmin, broadcast } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';

// POST /api/presenter/[sessionId]/qa  { questionId, status } — moderate Q&A
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  if (!(await verifySessionKey(sessionId, key))) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const { questionId, status } = body as { questionId?: string; status?: string };
  if (!questionId || !status || !['pending', 'visible', 'answered', 'archived'].includes(status)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const { error } = await getAdmin()
    .from('qa_questions')
    .update({ status })
    .eq('id', questionId)
    .eq('session_id', sessionId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await broadcast(sessionId, 'qa', { bump: 1 });
  return Response.json({ ok: true });
}
