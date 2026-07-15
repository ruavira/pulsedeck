import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';

/** Verify x-presenter-key against a deck. Returns true if authorized. */
export async function verifyDeckKey(deckId: string, key: string | null): Promise<boolean> {
  if (!key) return false;
  const { data } = await getAdmin()
    .from('decks')
    .select('presenter_secret')
    .eq('id', deckId)
    .single();
  return !!data && data.presenter_secret === key;
}

/** Verify x-presenter-key against the deck that owns a session. Returns deck_id or null. */
export async function verifySessionKey(
  sessionId: string,
  key: string | null,
): Promise<string | null> {
  if (!key) return null;
  const admin = getAdmin();
  const { data: session } = await admin
    .from('sessions')
    .select('deck_id')
    .eq('id', sessionId)
    .single();
  if (!session) return null;
  const ok = await verifyDeckKey(session.deck_id, key);
  return ok ? session.deck_id : null;
}

export function unauthorized() {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}
