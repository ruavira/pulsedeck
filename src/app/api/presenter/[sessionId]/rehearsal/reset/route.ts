import { getAdmin, broadcast } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const deckId = await verifySessionKey(sessionId, req.headers.get('x-presenter-key'));
  if (!deckId) return unauthorized();
  const admin = getAdmin();
  const { data: phantoms, error: readError } = await admin
    .from('participants')
    .select('id')
    .eq('session_id', sessionId)
    .like('device_key', 'sim-%');
  if (readError) return Response.json({ error: readError.message }, { status: 500 });
  const phantomIds = (phantoms ?? []).map((participant) => participant.id as string);

  let removedQuestions = 0;
  if (phantomIds.length > 0) {
    const { count, error: questionError } = await admin
      .from('qa_questions')
      .delete({ count: 'exact' })
      .eq('session_id', sessionId)
      .in('participant_id', phantomIds);
    if (questionError) return Response.json({ error: questionError.message }, { status: 500 });
    removedQuestions = count ?? 0;
    const { error: participantError } = await admin
      .from('participants')
      .delete()
      .eq('session_id', sessionId)
      .in('id', phantomIds);
    if (participantError) return Response.json({ error: participantError.message }, { status: 500 });
  }

  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .update({ current_slide_index: 0, phase: 'show', phase_opened_at: null })
    .eq('id', sessionId)
    .select('id, status, current_slide_index, phase, phase_opened_at, settings')
    .single();
  if (sessionError || !session) {
    return Response.json({ error: sessionError?.message ?? 'not_found' }, { status: 500 });
  }
  const state = {
    id: session.id,
    status: session.status,
    currentSlideIndex: session.current_slide_index,
    phase: session.phase,
    phaseOpenedAt: session.phase_opened_at,
    settings: session.settings,
    serverTime: new Date().toISOString(),
  };
  await Promise.all([
    broadcast(sessionId, 'state', state),
    broadcast(sessionId, 'qa', { action: 'reset', bump: 1 }),
  ]);
  return Response.json({
    ok: true,
    removedParticipants: phantomIds.length,
    removedQuestions,
    state,
  });
}
