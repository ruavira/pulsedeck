import { getAdmin } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';
import type { QaQuestion } from '@/lib/types';

export const runtime = 'nodejs';

// GET /api/presenter/[sessionId]/questions — the moderation queue.
// Unlike the public get_questions RPC (visible/answered only), this returns EVERY
// question — pending, visible, answered, archived — so the remote's moderation tab
// can approve/dismiss. Ordered pending-first, then upvotes desc, then oldest-first.

const STATUS_RANK: Record<QaQuestion['status'], number> = {
  pending: 0,
  visible: 1,
  answered: 2,
  archived: 3,
};

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  const deckId = await verifySessionKey(sessionId, key);
  if (!deckId) return unauthorized();

  const { data, error } = await getAdmin()
    .from('qa_questions')
    .select('id, text, author_nickname, status, upvotes, created_at')
    .eq('session_id', sessionId)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const questions: QaQuestion[] = (data ?? []).map((q) => ({
    id: q.id as string,
    text: q.text as string,
    author: q.author_nickname as string,
    status: q.status as QaQuestion['status'],
    upvotes: q.upvotes as number,
    createdAt: q.created_at as string,
  }));

  // Stable sort: pending first, then the upvotes/createdAt ordering from the query.
  questions.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

  const counts = {
    pending: 0,
    visible: 0,
    answered: 0,
    archived: 0,
    total: questions.length,
  };
  for (const q of questions) counts[q.status]++;

  return Response.json({ ok: true, questions, counts });
}
