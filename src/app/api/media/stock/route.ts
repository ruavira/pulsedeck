import { stockEnabled, searchStockImage, type StockSource } from '@/lib/server/stock';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

// POST /api/media/stock { query, variant?, source? } -> { url, alt }
// Used by the editor's "shuffle background image" control. Env-gated on
// PEXELS_API_KEY / UNSPLASH_ACCESS_KEY (returns 501 when no stock source is set).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!stockEnabled()) return Response.json({ error: 'stock_disabled' }, { status: 501 });
  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    variant?: number;
    source?: StockSource;
  };
  const query = String(body.query ?? '').trim();
  if (!query) return Response.json({ error: 'query_required' }, { status: 400 });
  const variant = Number.isFinite(body.variant) ? Number(body.variant) : 0;
  const img = await searchStockImage(query, variant, body.source);
  if (!img) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(img);
}
