import { getAdmin } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';

// GET /api/presenter/[sessionId] — full session load for stage/remote surfaces:
// state + frozen deck snapshot + join info. Requires x-presenter-key.
export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  const deckId = await verifySessionKey(sessionId, key);
  if (!deckId) return unauthorized();

  const { data: s } = await getAdmin()
    .from('sessions')
    .select('id, code, status, current_slide_index, phase, phase_opened_at, settings, deck_snapshot, started_at')
    .eq('id', sessionId)
    .single();
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });

  return Response.json({
    id: s.id,
    code: s.code,
    deckId,
    status: s.status,
    currentSlideIndex: s.current_slide_index,
    phase: s.phase,
    phaseOpenedAt: s.phase_opened_at,
    settings: s.settings,
    deck: s.deck_snapshot,
    startedAt: s.started_at,
  });
}
