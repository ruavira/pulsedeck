import { proGate } from '@/lib/auth';
import { aiEnabled, aiDisabledResponse, claudeJson, DECK_SCHEMA_GUIDE } from '@/lib/server/ai';
import type { Slide } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/ai/quiz  { topic?, sourceText?, count? } -> { slides: quiz Slide[] }
export async function POST(req: Request) {
  if (!aiEnabled()) return aiDisabledResponse();
  const gate = await proGate();
  if (gate) return gate;
  const body = await req.json().catch(() => ({}));
  const { topic, sourceText } = body as { topic?: string; sourceText?: string };
  if (!topic && !sourceText) {
    return Response.json({ error: 'topic or sourceText required' }, { status: 400 });
  }
  const count = Math.min(Math.max(body.count ?? 5, 1), 15);

  const system = `You write excellent, fair, fun timed quiz questions for live audiences. ${DECK_SCHEMA_GUIDE}`;
  const user = `Create exactly ${count} quiz slides (kind "quiz") ${
    sourceText
      ? `based strictly on this source material:\n\n${String(sourceText).slice(0, 12000)}`
      : `about: "${topic}"`
  }. Vary difficulty from warm-up to challenging. 4 options each, one correct. timeLimitSec 20-30. Return {"title":"Quiz","slides":[...]} only.`;

  try {
    const out = await claudeJson<{ slides: Slide[] }>(system, user, 8000);
    if (!Array.isArray(out.slides) || out.slides.length === 0) {
      return Response.json({ error: 'ai_bad_output' }, { status: 502 });
    }
    const slides = out.slides
      .filter((s) => s.kind === 'quiz' && Array.isArray(s.body?.options))
      .map((s, i) => ({ ...s, id: crypto.randomUUID(), position: i }));
    return Response.json({ slides });
  } catch (e) {
    return Response.json({ error: `ai_failed: ${(e as Error).message}` }, { status: 502 });
  }
}
