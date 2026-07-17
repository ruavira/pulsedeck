import { getAdmin, broadcast } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';
import { isInteractiveKind } from '@/lib/types';
import type { DeckSnapshot, Slide } from '@/lib/types';

export const runtime = 'nodejs';

// POST /api/presenter/[sessionId]/simulate  { participants?: number }
// REHEARSAL MODE: seeds phantom participants + plausible responses for the current
// slide + a handful of Q&A questions so the presenter can rehearse against a full
// room. Idempotent-safe: phantom count is capped per session, responses upsert with
// ON CONFLICT DO NOTHING on (slide_id, participant_id), and Q&A is only seeded once.

const DEFAULT_PARTICIPANTS = 20;
const MAX_PARTICIPANTS = 50;
const SIM_PREFIX = 'sim-';

const ANIMALS = [
  'Falcon', 'Otter', 'Lynx', 'Panda', 'Comet', 'Nova', 'Maple', 'Ember', 'Willow', 'Orca',
  'Sparrow', 'Tiger', 'Koala', 'Raven', 'Fox', 'Dolphin', 'Ibis', 'Puffin', 'Gecko', 'Heron',
  'Badger', 'Osprey', 'Marmot', 'Kestrel', 'Wombat',
];

const GENERIC_WORDS = ['insightful', 'energy', 'wow', 'clear', 'fun', 'more demos'];

const OPEN_TEXT_CANNED = [
  'Really clear explanation, thank you!',
  'Would love a deeper dive on this.',
  'The pacing was great so far.',
  'More live demos please!',
  'This finally clicked for me today.',
  'Can you share more real-world examples?',
];

const QA_CANNED = [
  'Can we get the slides afterwards?',
  'How does this scale to bigger rooms?',
  'What was the hardest part?',
  'Is there a recording of this session?',
  'What tools did you use to build this?',
];

const STOPWORDS = new Set([
  'what', 'which', 'that', 'this', 'with', 'from', 'your', 'have', 'about', 'would',
  'should', 'could', 'their', 'there', 'them', 'then', 'when', 'where', 'will', 'does',
  'most', 'more', 'some', 'into', 'like', 'best', 'than', 'they', 'been', 'were',
]);

const rand = (n: number) => Math.floor(Math.random() * n);
const randBetween = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)];
const shuffled = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
/** Approx-normal in [0,1] (mean 0.5) via the sum of three uniforms. */
const gauss01 = () => (Math.random() + Math.random() + Math.random()) / 3;

interface SimBody {
  participants?: number;
}

interface SimParticipant {
  id: string;
  nickname: string;
  device_key: string;
  session_id: string;
  score: number;
  streak: number;
}

interface ResponseRow {
  session_id: string;
  slide_id: string;
  participant_id: string;
  payload: Record<string, unknown>;
  answered_ms: number | null;
  is_correct: boolean | null;
  points: number;
}

function topicalWords(prompt: string | undefined, title: string): string[] {
  const source = `${prompt ?? ''} ${title}`;
  const words = source
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return [...new Set([...words.slice(0, 8), ...GENERIC_WORDS])];
}

export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const key = req.headers.get('x-presenter-key');
  const deckId = await verifySessionKey(sessionId, key);
  if (!deckId) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as SimBody;
  const target = Math.min(
    MAX_PARTICIPANTS,
    Math.max(1, Math.floor(body.participants ?? DEFAULT_PARTICIPANTS)),
  );

  const admin = getAdmin();
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('id, status, current_slide_index, phase, deck_snapshot, settings')
    .eq('id', sessionId)
    .single();
  if (sessionError || !session) {
    return Response.json({ error: sessionError?.message ?? 'not_found' }, { status: 404 });
  }
  if (session.status === 'ended') {
    return Response.json({ error: 'session_ended' }, { status: 400 });
  }

  // ---- 1. Phantom participants (idempotently capped at `target` per session) ----
  const { data: existingSims, error: simError } = await admin
    .from('participants')
    .select('id, nickname, device_key, session_id, score, streak')
    .eq('session_id', sessionId)
    .like('device_key', `${SIM_PREFIX}%`)
    .order('joined_at', { ascending: true });
  if (simError) return Response.json({ error: simError.message }, { status: 500 });

  const phantoms: SimParticipant[] = (existingSims ?? []) as SimParticipant[];
  const toCreate = Math.max(0, target - phantoms.length);
  if (toCreate > 0) {
    const rows = Array.from({ length: toCreate }, (_, i) => {
      const n = phantoms.length + i;
      return {
        session_id: sessionId,
        nickname: `Test ${ANIMALS[n % ANIMALS.length]} ${n + 1}`,
        device_key: `${SIM_PREFIX}${crypto.randomUUID()}`,
      };
    });
    const { data: created, error: createError } = await admin
      .from('participants')
      .insert(rows)
      .select('id, nickname, device_key, session_id, score, streak');
    if (createError) return Response.json({ error: createError.message }, { status: 500 });
    phantoms.push(...((created ?? []) as SimParticipant[]));
  }
  // Simulate against the whole phantom room. Creation above never grows the room
  // beyond max(existing, target), so this is capped at MAX_PARTICIPANTS forever.
  const roster = phantoms.slice(0, MAX_PARTICIPANTS);

  // ---- 2. Responses for the current slide (if interactive) ----
  let insertedResponses = 0;
  const snapshot = session.deck_snapshot as DeckSnapshot | null;
  const slide: Slide | undefined = snapshot?.slides?.[session.current_slide_index as number];

  if (slide && isInteractiveKind(slide.kind) && slide.kind !== 'qa') {
    const respondents = shuffled(roster).slice(0, Math.max(1, Math.round(roster.length * 0.8)));
    const rows: ResponseRow[] = [];
    const base = {
      session_id: sessionId,
      slide_id: slide.id,
      answered_ms: null as number | null,
      is_correct: null as boolean | null,
      points: 0,
    };

    if (slide.kind === 'poll') {
      const options = slide.body.options ?? [];
      if (options.length > 0) {
        // Weighted-random favoring options 0 and 1 so the chart looks like a real room.
        const weights = options.map((_, i) => (i === 0 ? 4 : i === 1 ? 3 : 1));
        const totalW = weights.reduce((a, b) => a + b, 0);
        for (const p of respondents) {
          let r = Math.random() * totalW;
          let choice = 0;
          for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r <= 0) {
              choice = i;
              break;
            }
          }
          rows.push({ ...base, participant_id: p.id, payload: { choice } });
        }
      }
    } else if (slide.kind === 'wordcloud') {
      const pool = topicalWords(slide.body.prompt, slide.title);
      const maxWords = Math.max(1, Math.min(slide.settings.maxWords ?? 3, 3));
      for (const p of respondents) {
        const words = shuffled(pool).slice(0, randBetween(1, maxWords));
        rows.push({ ...base, participant_id: p.id, payload: { words } });
      }
    } else if (slide.kind === 'quiz') {
      const options = slide.body.options ?? [];
      const correctIdx = (slide.body.correct ?? []).filter((i) => i >= 0 && i < options.length);
      const basePoints = slide.settings.points ?? 1000;
      if (options.length > 0) {
        for (const p of respondents) {
          const isCorrect = correctIdx.length > 0 && Math.random() < 0.6;
          const wrongPool = options
            .map((_, i) => i)
            .filter((i) => !correctIdx.includes(i));
          const choice = isCorrect
            ? pick(correctIdx)
            : wrongPool.length > 0
              ? pick(wrongPool)
              : rand(options.length);
          rows.push({
            ...base,
            participant_id: p.id,
            payload: { choice },
            answered_ms: randBetween(1200, 9000),
            is_correct: isCorrect,
            // Accuracy rule: base points on correct, no speed bonus (council ruling).
            points: isCorrect ? basePoints : 0,
          });
        }
      }
    } else if (slide.kind === 'scale') {
      const min = slide.body.min ?? 1;
      const max = slide.body.max ?? 10;
      const range = Math.max(1, max - min);
      for (const p of respondents) {
        // Normal-ish distribution centered around 70% of the range.
        const frac = Math.min(1, Math.max(0, 0.7 + (gauss01() - 0.5) * 0.6));
        const value = Math.round(min + frac * range);
        rows.push({ ...base, participant_id: p.id, payload: { value } });
      }
    } else if (slide.kind === 'open_text') {
      const topic = topicalWords(slide.body.prompt, slide.title)[0];
      const texts = shuffled([
        ...OPEN_TEXT_CANNED,
        ...(topic && !GENERIC_WORDS.includes(topic)
          ? [`The part about ${topic} really stood out.`]
          : []),
      ]).slice(0, randBetween(4, 6));
      texts.forEach((text, i) => {
        const p = respondents[i];
        if (p) rows.push({ ...base, participant_id: p.id, payload: { text } });
      });
    } else if (slide.kind === 'ranking') {
      const options = slide.body.options ?? [];
      if (options.length > 0) {
        for (const p of respondents) {
          rows.push({
            ...base,
            participant_id: p.id,
            payload: { ranking: shuffled(options.map((_, i) => i)) },
          });
        }
      }
    }

    if (rows.length > 0) {
      // ON CONFLICT (slide_id, participant_id) DO NOTHING → returns only fresh rows,
      // which makes score increments exactly-once across repeated simulate calls.
      const { data: inserted, error: respError } = await admin
        .from('responses')
        .upsert(rows, { onConflict: 'slide_id,participant_id', ignoreDuplicates: true })
        .select('participant_id, points, is_correct');
      if (respError) return Response.json({ error: respError.message }, { status: 500 });
      insertedResponses = inserted?.length ?? 0;

      if (slide.kind === 'quiz' && inserted && inserted.length > 0) {
        const pointsByParticipant = new Map<string, { points: number; correct: boolean }>();
        for (const r of inserted) {
          pointsByParticipant.set(r.participant_id as string, {
            points: (r.points as number) ?? 0,
            correct: r.is_correct === true,
          });
        }
        const updates = roster
          .filter((p) => pointsByParticipant.has(p.id))
          .map((p) => {
            const res = pointsByParticipant.get(p.id)!;
            return {
              id: p.id,
              session_id: p.session_id,
              nickname: p.nickname,
              device_key: p.device_key,
              score: p.score + res.points,
              streak: res.correct ? p.streak + 1 : 0,
            };
          });
        if (updates.length > 0) {
          const { error: scoreError } = await admin
            .from('participants')
            .upsert(updates, { onConflict: 'id' });
          if (scoreError) return Response.json({ error: scoreError.message }, { status: 500 });
        }
      }
    }
  }

  // ---- 3. Q&A questions (seeded once per session) ----
  const phantomIds = roster.map((p) => p.id);
  let simQuestionCount = 0;
  {
    const { count, error: qCountError } = await admin
      .from('qa_questions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .in('participant_id', phantomIds);
    if (qCountError) return Response.json({ error: qCountError.message }, { status: 500 });
    simQuestionCount = count ?? 0;
  }

  if (simQuestionCount === 0 && roster.length > 0) {
    const settings = (session.settings ?? {}) as { qaModerated?: boolean };
    const status = settings.qaModerated === true ? 'pending' : 'visible';
    const texts = shuffled(QA_CANNED).slice(0, randBetween(3, 5));
    const qRows = texts.map((text) => {
      const author = pick(roster);
      return {
        session_id: sessionId,
        participant_id: author.id,
        author_nickname: author.nickname,
        text,
        status,
      };
    });
    const { data: questions, error: qError } = await admin
      .from('qa_questions')
      .insert(qRows)
      .select('id');
    if (qError) return Response.json({ error: qError.message }, { status: 500 });
    simQuestionCount = questions?.length ?? 0;

    // Random upvotes from phantoms, then sync the denormalized counter.
    if (questions && questions.length > 0) {
      const upvoteRows: { question_id: string; participant_id: string }[] = [];
      for (const q of questions) {
        const voters = shuffled(roster).slice(0, rand(Math.min(roster.length, 12) + 1));
        for (const v of voters) {
          upvoteRows.push({ question_id: q.id as string, participant_id: v.id });
        }
      }
      if (upvoteRows.length > 0) {
        const { error: upError } = await admin
          .from('qa_upvotes')
          .upsert(upvoteRows, { onConflict: 'question_id,participant_id', ignoreDuplicates: true });
        if (upError) return Response.json({ error: upError.message }, { status: 500 });
      }
      for (const q of questions) {
        const { count } = await admin
          .from('qa_upvotes')
          .select('question_id', { count: 'exact', head: true })
          .eq('question_id', q.id as string);
        await admin
          .from('qa_questions')
          .update({ upvotes: count ?? 0 })
          .eq('id', q.id as string);
      }
    }
  }

  await broadcast(sessionId, 'qa', { bump: 1 });

  return Response.json({
    ok: true,
    participants: roster.length,
    responses: insertedResponses,
    questions: simQuestionCount,
  });
}
