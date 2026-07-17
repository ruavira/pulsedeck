import { getAdmin, broadcast } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';
import type { DeckSnapshot, Slide } from '@/lib/types';

export const runtime = 'nodejs';

// Presenter "hide this word" kill switch. New submissions are filtered DB-side by
// is_text_clean/clean_words (migration 003); this route adds the word AND scrubs
// content that already landed: matching Q&A questions are archived, and wordcloud
// responses on the CURRENT slide have the word removed from their payload.

/** Escape a banned word for use inside a Postgres regex (whole-word match). */
function escapeRegex(word: string): string {
  return word.replace(/[\\.^$|()[\]{}*+?]/g, '\\$&');
}

interface BannedWordsBody {
  word?: string;
}

// GET /api/presenter/[sessionId]/banned-words — list this session's banned words.
export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  const deckId = await verifySessionKey(sessionId, key);
  if (!deckId) return unauthorized();

  const { data, error } = await getAdmin()
    .from('banned_words')
    .select('word')
    .eq('session_id', sessionId)
    .order('word', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, words: (data ?? []).map((r) => r.word as string) });
}

// POST /api/presenter/[sessionId]/banned-words  { word }
// Adds the word (lowercase, trimmed) and retroactively scrubs existing content.
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  const deckId = await verifySessionKey(sessionId, key);
  if (!deckId) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as BannedWordsBody;
  const word = typeof body.word === 'string' ? body.word.trim().toLowerCase() : '';
  // Letters/digits/space/hyphen/apostrophe only — keeps the value safe inside both
  // the Postgres regex and the PostgREST filter string (no reserved chars).
  if (word.length === 0 || word.length > 40 || !/^[\p{L}\p{N}' -]+$/u.test(word)) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const admin = getAdmin();

  // 1. Persist (idempotent — (session_id, word) is the primary key).
  const { error: insertError } = await admin
    .from('banned_words')
    .upsert({ session_id: sessionId, word }, { ignoreDuplicates: true });
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  // 2. Archive existing Q&A questions containing the word (case-insensitive, whole word).
  const wordPattern = `\\m${escapeRegex(word)}\\M`;
  const { data: archived, error: archiveError } = await admin
    .from('qa_questions')
    .update({ status: 'archived' })
    .eq('session_id', sessionId)
    .neq('status', 'archived')
    .filter('text', 'imatch', wordPattern)
    .select('id');
  if (archiveError) return Response.json({ error: archiveError.message }, { status: 500 });
  const archivedQuestions = archived?.length ?? 0;

  // 3. Scrub wordcloud responses on the CURRENT slide (read-modify-write on payload).
  let cleanedResponses = 0;
  const { data: session } = await admin
    .from('sessions')
    .select('current_slide_index, deck_snapshot')
    .eq('id', sessionId)
    .single();
  const snapshot = session?.deck_snapshot as DeckSnapshot | null | undefined;
  const slide: Slide | undefined = snapshot?.slides?.[session?.current_slide_index as number];

  if (slide && slide.kind === 'wordcloud') {
    const { data: responses, error: respError } = await admin
      .from('responses')
      .select('id, payload')
      .eq('session_id', sessionId)
      .eq('slide_id', slide.id);
    if (respError) return Response.json({ error: respError.message }, { status: 500 });

    const matcher = new RegExp(`(?:^|\\s)${escapeRegex(word)}(?:$|\\s)`, 'i');
    for (const r of responses ?? []) {
      const payload = r.payload as { words?: unknown };
      if (!Array.isArray(payload.words)) continue;
      const words = payload.words.filter((w): w is string => typeof w === 'string');
      const kept = words.filter((w) => w.toLowerCase() !== word && !matcher.test(w));
      if (kept.length !== words.length) {
        const { error: updateError } = await admin
          .from('responses')
          .update({ payload: { ...(r.payload as Record<string, unknown>), words: kept } })
          .eq('id', r.id as string);
        if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
        cleanedResponses++;
      }
    }
  }

  // Q&A clients refetch on the bump; the stage results poller picks up scrubbed
  // wordcloud payloads on its next poll (no 'results' nudge needed).
  await broadcast(sessionId, 'qa', { bump: 1 });

  return Response.json({ ok: true, word, archivedQuestions, cleanedResponses });
}
