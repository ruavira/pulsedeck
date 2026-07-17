import { getAdmin } from '@/lib/supabase/admin';
import { translateTexts, isTranslateTarget } from '@/lib/server/translate';

export const runtime = 'nodejs';

// POST /api/translate  { sessionId, target, texts: string[] } -> { translations: string[] }
//
// Participant-facing (no presenter key). To stop the endpoint being an open
// translation proxy, it only serves sessions that (a) exist and (b) have the
// facilitator's `translateEnabled` setting on. Failures degrade to the originals
// upstream, so this never blocks a participant.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { sessionId?: string; target?: string; texts?: unknown }
    | null;
  if (!body || typeof body.sessionId !== 'string' || typeof body.target !== 'string') {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!isTranslateTarget(body.target)) {
    return Response.json({ error: 'unsupported_target' }, { status: 400 });
  }
  const texts = Array.isArray(body.texts)
    ? body.texts.filter((t): t is string => typeof t === 'string').slice(0, 24)
    : [];
  if (texts.length === 0) return Response.json({ translations: [] });

  const admin = getAdmin();
  const { data: session } = await admin
    .from('sessions')
    .select('settings')
    .eq('id', body.sessionId)
    .single();
  if (!session) return Response.json({ error: 'not_found' }, { status: 404 });
  const settings = (session.settings ?? {}) as Record<string, unknown>;
  if (settings.translateEnabled !== true) {
    // Translation isn't switched on for this room — hand back the originals so the
    // participant UI simply shows source text.
    return Response.json({ translations: texts });
  }

  const translations = await translateTexts(texts, body.target);
  return new Response(JSON.stringify({ translations }), {
    headers: {
      'content-type': 'application/json',
      // Question text is stable for the life of a slide; let the browser reuse it.
      'cache-control': 'private, max-age=120',
    },
  });
}
