// GET/PUT /api/decks/[id]/lms — read/save the deck's LMS bridge config.
// Presenter-key auth like every other deck route. The secret is write-only:
// reads return hasSecret, never the value.
import { getAdmin } from '@/lib/supabase/admin';
import { verifyDeckKey, unauthorized } from '@/lib/server/presenter-auth';
import { isValidLmsUrl, parseLmsConfig } from '@/lib/server/lms-bridge';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await verifyDeckKey(id, req.headers.get('x-presenter-key')))) return unauthorized();

  const { data } = await getAdmin().from('decks').select('lms').eq('id', id).single();
  const cfg = parseLmsConfig(data?.lms);
  return Response.json({
    url: cfg.url ?? '',
    hasSecret: Boolean(cfg.secret),
    autoPush: cfg.autoPush !== false,
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await verifyDeckKey(id, req.headers.get('x-presenter-key')))) return unauthorized();

  const body = (await req.json().catch(() => null)) as {
    url?: string;
    secret?: string;
    autoPush?: boolean;
  } | null;
  if (!body) return Response.json({ error: 'bad_json' }, { status: 400 });

  const url = (body.url ?? '').trim();
  if (url && !isValidLmsUrl(url)) {
    return Response.json({ error: 'invalid_url' }, { status: 400 });
  }

  const admin = getAdmin();
  const { data } = await admin.from('decks').select('lms').eq('id', id).single();
  const prev = parseLmsConfig(data?.lms);

  const next = {
    url,
    // Keep the stored secret unless the caller sends a replacement (or clears
    // the URL entirely — no URL, no reason to hold a secret).
    secret: url ? (body.secret?.trim() || prev.secret || '') : '',
    autoPush: body.autoPush !== false,
  };
  if (next.url && !next.secret) {
    return Response.json({ error: 'secret_required' }, { status: 400 });
  }

  const { error } = await admin.from('decks').update({ lms: next }).eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, url: next.url, hasSecret: Boolean(next.secret), autoPush: next.autoPush });
}
