import { getAdmin } from '@/lib/supabase/admin';
import { verifyPresenterAccess, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';

// GET /api/presenter/[sessionId] — full session load for stage/remote surfaces:
// state + frozen deck snapshot + join info. Requires x-presenter-key.
export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const access = await verifyPresenterAccess(sessionId, req);
  if (!access) return unauthorized();
  const deckId = access.deckId;

  const { data: s } = await getAdmin()
    .from('sessions')
    .select('id, code, status, current_slide_index, phase, phase_opened_at, settings, deck_snapshot, started_at')
    .eq('id', sessionId)
    .single();
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 });

  const { data: baselines } = await getAdmin()
    .from('gamma_deck_baselines')
    .select('document_slug, fingerprint, card_count, captured_at')
    .eq('deck_id', deckId);

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
    gammaBaselines: (baselines ?? []).map((baseline) => ({
      documentSlug: baseline.document_slug,
      fingerprint: baseline.fingerprint,
      cardCount: baseline.card_count,
      capturedAt: baseline.captured_at,
    })),
    controllerAccess:
      access.kind === 'gamma' ? { kind: 'gamma', controllerId: access.controllerId } : { kind: 'presenter' },
  });
}
