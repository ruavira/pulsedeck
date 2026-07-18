// LMS bridge (phase 1): signed results webhook. When a session ends (or the
// presenter pushes manually from the report), PulseDeck POSTs a results +
// completion payload to the deck's configured LMS endpoint, signed with
// HMAC-SHA256 so the receiver (Moodle local plugin, middleware, LMS webhook
// consumer) can verify authenticity. Phase 2 (full LTI 1.3 launch + AGS
// gradebook writeback) builds on the same payload shape — see docs/LMS_BRIDGE.md.
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Slide } from '@/lib/types';

export interface LmsConfig {
  url?: string;
  secret?: string;
  autoPush?: boolean;
}

export interface LmsDelivery {
  at: string;
  ok: boolean;
  status: number | null;
  trigger: 'session_end' | 'manual' | 'test';
  error?: string;
}

export function parseLmsConfig(raw: unknown): LmsConfig {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    url: typeof o.url === 'string' ? o.url : undefined,
    secret: typeof o.secret === 'string' ? o.secret : undefined,
    autoPush: o.autoPush !== false, // default on once a URL is configured
  };
}

/** Only https endpoints (or localhost for development) may receive results. */
export function isValidLmsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function signLmsBody(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Constant-time verify helper (exported for the docs' reference receiver + tests). */
export function verifyLmsSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = Buffer.from(signLmsBody(secret, timestamp, body), 'hex');
  const got = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  return expected.length === got.length && timingSafeEqual(expected, got);
}

interface QuizItem {
  slideId: string;
  question: string;
  attempts: number;
  correct: number;
  correctPct: number;
}

interface ParticipantResult {
  nickname: string;
  score: number;
  bestStreak: number;
  quizAttempts: number;
  quizCorrect: number;
  /** 0..1 share of interactive slides this participant responded to. */
  completion: number;
}

export interface LmsPayload {
  event: 'session.results';
  sentAt: string;
  session: {
    id: string;
    code: string;
    deckId: string;
    deckTitle: string;
    startedAt: string | null;
    endedAt: string | null;
    participantCount: number;
    interactiveSlides: number;
    quizSlides: number;
  };
  participants: ParticipantResult[];
  quizItems: QuizItem[];
}

const INTERACTIVE_KINDS = new Set(['poll', 'quiz', 'wordcloud', 'scale', 'ranking', 'open_text']);

/** Build the webhook payload for a session (admin client; caller authorizes). */
export async function buildLmsPayload(
  admin: SupabaseClient,
  sessionId: string,
): Promise<LmsPayload | null> {
  const { data: session } = await admin
    .from('sessions')
    .select('id, code, deck_id, started_at, ended_at, deck_snapshot')
    .eq('id', sessionId)
    .single();
  if (!session) return null;

  const { data: deck } = await admin
    .from('decks')
    .select('title')
    .eq('id', session.deck_id)
    .single();

  const slides: Slide[] =
    ((session.deck_snapshot as { slides?: Slide[] } | null)?.slides ?? []).filter(Boolean);
  const interactive = slides.filter((s) => INTERACTIVE_KINDS.has(s.kind));
  const quizSlides = slides.filter((s) => s.kind === 'quiz');
  const slideTitle = new Map(slides.map((s) => [s.id, s.title || '(untitled)']));
  const quizIds = new Set(quizSlides.map((s) => s.id));

  const [{ data: participants }, { data: responses }] = await Promise.all([
    admin
      .from('participants')
      .select('id, nickname, score, streak')
      .eq('session_id', sessionId),
    admin
      .from('responses')
      .select('participant_id, slide_id, is_correct')
      .eq('session_id', sessionId),
  ]);

  const perPart = new Map<string, { responded: Set<string>; qa: number; qc: number }>();
  const perQuiz = new Map<string, { attempts: number; correct: number }>();
  for (const r of responses ?? []) {
    const pid = r.participant_id as string;
    const sid = r.slide_id as string;
    const pp = perPart.get(pid) ?? { responded: new Set<string>(), qa: 0, qc: 0 };
    pp.responded.add(sid);
    if (quizIds.has(sid)) {
      pp.qa += 1;
      if (r.is_correct === true) pp.qc += 1;
      const q = perQuiz.get(sid) ?? { attempts: 0, correct: 0 };
      q.attempts += 1;
      if (r.is_correct === true) q.correct += 1;
      perQuiz.set(sid, q);
    }
    perPart.set(pid, pp);
  }

  const nInteractive = Math.max(1, interactive.length);
  const participantResults: ParticipantResult[] = (participants ?? [])
    .map((p) => {
      const pp = perPart.get(p.id as string);
      return {
        nickname: (p.nickname as string) || 'Anonymous',
        score: (p.score as number) ?? 0,
        bestStreak: (p.streak as number) ?? 0,
        quizAttempts: pp?.qa ?? 0,
        quizCorrect: pp?.qc ?? 0,
        completion: Math.round(((pp?.responded.size ?? 0) / nInteractive) * 100) / 100,
      };
    })
    .sort((a, b) => b.score - a.score);

  const quizItems: QuizItem[] = quizSlides.map((s) => {
    const q = perQuiz.get(s.id) ?? { attempts: 0, correct: 0 };
    return {
      slideId: s.id,
      question: slideTitle.get(s.id) ?? '(untitled)',
      attempts: q.attempts,
      correct: q.correct,
      correctPct: q.attempts > 0 ? Math.round((q.correct / q.attempts) * 100) : 0,
    };
  });

  return {
    event: 'session.results',
    sentAt: new Date().toISOString(),
    session: {
      id: session.id as string,
      code: session.code as string,
      deckId: session.deck_id as string,
      deckTitle: (deck?.title as string) || 'Untitled deck',
      startedAt: (session.started_at as string) ?? null,
      endedAt: (session.ended_at as string) ?? null,
      participantCount: (participants ?? []).length,
      interactiveSlides: interactive.length,
      quizSlides: quizSlides.length,
    },
    participants: participantResults,
    quizItems,
  };
}

/** Deliver a signed payload to a configured endpoint. Never throws. */
export async function deliverLmsWebhook(
  config: LmsConfig,
  payload: LmsPayload | { event: 'test'; sentAt: string; message: string },
  trigger: LmsDelivery['trigger'],
): Promise<LmsDelivery> {
  const at = new Date().toISOString();
  if (!config.url || !isValidLmsUrl(config.url) || !config.secret) {
    return { at, ok: false, status: null, trigger, error: 'not_configured' };
  }
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = signLmsBody(config.secret, timestamp, body);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'PulseDeck-LMS-Bridge/1',
        'x-pulsedeck-event': payload.event,
        'x-pulsedeck-timestamp': timestamp,
        'x-pulsedeck-signature': `sha256=${signature}`,
      },
      body,
      signal: ctrl.signal,
      redirect: 'error',
    });
    clearTimeout(timer);
    return { at, ok: res.ok, status: res.status, trigger };
  } catch (e) {
    return {
      at,
      ok: false,
      status: null,
      trigger,
      error: e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network',
    };
  }
}

/** End-to-end push for a session; records the delivery on session.settings. */
export async function pushSessionToLms(
  admin: SupabaseClient,
  sessionId: string,
  trigger: LmsDelivery['trigger'],
): Promise<LmsDelivery> {
  const at = new Date().toISOString();
  const { data: session } = await admin
    .from('sessions')
    .select('deck_id, settings')
    .eq('id', sessionId)
    .single();
  if (!session) return { at, ok: false, status: null, trigger, error: 'not_found' };

  const { data: deck } = await admin
    .from('decks')
    .select('lms')
    .eq('id', session.deck_id)
    .single();
  const config = parseLmsConfig(deck?.lms);
  if (!config.url) return { at, ok: false, status: null, trigger, error: 'not_configured' };

  const payload = await buildLmsPayload(admin, sessionId);
  if (!payload) return { at, ok: false, status: null, trigger, error: 'not_found' };

  const delivery = await deliverLmsWebhook(config, payload, trigger);

  // Best-effort delivery record for the report page (never blocks the result).
  try {
    const settings = (session.settings as Record<string, unknown> | null) ?? {};
    await admin
      .from('sessions')
      .update({ settings: { ...settings, lmsDelivery: delivery } })
      .eq('id', sessionId);
  } catch {
    /* recording is best-effort */
  }
  return delivery;
}
