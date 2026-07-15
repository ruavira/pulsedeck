import { giphyEnabled, searchGif } from '@/lib/server/giphy';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

// POST /api/media/gif { query, variant? } -> { url, alt }
// Animated-GIF background search. Env-gated on GIPHY_API_KEY (501 when unset).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!giphyEnabled()) return Response.json({ error: 'gif_disabled' }, { status: 501 });
  const body = (await req.json().catch(() => ({}))) as { query?: string; variant?: number };
  const query = String(body.query ?? '').trim();
  if (!query) return Response.json({ error: 'query_required' }, { status: 400 });
  const variant = Number.isFinite(body.variant) ? Number(body.variant) : 0;
  const gif = await searchGif(query, variant);
  if (!gif) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(gif);
}
