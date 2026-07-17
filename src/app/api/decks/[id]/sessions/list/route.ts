import { getAdmin } from '@/lib/supabase/admin';
import { verifyDeckKey, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';

interface SessionRow {
  id: string;
  code: string;
  status: 'lobby' | 'live' | 'ended';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  // PostgREST count aggregate on the embedded relation: [{ count: n }]
  participants: { count: number }[] | null;
}

export interface SessionListItem {
  id: string;
  code: string;
  status: 'lobby' | 'live' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

// GET /api/decks/[id]/sessions/list -> { sessions: SessionListItem[] } (newest first)
// Auth: x-presenter-key (same contract as POST /api/decks/[id]/sessions).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  if (!(await verifyDeckKey(id, key))) return unauthorized();

  const { data, error } = await getAdmin()
    .from('sessions')
    .select('id, code, status, started_at, ended_at, created_at, participants(count)')
    .eq('deck_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const sessions: SessionListItem[] = ((data ?? []) as unknown as SessionRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    participantCount: Array.isArray(row.participants) ? (row.participants[0]?.count ?? 0) : 0,
  }));

  return Response.json({ sessions });
}
