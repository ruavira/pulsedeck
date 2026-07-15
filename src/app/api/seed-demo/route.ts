// POST /api/seed-demo — idempotently seed the canonical demo deck.
//
// No auth by design: this exists so the orchestrator and the studio's empty
// state can conjure a ready-to-present deck instantly. It is guarded against
// duplication — if a deck with the demo title already exists, we return that
// deck (with its presenter_secret) instead of creating another.

import { getAdmin } from '@/lib/supabase/admin';
import { buildDemoDeck, DEMO_DECK_TITLE } from '@/lib/demo-deck';

export const runtime = 'nodejs';

interface SeedResponse {
  id: string;
  title: string;
  presenterKey: string;
  existing: boolean;
}

export async function POST() {
  let admin;
  try {
    admin = getAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Supabase admin client unavailable';
    return Response.json({ error: message }, { status: 500 });
  }

  // 1) Idempotency guard: reuse an existing demo deck if one is already seeded.
  const { data: existing, error: lookupErr } = await admin
    .from('decks')
    .select('id, title, presenter_secret')
    .eq('title', DEMO_DECK_TITLE)
    .limit(1);
  if (lookupErr) {
    return Response.json({ error: lookupErr.message }, { status: 500 });
  }
  if (existing && existing.length > 0) {
    const deck = existing[0];
    const body: SeedResponse = {
      id: deck.id,
      title: deck.title,
      presenterKey: deck.presenter_secret,
      existing: true,
    };
    return Response.json(body);
  }

  // 2) Create the deck (same pattern as POST /api/decks).
  const demo = buildDemoDeck();
  const { data: deck, error: deckErr } = await admin
    .from('decks')
    .insert({ title: demo.title, theme: demo.theme })
    .select('id, title, presenter_secret')
    .single();
  if (deckErr || !deck) {
    return Response.json(
      { error: deckErr?.message ?? 'Failed to create demo deck' },
      { status: 500 },
    );
  }

  // 3) Insert the slides, positions sequential.
  const rows = demo.slides.map((s) => ({
    deck_id: deck.id,
    position: s.position,
    kind: s.kind,
    title: s.title,
    body: s.body,
    settings: s.settings,
  }));
  const { error: slideErr } = await admin.from('slides').insert(rows);
  if (slideErr) {
    // Don't leave a hollow deck behind for the next seed call to "find".
    await admin.from('decks').delete().eq('id', deck.id);
    return Response.json({ error: slideErr.message }, { status: 500 });
  }

  const body: SeedResponse = {
    id: deck.id,
    title: deck.title,
    presenterKey: deck.presenter_secret,
    existing: false,
  };
  return Response.json(body);
}
