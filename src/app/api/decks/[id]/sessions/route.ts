import { getAdmin } from '@/lib/supabase/admin';
import { verifyDeckKey, unauthorized } from '@/lib/server/presenter-auth';
import type { DeckSnapshot, Slide } from '@/lib/types';

export const runtime = 'nodejs';

// Unambiguous alphabet (no 0/O, 1/I/L) for join codes read off a big screen.
const ALPHABET = '23456789ACDEFGHJKMNPQRSTUVWXYZ';
function makeCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

// POST /api/decks/[id]/sessions  { settings? } -> { sessionId, code, urls }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  if (!(await verifyDeckKey(id, key))) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const admin = getAdmin();

  const { data: deck } = await admin.from('decks').select('id, title, theme').eq('id', id).single();
  if (!deck) return Response.json({ error: 'not_found' }, { status: 404 });
  const { data: slides } = await admin
    .from('slides')
    .select('id, kind, title, body, settings, position')
    .eq('deck_id', id)
    .order('position');

  const snapshot: DeckSnapshot = {
    title: deck.title,
    theme: deck.theme ?? {},
    slides: (slides ?? []) as Slide[],
  };

  // Retry on the (unlikely) code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { data: session, error } = await admin
      .from('sessions')
      .insert({
        deck_id: id,
        code,
        status: 'live',
        started_at: new Date().toISOString(),
        deck_snapshot: snapshot,
        settings: { qaEnabled: true, qaModerated: false, ...(body.settings ?? {}) },
      })
      .select('id, code')
      .single();
    if (!error && session) {
      return Response.json({
        sessionId: session.id,
        code: session.code,
        stagePath: `/present/${session.id}`,
        remotePath: `/remote/${session.id}`,
        joinPath: `/j/${session.code}`,
      });
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }
  return Response.json({ error: 'code_collision' }, { status: 500 });
}
