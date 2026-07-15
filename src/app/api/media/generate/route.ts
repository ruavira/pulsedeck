import { proGate } from '@/lib/auth';
import { generateImage, imagegenEnabled } from '@/lib/server/imagegen';
import type { ImageProvider, ImageStyle } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/media/generate { query, provider?, style?, seed? } -> { url, provider }
// Generate a single AI hero image with a chosen engine. Pro-gated (paid engines
// cost credits). Best-effort: 502 if the engine returns nothing.
export async function POST(req: Request) {
  if (!imagegenEnabled()) return Response.json({ error: 'imagegen_disabled' }, { status: 501 });
  const gate = await proGate();
  if (gate) return gate;
  const body = (await req.json().catch(() => ({}))) as {
    query?: string;
    provider?: ImageProvider;
    style?: ImageStyle;
    seed?: number;
  };
  const query = String(body.query ?? '').trim();
  if (!query) return Response.json({ error: 'query_required' }, { status: 400 });
  const url = await generateImage(query, {
    provider: body.provider,
    style: body.style,
    seed: body.seed,
  });
  if (!url) return Response.json({ error: 'generation_failed' }, { status: 502 });
  return Response.json({ url, provider: body.provider ?? 'auto' });
}
