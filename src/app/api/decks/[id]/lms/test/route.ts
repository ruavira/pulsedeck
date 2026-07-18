// POST /api/decks/[id]/lms/test — send a signed test ping to the configured
// endpoint so trainers can verify the wiring before running a real session.
import { getAdmin } from '@/lib/supabase/admin';
import { verifyDeckKey, unauthorized } from '@/lib/server/presenter-auth';
import { deliverLmsWebhook, parseLmsConfig } from '@/lib/server/lms-bridge';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await verifyDeckKey(id, req.headers.get('x-presenter-key')))) return unauthorized();

  const { data } = await getAdmin().from('decks').select('lms').eq('id', id).single();
  const cfg = parseLmsConfig(data?.lms);

  const delivery = await deliverLmsWebhook(
    cfg,
    {
      event: 'test',
      sentAt: new Date().toISOString(),
      message: 'PulseDeck LMS bridge test ping — wiring verified if your receiver accepted the signature.',
    },
    'test',
  );
  return Response.json(delivery, { status: delivery.ok ? 200 : 502 });
}
