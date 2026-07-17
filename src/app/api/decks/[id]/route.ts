import { getAdmin } from '@/lib/supabase/admin';
import { verifyDeckKey, unauthorized } from '@/lib/server/presenter-auth';
import type { Slide } from '@/lib/types';

export const runtime = 'nodejs';

// GET /api/decks/[id]  (requires presenter key) -> full deck with slides
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  if (!(await verifyDeckKey(id, key))) return unauthorized();

  const admin = getAdmin();
  const { data: deck } = await admin
    .from('decks')
    .select('id, title, theme, updated_at')
    .eq('id', id)
    .single();
  if (!deck) return Response.json({ error: 'not_found' }, { status: 404 });
  const { data: slides } = await admin
    .from('slides')
    .select('id, kind, title, body, settings, position')
    .eq('deck_id', id)
    .order('position');
  return Response.json({ ...deck, slides: slides ?? [] });
}

// PUT /api/decks/[id]  { title, theme, slides: Slide[] } — full save (replace slides)
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  if (!(await verifyDeckKey(id, key))) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: 'bad_json' }, { status: 400 });

  const admin = getAdmin();
  const { error: deckErr } = await admin
    .from('decks')
    .update({ title: body.title ?? 'Untitled deck', theme: body.theme ?? {}, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (deckErr) return Response.json({ error: deckErr.message }, { status: 500 });

  const slides: Slide[] = Array.isArray(body.slides) ? body.slides : [];
  // Replace-all strategy: simple, atomic enough for a single-presenter tool.
  await admin.from('slides').delete().eq('deck_id', id);
  if (slides.length > 0) {
    const rows = slides.map((s, i) => ({
      id: s.id && /^[0-9a-f-]{36}$/.test(s.id) ? s.id : undefined,
      deck_id: id,
      position: i,
      kind: s.kind ?? 'content',
      title: s.title ?? '',
      body: s.body ?? {},
      settings: s.settings ?? {},
    }));
    const { error: slideErr } = await admin.from('slides').insert(rows);
    if (slideErr) return Response.json({ error: slideErr.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

// DELETE /api/decks/[id]
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  if (!(await verifyDeckKey(id, key))) return unauthorized();
  await getAdmin().from('decks').delete().eq('id', id);
  return Response.json({ ok: true });
}
