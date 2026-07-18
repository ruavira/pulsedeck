// GET /api/account/analytics -> cross-session trainer analytics for the
// signed-in presenter's decks: engagement trend, question difficulty (item
// stats), and returning-learner progress. Aggregated server-side with the
// admin client (ownership enforced by owner_id), so RLS context is irrelevant
// and phones never see other participants' rows.
import { getSessionUser } from '@/lib/auth';
import { getAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TrendBucket {
  weekStart: string; // ISO date (Monday)
  sessions: number;
  participants: number;
}

interface DeckStat {
  id: string;
  title: string;
  sessions: number;
  participants: number;
  quizAttempts: number;
  correctPct: number | null; // null when the deck has no quiz responses
  lastRunAt: string | null;
}

interface DifficultyRow {
  slideId: string;
  deckId: string;
  deckTitle: string;
  question: string;
  attempts: number;
  correctPct: number;
  avgMs: number | null;
}

interface LearnerRow {
  nickname: string;
  sessions: number;
  quizAttempts: number;
  correctPct: number | null;
  lastSeenAt: string;
  /** Chronological per-session correct % (quiz sessions only) for a sparkline. */
  progress: { at: string; pct: number }[];
}

function mondayOf(d: Date): string {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (c.getUTCDay() + 6) % 7; // Mon=0
  c.setUTCDate(c.getUTCDate() - day);
  return c.toISOString().slice(0, 10);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = getAdmin();

  const { data: decks, error: deckErr } = await admin
    .from('decks')
    .select('id, title')
    .eq('owner_id', user.id);
  if (deckErr) return Response.json({ error: deckErr.message }, { status: 500 });
  const deckIds = (decks ?? []).map((d) => d.id as string);
  const deckTitle = new Map((decks ?? []).map((d) => [d.id as string, (d.title as string) || 'Untitled deck']));

  const empty = deckIds.length === 0;

  const [{ data: sessions }, { data: slides }] = empty
    ? [{ data: [] as never[] }, { data: [] as never[] }]
    : await Promise.all([
        admin
          .from('sessions')
          .select('id, deck_id, code, status, started_at, ended_at, created_at')
          .in('deck_id', deckIds)
          .order('created_at', { ascending: true }),
        admin.from('slides').select('id, deck_id, kind, title').in('deck_id', deckIds),
      ]);

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const sessionById = new Map((sessions ?? []).map((s) => [s.id as string, s]));

  const [{ data: participants }, { data: responses }] =
    sessionIds.length === 0
      ? [{ data: [] as never[] }, { data: [] as never[] }]
      : await Promise.all([
          admin
            .from('participants')
            .select('id, session_id, device_key, nickname, joined_at')
            .in('session_id', sessionIds),
          admin
            .from('responses')
            .select('session_id, slide_id, participant_id, is_correct, answered_ms, created_at')
            .in('session_id', sessionIds),
        ]);

  // ---- sessions that actually ran (someone joined, or it went past the lobby)
  const participantsBySession = new Map<string, number>();
  for (const p of participants ?? []) {
    const sid = p.session_id as string;
    participantsBySession.set(sid, (participantsBySession.get(sid) ?? 0) + 1);
  }
  const ranSessions = (sessions ?? []).filter(
    (s) => (participantsBySession.get(s.id as string) ?? 0) > 0 || s.status !== 'lobby',
  );

  // ---- engagement trend: last 12 ISO weeks
  const buckets = new Map<string, TrendBucket>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const wk = mondayOf(d);
    buckets.set(wk, { weekStart: wk, sessions: 0, participants: 0 });
  }
  for (const s of ranSessions) {
    const at = (s.started_at ?? s.created_at) as string;
    const wk = mondayOf(new Date(at));
    const b = buckets.get(wk);
    if (!b) continue; // older than the window
    b.sessions += 1;
    b.participants += participantsBySession.get(s.id as string) ?? 0;
  }

  // ---- quiz item stats (difficulty) + per-deck aggregates
  const slideMeta = new Map(
    (slides ?? []).map((sl) => [sl.id as string, { deckId: sl.deck_id as string, kind: sl.kind as string, title: (sl.title as string) || '' }]),
  );
  interface ItemAgg { attempts: number; correct: number; msSum: number; msN: number }
  const items = new Map<string, ItemAgg>();
  interface DeckAgg { attempts: number; correct: number }
  const deckQuiz = new Map<string, DeckAgg>();
  // per participant per session quiz tallies (for learner progress)
  const perPart = new Map<string, { attempts: number; correct: number }>();

  for (const r of responses ?? []) {
    const meta = slideMeta.get(r.slide_id as string);
    if (!meta || meta.kind !== 'quiz') continue;
    const key = r.slide_id as string;
    const it = items.get(key) ?? { attempts: 0, correct: 0, msSum: 0, msN: 0 };
    it.attempts += 1;
    if (r.is_correct === true) it.correct += 1;
    if (typeof r.answered_ms === 'number') {
      it.msSum += r.answered_ms as number;
      it.msN += 1;
    }
    items.set(key, it);

    const dq = deckQuiz.get(meta.deckId) ?? { attempts: 0, correct: 0 };
    dq.attempts += 1;
    if (r.is_correct === true) dq.correct += 1;
    deckQuiz.set(meta.deckId, dq);

    const pk = r.participant_id as string;
    const pp = perPart.get(pk) ?? { attempts: 0, correct: 0 };
    pp.attempts += 1;
    if (r.is_correct === true) pp.correct += 1;
    perPart.set(pk, pp);
  }

  const difficulty: DifficultyRow[] = [...items.entries()]
    .filter(([, v]) => v.attempts >= 3) // too few attempts = noise, not signal
    .map(([slideId, v]) => {
      const meta = slideMeta.get(slideId)!;
      return {
        slideId,
        deckId: meta.deckId,
        deckTitle: deckTitle.get(meta.deckId) ?? 'Untitled deck',
        question: meta.title || '(untitled question)',
        attempts: v.attempts,
        correctPct: Math.round((v.correct / v.attempts) * 100),
        avgMs: v.msN > 0 ? Math.round(v.msSum / v.msN) : null,
      };
    })
    .sort((a, b) => a.correctPct - b.correctPct || b.attempts - a.attempts)
    .slice(0, 25);

  // ---- per-deck table
  const deckSessions = new Map<string, { n: number; parts: number; last: string | null }>();
  for (const s of ranSessions) {
    const did = s.deck_id as string;
    const cur = deckSessions.get(did) ?? { n: 0, parts: 0, last: null };
    cur.n += 1;
    cur.parts += participantsBySession.get(s.id as string) ?? 0;
    const at = (s.started_at ?? s.created_at) as string;
    if (!cur.last || at > cur.last) cur.last = at;
    deckSessions.set(did, cur);
  }
  const deckStats: DeckStat[] = (decks ?? [])
    .map((d) => {
      const ds = deckSessions.get(d.id as string);
      const dq = deckQuiz.get(d.id as string);
      return {
        id: d.id as string,
        title: (d.title as string) || 'Untitled deck',
        sessions: ds?.n ?? 0,
        participants: ds?.parts ?? 0,
        quizAttempts: dq?.attempts ?? 0,
        correctPct: dq && dq.attempts > 0 ? Math.round((dq.correct / dq.attempts) * 100) : null,
        lastRunAt: ds?.last ?? null,
      };
    })
    .filter((d) => d.sessions > 0)
    .sort((a, b) => (b.lastRunAt ?? '').localeCompare(a.lastRunAt ?? ''));

  // ---- learner progress across sessions (device_key = stable per device;
  //      nickname shown is the most recent one that device used)
  interface LearnerAgg {
    nickname: string;
    lastSeenAt: string;
    sessions: Set<string>;
    attempts: number;
    correct: number;
    progress: { at: string; pct: number }[];
  }
  const learners = new Map<string, LearnerAgg>();
  const sortedParts = [...(participants ?? [])].sort((a, b) =>
    ((a.joined_at as string) ?? '').localeCompare((b.joined_at as string) ?? ''),
  );
  for (const p of sortedParts) {
    const dk = p.device_key as string;
    const sid = p.session_id as string;
    const at = (p.joined_at as string) ?? new Date().toISOString();
    const cur = learners.get(dk) ?? {
      nickname: '',
      lastSeenAt: at,
      sessions: new Set<string>(),
      attempts: 0,
      correct: 0,
      progress: [],
    };
    cur.sessions.add(sid);
    cur.lastSeenAt = at;
    if (p.nickname) cur.nickname = p.nickname as string;
    const pp = perPart.get(p.id as string);
    if (pp && pp.attempts > 0) {
      cur.attempts += pp.attempts;
      cur.correct += pp.correct;
      const sess = sessionById.get(sid);
      cur.progress.push({
        at: ((sess?.started_at ?? sess?.created_at) as string) ?? at,
        pct: Math.round((pp.correct / pp.attempts) * 100),
      });
    }
    learners.set(dk, cur);
  }
  const learnerRows: LearnerRow[] = [...learners.values()]
    .filter((l) => l.sessions.size >= 2) // "progress over time" needs a repeat visit
    .map((l) => ({
      nickname: l.nickname || 'Anonymous',
      sessions: l.sessions.size,
      quizAttempts: l.attempts,
      correctPct: l.attempts > 0 ? Math.round((l.correct / l.attempts) * 100) : null,
      lastSeenAt: l.lastSeenAt,
      progress: l.progress.sort((a, b) => a.at.localeCompare(b.at)).slice(-12),
    }))
    .sort((a, b) => b.sessions - a.sessions || (b.correctPct ?? -1) - (a.correctPct ?? -1))
    .slice(0, 20);

  const totalParticipants = (participants ?? []).length;
  const returning = [...learners.values()].filter((l) => l.sessions.size >= 2).length;

  return Response.json({
    totals: {
      decks: deckIds.length,
      sessions: ranSessions.length,
      participants: totalParticipants,
      responses: (responses ?? []).length,
      returningLearners: returning,
      lastSessionAt:
        ranSessions.length > 0
          ? ((ranSessions[ranSessions.length - 1].started_at ??
              ranSessions[ranSessions.length - 1].created_at) as string)
          : null,
    },
    trend: [...buckets.values()],
    decks: deckStats,
    difficulty,
    learners: learnerRows,
  });
}
