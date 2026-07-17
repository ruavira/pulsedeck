// GET /api/account/decks -> { decks: [{ id, title, presenterKey, updatedAt }] }
// Decks owned by the signed-in presenter, so the studio library follows the
// account across devices. Returns an empty list when signed out.
import { getSessionUser } from '@/lib/auth';
import { getAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ decks: [] });

  const { data } = await getAdmin()
    .from('decks')
    .select('id, title, presenter_secret, updated_at')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false });

  const decks = (data ?? []).map((d) => ({
    id: d.id as string,
    title: d.title as string,
    presenterKey: d.presenter_secret as string,
    updatedAt: d.updated_at as string,
  }));
  return Response.json({ decks });
}
