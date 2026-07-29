import 'server-only';
import { getAdmin } from '@/lib/supabase/admin';
import { verifyGammaController } from '@/lib/server/gamma-sync-auth';

export type PresenterAccess =
  | { kind: 'presenter'; deckId: string }
  | { kind: 'gamma'; deckId: string; controllerId: string };

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

/** Verify either a full presenter key or a session-scoped Gamma controller token. */
export async function verifyPresenterAccess(
  sessionId: string,
  req: Request,
): Promise<PresenterAccess | null> {
  const gamma = await verifyGammaController(
    sessionId,
    req.headers.get('x-gamma-controller-token'),
  );
  if (gamma) {
    return { kind: 'gamma', deckId: gamma.deckId, controllerId: gamma.controllerId };
  }
  const deckId = await verifySessionKey(sessionId, req.headers.get('x-presenter-key'));
  return deckId ? { kind: 'presenter', deckId } : null;
}

export function unauthorized() {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}
