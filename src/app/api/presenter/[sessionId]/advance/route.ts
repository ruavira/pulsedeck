import { getAdmin, broadcast } from '@/lib/supabase/admin';
import {
  claimGammaLease,
  gammaLeaseIsActive,
  holdGammaLeaseForRemote,
} from '@/lib/server/gamma-sync-auth';
import { verifyPresenterAccess, unauthorized } from '@/lib/server/presenter-auth';
import { parseLmsConfig, pushSessionToLms } from '@/lib/server/lms-bridge';
import type { Phase, SessionStatus, Slide } from '@/lib/types';

export const runtime = 'nodejs';

interface AdvanceBody {
  index?: number; // jump to slide index (resets phase — see AUTO_OPEN_KINDS)
  phase?: Phase; // set activity phase ('open' stamps phase_opened_at)
  status?: SessionStatus; // 'ended' to close the session
}

// Kinds where voting auto-opens the moment the slide comes up (the audience
// expects to respond immediately — Mentimeter behavior). Quizzes stay manual:
// the countdown must start when the presenter says go, not on navigation.
// Opt out per session with settings.autoOpenVoting === false.
const AUTO_OPEN_KINDS = new Set(['poll', 'wordcloud', 'scale', 'ranking', 'open_text']);

// POST /api/presenter/[sessionId]/advance
// The single mutation point for live session state. Broadcasts `state` after commit.
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const access = await verifyPresenterAccess(sessionId, req);
  if (!access) return unauthorized();
  const deckId = access.deckId;

  const body = (await req.json().catch(() => ({}))) as AdvanceBody;
  const admin = getAdmin();

  if (access.kind === 'gamma') {
    const currentLease = await gammaLeaseIsActive(sessionId, access.controllerId, admin);
    if (!currentLease.granted) {
      return Response.json(
        { error: 'controller_conflict', lease: currentLease },
        { status: 409, headers: { 'cache-control': 'no-store, max-age=0' } },
      );
    }
    const renewed = await claimGammaLease(sessionId, access.controllerId, false, admin);
    if (!renewed.granted) {
      return Response.json(
        { error: 'controller_conflict', lease: renewed },
        { status: 409, headers: { 'cache-control': 'no-store, max-age=0' } },
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.index === 'number') {
    const index = Math.max(0, Math.floor(body.index));
    patch.current_slide_index = index;
    patch.phase = 'show';
    patch.phase_opened_at = null;

    // Auto-open voting on arrival (single choke point: covers the phone remote,
    // stage keyboard, and the PowerPoint add-in alike).
    if (!body.phase) {
      const { data: row } = await admin
        .from('sessions')
        .select('deck_snapshot, settings')
        .eq('id', sessionId)
        .single();
      const slide = (row?.deck_snapshot as { slides?: Slide[] } | null)?.slides?.[index];
      const autoOpen =
        (row?.settings as { autoOpenVoting?: boolean } | null)?.autoOpenVoting !== false;
      if (slide && autoOpen && AUTO_OPEN_KINDS.has(slide.kind)) {
        patch.phase = 'open';
        patch.phase_opened_at = new Date().toISOString();
      }
    }
  }
  if (body.phase) {
    patch.phase = body.phase;
    if (body.phase === 'open') patch.phase_opened_at = new Date().toISOString();
  }
  if (body.status) {
    patch.status = body.status;
    if (body.status === 'ended') patch.ended_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no_op' }, { status: 400 });
  }

  const { data: session, error } = await admin
    .from('sessions')
    .update(patch)
    .eq('id', sessionId)
    .select('id, status, current_slide_index, phase, phase_opened_at, settings')
    .single();
  if (error || !session) return Response.json({ error: error?.message }, { status: 500 });

  const state = {
    id: session.id,
    status: session.status,
    currentSlideIndex: session.current_slide_index,
    phase: session.phase,
    phaseOpenedAt: session.phase_opened_at,
    settings: session.settings,
    serverTime: new Date().toISOString(),
  };
  await broadcast(sessionId, 'state', state);

  // Any presenter-key surface (phone remote, stage keyboard, add-in) takes a
  // short, explicit priority window. Gamma observes the conflict and enters
  // standby instead of fighting the human operator.
  if (access.kind === 'presenter') {
    await holdGammaLeaseForRemote(sessionId, admin);
  }

  // LMS bridge auto-push: when the session ends and the deck has a webhook
  // configured with autoPush on, deliver results before returning (serverless
  // runtimes don't survive un-awaited work; delivery caps itself at 6s and
  // never throws). The response stays `ok` regardless — delivery status is
  // recorded on the session for the report page.
  if (body.status === 'ended') {
    const { data: deckRow } = await admin.from('decks').select('lms').eq('id', deckId).single();
    const cfg = parseLmsConfig(deckRow?.lms);
    if (cfg.url && cfg.autoPush !== false) {
      await pushSessionToLms(admin, sessionId, 'session_end');
    }
  }

  return Response.json({ ok: true, state });
}
