'use client';
// Shared Q&A engine: ask form (500 max, anonymous toggle) + question list with
// optimistic upvote hearts. Used by the ambient bottom sheet AND the qa slide.
// Refresh: on mount, on channel 'qa' bumps, and every ~8s (jittered) while active.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QaQuestion } from '@/lib/types';
import { rpc } from '@/lib/supabase/client';
import { Button, Pill, Spinner } from '@/components/shared/ui';
import { avatarFor, haptic } from './bits';

const MAX = 500;

interface AskResult {
  ok: boolean;
  error?: string;
  id?: string;
  status?: string;
}

interface UpvoteResult {
  ok: boolean;
  error?: string;
  upvoted?: boolean;
  upvotes?: number;
}

type Notice = { tone: 'ok' | 'warn' | 'err'; text: string } | null;

export function QaPanel({
  sessionId,
  participantId,
  deviceKey,
  qaBump,
  active,
  broadcast,
}: {
  sessionId: string;
  participantId: string;
  deviceKey: string;
  /** Channel 'qa' nudge counter — increments trigger a refetch. */
  qaBump: number;
  /** Only poll while visible (sheet open / qa slide showing). */
  active: boolean;
  broadcast: (event: string, payload: unknown) => void;
}) {
  const [questions, setQuestions] = useState<QaQuestion[] | null>(null);
  const [listError, setListError] = useState(false);
  const [pendingMine, setPendingMine] = useState<string[]>([]);

  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const activeRef = useRef(active);
  activeRef.current = active;

  const fetchQuestions = useCallback(async () => {
    try {
      const qs = await rpc<QaQuestion[]>('get_questions', {
        p_session_id: sessionId,
        p_participant_id: participantId,
      });
      setQuestions(qs ?? []);
      setListError(false);
    } catch {
      setListError(true);
    }
  }, [sessionId, participantId]);

  // Fetch on activation + jittered 8s polling while active.
  useEffect(() => {
    if (!active) return;
    void fetchQuestions();
    const id = setInterval(() => void fetchQuestions(), 8000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, [active, fetchQuestions]);

  // Channel nudges.
  useEffect(() => {
    if (qaBump > 0 && activeRef.current) void fetchQuestions();
  }, [qaBump, fetchQuestions]);

  const ask = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await rpc<AskResult>('submit_question', {
        p_session_id: sessionId,
        p_participant_id: participantId,
        p_device_key: deviceKey,
        p_text: trimmed,
        p_anonymous: anonymous,
      });
      if (!res.ok) {
        if (res.error === 'rate_limited') {
          setNotice({ tone: 'warn', text: 'Slow down a little — try again in a moment.' });
        } else if (res.error === 'filtered') {
          setNotice({
            tone: 'warn',
            text: "That question can't be shown as written — try rephrasing it.",
          });
        } else if (res.error === 'session_not_live') {
          setNotice({ tone: 'err', text: "The session isn't live right now." });
        } else {
          setNotice({ tone: 'err', text: "Couldn't send that — please try again." });
        }
        return;
      }
      setText('');
      if (res.status === 'pending') {
        setNotice({ tone: 'ok', text: 'Sent to the moderator — it appears once approved.' });
        setPendingMine((p) => [trimmed, ...p].slice(0, 5));
      } else {
        setNotice({ tone: 'ok', text: 'Question posted ✓' });
      }
      broadcast('qa', { bump: Date.now() });
      void fetchQuestions();
    } catch {
      setNotice({ tone: 'err', text: 'Connection problem — your question didn’t send. Try again.' });
    } finally {
      setSending(false);
    }
  };

  const upvote = async (q: QaQuestion) => {
    // Optimistic flip, reconcile with server, revert on failure.
    const flip = (list: QaQuestion[] | null, delta: number, upvoted: boolean) =>
      list?.map((x) =>
        x.id === q.id ? { ...x, upvotes: Math.max(0, x.upvotes + delta), upvotedByMe: upvoted } : x,
      ) ?? null;
    const wasUpvoted = Boolean(q.upvotedByMe);
    setQuestions((l) => flip(l, wasUpvoted ? -1 : 1, !wasUpvoted));
    try {
      const res = await rpc<UpvoteResult>('toggle_upvote', {
        p_question_id: q.id,
        p_participant_id: participantId,
        p_device_key: deviceKey,
      });
      if (res.ok && typeof res.upvotes === 'number') {
        haptic(15); // light tick on a confirmed upvote toggle (no-op on iOS)
        const count = res.upvotes;
        const upvoted = Boolean(res.upvoted);
        setQuestions(
          (l) => l?.map((x) => (x.id === q.id ? { ...x, upvotes: count, upvotedByMe: upvoted } : x)) ?? null,
        );
      } else if (!res.ok) {
        setQuestions((l) => flip(l, wasUpvoted ? 1 : -1, wasUpvoted));
      }
    } catch {
      setQuestions((l) => flip(l, wasUpvoted ? 1 : -1, wasUpvoted));
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Ask form */}
      <form
        className="shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <textarea
          value={text}
          maxLength={MAX}
          rows={2}
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask the presenter anything…"
          aria-label="Your question"
          className="w-full resize-none rounded-xl border border-edge bg-panel-2 px-4 py-3 text-[16px] text-fg placeholder:text-fg-dim/70 focus:border-accent focus:outline-none transition-colors"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-fg-dim">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-5 w-5 rounded accent-[var(--color-accent)]"
            />
            Ask anonymously
          </label>
          <span className="text-xs text-fg-dim tabular-nums">
            {text.length}/{MAX}
          </span>
          <Button type="submit" size="sm" disabled={!text.trim() || sending}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </form>

      {notice && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium ${
            notice.tone === 'ok'
              ? 'bg-emerald/15 text-emerald'
              : notice.tone === 'warn'
                ? 'bg-amber/15 text-amber'
                : 'bg-red/15 text-fg'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Question list */}
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {pendingMine.length > 0 && (
          <ul className="mb-3 flex flex-col gap-2">
            {pendingMine.map((t, i) => (
              <li
                key={`pending-${i}`}
                className="rounded-xl border border-dashed border-edge bg-panel px-4 py-3"
              >
                <p className="text-[15px] text-fg-dim">{t}</p>
                <Pill tone="dim" className="mt-2">
                  Pending review
                </Pill>
              </li>
            ))}
          </ul>
        )}

        {questions === null && !listError && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-dim">
            <Spinner /> Loading questions…
          </div>
        )}

        {listError && questions === null && (
          <div className="py-10 text-center">
            <p className="mb-3 text-sm text-fg-dim">Couldn&apos;t load questions.</p>
            <Button variant="secondary" size="sm" onClick={() => void fetchQuestions()}>
              Try again
            </Button>
          </div>
        )}

        {questions !== null && questions.length === 0 && pendingMine.length === 0 && (
          <p className="py-10 text-center text-sm text-fg-dim">
            No questions yet — ask the first one!
          </p>
        )}

        {questions !== null && questions.length > 0 && (
          <ul className="flex flex-col gap-2 pb-2">
            {questions.map((q) => (
              <li
                key={q.id}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  q.status === 'answered' ? 'border-emerald/40 bg-emerald/5' : 'border-edge bg-panel'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-relaxed text-fg">{q.text}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-dim">
                    <span>{q.author}</span>
                    {q.mine && (
                      <Pill tone="accent">
                        <span aria-hidden="true">{avatarFor(participantId)}</span> You
                      </Pill>
                    )}
                    {q.status === 'answered' && <Pill tone="dim">Answered ✓</Pill>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void upvote(q)}
                  aria-pressed={Boolean(q.upvotedByMe)}
                  aria-label={`${q.upvotedByMe ? 'Remove upvote from' : 'Upvote'} question: ${q.text.slice(0, 60)} — ${q.upvotes} ${q.upvotes === 1 ? 'upvote' : 'upvotes'}`}
                  className={`flex min-h-[44px] min-w-[44px] shrink-0 flex-col items-center justify-center rounded-xl border transition-colors duration-150 ${
                    q.upvotedByMe
                      ? 'border-accent/50 bg-accent-soft text-accent'
                      : 'border-edge bg-panel-2 text-fg-dim active:text-fg'
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {q.upvotedByMe ? '❤️' : '🤍'}
                  </span>
                  <span aria-hidden="true" className="mt-0.5 text-xs font-bold tabular-nums">
                    {q.upvotes}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
