import { getAdmin, broadcast } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';
import type { SessionSettings } from '@/lib/types';

export const runtime = 'nodejs';

// Session settings the presenter may toggle live. `locked` (room lock) lives in the
// same jsonb column and is read by the join_session RPC, so it merges here too.
type SettingsPatch = Partial<SessionSettings> & { locked?: boolean };

const ALLOWED_KEYS = ['qaModerated', 'qaEnabled', 'lockedNicknames', 'locked', 'autoOpenVoting'] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

interface SettingsBody {
  settings?: SettingsPatch;
}

// POST /api/presenter/[sessionId]/settings  { settings: { locked?, qaModerated?, ... } }
// Merges the patch into sessions.settings (read-modify-write) and broadcasts `state`.
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  const deckId = await verifySessionKey(sessionId, key);
  if (!deckId) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as SettingsBody;
  if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  // Whitelist keys and require boolean values — settings are all toggles today.
  const patch: Record<string, boolean> = {};
  for (const k of ALLOWED_KEYS) {
    const v = (body.settings as Record<string, unknown>)[k];
    if (typeof v === 'boolean') patch[k as AllowedKey] = v;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no_op' }, { status: 400 });
  }

  const admin = getAdmin();

  // Read-modify-write: merge into the existing settings jsonb.
  const { data: current, error: readError } = await admin
    .from('sessions')
    .select('settings')
    .eq('id', sessionId)
    .single();
  if (readError || !current) {
    return Response.json({ error: readError?.message ?? 'not_found' }, { status: 404 });
  }

  const merged = { ...((current.settings as Record<string, unknown>) ?? {}), ...patch };

  const { data: session, error } = await admin
    .from('sessions')
    .update({ settings: merged })
    .eq('id', sessionId)
    .select('id, status, current_slide_index, phase, phase_opened_at, settings')
    .single();
  if (error || !session) {
    return Response.json({ error: error?.message ?? 'update_failed' }, { status: 500 });
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
  await broadcast(sessionId, 'state', state);
  return Response.json({ ok: true, state });
}
