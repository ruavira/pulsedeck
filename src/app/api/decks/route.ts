import { getAdmin } from '@/lib/supabase/admin';
import { getSessionUser, getUserPlan } from '@/lib/auth';
import { limitsFor } from '@/lib/plans';
import type { Slide } from '@/lib/types';

export const runtime = 'nodejs';

// POST /api/decks  { title?, theme?, slides? } -> { id, presenterKey }
// If a presenter is signed in, the deck is stamped with owner_id (so it syncs
// to their account) and free-tier deck limits are enforced. Anonymous callers
// keep the legacy ownerless behavior.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = getAdmin();

  const user = await getSessionUser();
  if (user) {
    const plan = await getUserPlan(user.id);
    const max = limitsFor(plan).maxDecks;
    if (max !== Infinity) {
      const { count } = await admin
        .from('decks')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      if ((count ?? 0) >= max) {
        return Response.json(
          { error: 'deck_limit', limit: max, plan },
          { status: 403 },
        );
      }
    }
  }

  const { data: deck, error } = await admin
    .from('decks')
    .insert({
      title: body.title ?? 'Untitled deck',
      theme: body.theme ?? {},
      ...(user ? { owner_id: user.id } : {}),
    })
    .select('id, title, presenter_secret')
    .single();
  if (error || !deck) return Response.json({ error: error?.message }, { status: 500 });

  const slides: Slide[] = Array.isArray(body.slides) ? body.slides : [];
  if (slides.length > 0) {
    const rows = slides.map((s, i) => ({
      // Preserve client-generated slide ids (studio/AI/import decks carry them)
      id: s.id && /^[0-9a-f-]{36}$/.test(s.id) ? s.id : crypto.randomUUID(),
      deck_id: deck.id,
      position: i,
      kind: s.kind ?? 'content',
      title: s.title ?? '',
      body: s.body ?? {},
      settings: s.settings ?? {},
    }));
    const { error: slideErr } = await admin.from('slides').insert(rows);
    if (slideErr) return Response.json({ error: slideErr.message }, { status: 500 });
  }

  return Response.json({ id: deck.id, title: deck.title, presenterKey: deck.presenter_secret });
}
