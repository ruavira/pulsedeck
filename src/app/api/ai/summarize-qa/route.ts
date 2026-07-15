import { proGate } from '@/lib/auth';
import { aiEnabled, aiDisabledResponse, claudeJson } from '@/lib/server/ai';
import { getAdmin } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/ai/summarize-qa  { sessionId } -> { themes: [{theme, questions[]}], summary }
export async function POST(req: Request) {
  if (!aiEnabled()) return aiDisabledResponse();
  const gate = await proGate();
  if (gate) return gate;
  const { sessionId } = await req.json().catch(() => ({}));
  const key = req.headers.get('x-presenter-key');
  if (!sessionId || !(await verifySessionKey(sessionId, key))) return unauthorized();

  const { data: questions } = await getAdmin()
    .from('qa_questions')
    .select('text, upvotes, status')
    .eq('session_id', sessionId)
    .order('upvotes', { ascending: false })
    .limit(200);

  if (!questions || questions.length === 0) {
    return Response.json({ themes: [], summary: 'No questions were submitted.' });
  }

  try {
    const out = await claudeJson<{ themes: { theme: string; questions: string[] }[]; summary: string }>(
      'You summarize live audience Q&A for a presenter. Group questions into 3-6 themes, keep original wording, order themes by combined upvotes. Output only JSON: {"themes":[{"theme":string,"questions":[string]}],"summary":string} — summary is 2-3 sentences the presenter can read aloud.',
      `Questions (with upvote counts):\n${questions.map((q) => `[${q.upvotes}] ${q.text}`).join('\n')}`,
      4000,
    );
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: `ai_failed: ${(e as Error).message}` }, { status: 502 });
  }
}
