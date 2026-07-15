import { getAdmin } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';
import type {
  ChoiceResults,
  DeckSnapshot,
  LeaderboardEntry,
  OpenTextResults,
  Results,
  ScaleResults,
  Slide,
  WordcloudResults,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// GET /api/presenter/[sessionId]/report  (x-presenter-key header or ?key=)
// Full post-session report JSON:
// { session:{code,title,startedAt,endedAt,participantCount},
//   slides:[{id,title,kind,prompt,results}], leaderboard:[...25], questions:[...] }
// Aggregates are computed server-side per slide, mirroring the get_results RPC shapes.

interface ResponseRow {
  slide_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const INTERACTIVE = new Set<Slide['kind']>(['poll', 'quiz', 'ranking', 'wordcloud', 'scale', 'open_text']);

function aggregate(slide: Slide, rows: ResponseRow[]): Results {
  switch (slide.kind) {
    case 'poll':
    case 'quiz':
    case 'ranking': {
      const counts: Record<string, number> = {};
      for (const r of rows) {
        if (r.payload.choice !== undefined && r.payload.choice !== null) {
          const k = String(r.payload.choice);
          counts[k] = (counts[k] ?? 0) + 1;
        } else if (Array.isArray(r.payload.choices)) {
          for (const c of r.payload.choices as unknown[]) {
            const k = String(c);
            counts[k] = (counts[k] ?? 0) + 1;
          }
        }
      }
      return { kind: slide.kind, total: rows.length, counts } satisfies ChoiceResults;
    }
    case 'wordcloud': {
      const tally = new Map<string, number>();
      for (const r of rows) {
        if (!Array.isArray(r.payload.words)) continue;
        for (const raw of r.payload.words as unknown[]) {
          const w = String(raw ?? '').trim().toLowerCase();
          if (!w) continue;
          tally.set(w, (tally.get(w) ?? 0) + 1);
        }
      }
      const words: Record<string, number> = {};
      [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60)
        .forEach(([w, c]) => (words[w] = c));
      return { kind: 'wordcloud', total: rows.length, words } satisfies WordcloudResults;
    }
    case 'scale': {
      const counts: Record<string, number> = {};
      let sum = 0;
      let n = 0;
      for (const r of rows) {
        const v = Number(r.payload.value);
        if (!Number.isFinite(v)) continue;
        const k = String(r.payload.value);
        counts[k] = (counts[k] ?? 0) + 1;
        sum += v;
        n += 1;
      }
      const avg = n > 0 ? Math.round((sum / n) * 100) / 100 : 0;
      return { kind: 'scale', total: rows.length, avg, counts } satisfies ScaleResults;
    }
    default: {
      // open_text
      const entries = [...rows]
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 100)
        .map((r) => ({ text: String(r.payload.text ?? '') }))
        .filter((e) => e.text.trim() !== '');
      return { kind: 'open_text', total: rows.length, entries } satisfies OpenTextResults;
    }
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const url = new URL(req.url);
  const key = req.headers.get('x-presenter-key') ?? url.searchParams.get('key');
  if (!(await verifySessionKey(sessionId, key))) return unauthorized();

  const admin = getAdmin();
  const { data: session, error } = await admin
    .from('sessions')
    .select('id, code, status, started_at, ended_at, deck_snapshot')
    .eq('id', sessionId)
    .single();
  if (error || !session) return Response.json({ error: 'not_found' }, { status: 404 });

  const snapshot = (session.deck_snapshot ?? null) as DeckSnapshot | null;
  const slides: Slide[] = [...(snapshot?.slides ?? [])].sort((a, b) => a.position - b.position);

  const [{ count: participantCount }, { data: leaderboard }, { data: responses }, { data: questions }] =
    await Promise.all([
      admin.from('participants').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
      admin
        .from('participants')
        .select('nickname, score, streak')
        .eq('session_id', sessionId)
        .order('score', { ascending: false })
        .order('joined_at', { ascending: true })
        .limit(25),
      admin
        .from('responses')
        .select('slide_id, payload, created_at')
        .eq('session_id', sessionId),
      admin
        .from('qa_questions')
        .select('id, text, author_nickname, status, upvotes, created_at')
        .eq('session_id', sessionId)
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: true }),
    ]);

  const bySlide = new Map<string, ResponseRow[]>();
  for (const r of (responses ?? []) as ResponseRow[]) {
    const row: ResponseRow = {
      slide_id: r.slide_id,
      payload: (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>,
      created_at: r.created_at,
    };
    const list = bySlide.get(row.slide_id);
    if (list) list.push(row);
    else bySlide.set(row.slide_id, [row]);
  }

  const reportSlides = slides
    .filter((s) => INTERACTIVE.has(s.kind))
    .map((s) => ({
      id: s.id,
      title: s.title,
      kind: s.kind,
      prompt: s.body.prompt ?? '',
      options: s.body.options ?? undefined,
      correct: s.kind === 'quiz' ? s.body.correct ?? [] : undefined,
      min: s.body.min,
      max: s.body.max,
      minLabel: s.body.minLabel,
      maxLabel: s.body.maxLabel,
      results: aggregate(s, bySlide.get(s.id) ?? []),
    }));

  return Response.json(
    {
      session: {
        code: session.code as string,
        title: snapshot?.title ?? 'Untitled deck',
        status: session.status as string,
        startedAt: (session.started_at as string | null) ?? null,
        endedAt: (session.ended_at as string | null) ?? null,
        participantCount: participantCount ?? 0,
      },
      slides: reportSlides,
      leaderboard: ((leaderboard ?? []) as LeaderboardEntry[]).map((p) => ({
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
      })),
      questions: (questions ?? []).map((q) => ({
        id: q.id as string,
        text: q.text as string,
        author: (q.author_nickname as string) ?? 'Anonymous',
        status: q.status as 'pending' | 'visible' | 'answered' | 'archived',
        upvotes: (q.upvotes as number) ?? 0,
        createdAt: q.created_at as string,
      })),
    },
    {
      headers: {
        'referrer-policy': 'no-referrer',
        'cache-control': 'no-store',
      },
    },
  );
}
