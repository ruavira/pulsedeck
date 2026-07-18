'use client';
// Q&A moderation from the pocket. Lists visible + answered questions via the
// get_questions RPC (refetched on `qa` broadcast nudges and every ~8s), with
// optimistic mark-answered / restore / archive via POST /api/presenter/.../qa.
//
// KNOWN GAP (flagged upstream): get_questions only returns 'visible' and
// 'answered' questions, so when moderation is ON the pending approval queue is
// not reachable from the remote yet. A note card explains this to the presenter.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Pill, Spinner } from '@/components/shared/ui';
import { rpc } from '@/lib/supabase/client';
import { presenterPost } from '@/lib/presenter-api';
import type { QaQuestion } from '@/lib/types';

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ModActionButton({
  label,
  emphasis,
  disabled,
  onClick,
}: {
  label: string;
  emphasis?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[48px] flex-1 rounded-xl border px-3 text-sm font-semibold transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 ${
        emphasis
          ? 'border-emerald/50 bg-emerald/15 text-emerald hover:bg-emerald/25'
          : 'border-edge bg-panel-2 text-fg-dim hover:text-fg hover:border-accent/60'
      }`}
    >
      {label}
    </button>
  );
}

export function QaTab({
  sessionId,
  presenterKey,
  bumpSignal,
  moderated,
}: {
  sessionId: string;
  presenterKey: string;
  bumpSignal: number;
  moderated: boolean;
}) {
  const [questions, setQuestions] = useState<QaQuestion[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const fetchQuestions = useCallback(async () => {
    try {
      const qs = await rpc<QaQuestion[]>('get_questions', {
        p_session_id: sessionId,
        p_participant_id: null,
      });
      setQuestions(Array.isArray(qs) ? qs : []);
      setLoadFailed(false);
    } catch {
      // only surface as an error if we never loaded anything
      if (questionsRef.current === null) setLoadFailed(true);
    }
  }, [sessionId]);

  // Load on mount, on qa-broadcast nudges, and every ~8s (jittered).
  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions, bumpSignal]);

  useEffect(() => {
    const id = setInterval(() => void fetchQuestions(), 8000 + Math.random() * 1500);
    return () => clearInterval(id);
  }, [fetchQuestions]);

  const moderate = useCallback(
    async (question: QaQuestion, status: QaQuestion['status']) => {
      const before = questionsRef.current;
      setActingOn(question.id);
      // optimistic: archived items vanish, others switch status in place
      setQuestions((qs) =>
        qs
          ?.map((q) => (q.id === question.id ? { ...q, status } : q))
          .filter((q) => q.status !== 'archived') ?? qs,
      );
      try {
        await presenterPost(`/api/presenter/${sessionId}/qa`, presenterKey, {
          questionId: question.id,
          status,
        });
      } catch {
        setQuestions(before ?? null); // revert; broadcast/poll will re-heal
      } finally {
        setActingOn(null);
      }
    },
    [sessionId, presenterKey],
  );

  // ----- loading / error / empty states -----
  if (questions === null && loadFailed) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-red" role="alert">
          Couldn&apos;t load questions.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadFailed(false);
            void fetchQuestions();
          }}
          className="min-h-[44px] rounded-full border border-edge bg-panel-2 px-5 text-sm font-semibold text-fg hover:border-accent/60"
        >
          Try again
        </button>
      </Card>
    );
  }
  if (questions === null) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-fg-dim">
        <Spinner /> <span className="text-sm">Loading questions…</span>
      </div>
    );
  }

  const live = questions.filter((q) => q.status === 'visible');
  const answered = questions.filter((q) => q.status === 'answered');

  return (
    <div className="flex flex-col gap-4">
      {moderated && (
        <Card className="border-amber/40 p-3.5">
          <p className="text-sm font-semibold text-fg">Moderation is on</p>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-dim">
            New questions wait in a pending queue before appearing here. The pending
            queue isn&apos;t available on the remote yet — approve from the studio, or
            turn moderation off in the panic controls.
          </p>
        </Card>
      )}

      {live.length === 0 && answered.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-2xl" aria-hidden="true">
            💬
          </p>
          <p className="mt-2 text-sm font-semibold text-fg">No questions yet</p>
          <p className="mt-1 text-sm text-fg-dim">
            Audience questions land here the moment they&apos;re asked.
          </p>
        </Card>
      )}

      {live.length > 0 && (
        <section aria-label="Live questions" className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-fg-dim">
            On the wall · {live.length}
          </h2>
          {live.map((q) => (
            <Card key={q.id} className="p-3.5">
              <p className="text-[15px] leading-snug text-fg">{q.text}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-fg-dim">
                <span className="font-semibold text-fg-dim">{q.author}</span>
                <span aria-hidden="true">·</span>
                <span>{timeAgo(q.createdAt)}</span>
                <Pill tone="accent" className="ml-auto">
                  ▲ {q.upvotes}
                </Pill>
              </div>
              <div className="mt-3 flex gap-2">
                <ModActionButton
                  label="✓ Mark answered"
                  emphasis
                  disabled={actingOn !== null}
                  onClick={() => void moderate(q, 'answered')}
                />
                <ModActionButton
                  label="Archive"
                  disabled={actingOn !== null}
                  onClick={() => void moderate(q, 'archived')}
                />
              </div>
            </Card>
          ))}
        </section>
      )}

      {answered.length > 0 && (
        <section aria-label="Answered questions" className="flex flex-col gap-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-fg-dim">
            Answered · {answered.length}
          </h2>
          {answered.map((q) => (
            <Card key={q.id} className="p-3.5 opacity-80">
              <p className="text-[15px] leading-snug text-fg">{q.text}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-fg-dim">
                <span className="font-semibold">{q.author}</span>
                <span aria-hidden="true">·</span>
                <span>{timeAgo(q.createdAt)}</span>
                <Pill tone="dim" className="ml-auto">
                  Answered
                </Pill>
              </div>
              <div className="mt-3 flex gap-2">
                <ModActionButton
                  label="↩ Back to wall"
                  disabled={actingOn !== null}
                  onClick={() => void moderate(q, 'visible')}
                />
                <ModActionButton
                  label="Archive"
                  disabled={actingOn !== null}
                  onClick={() => void moderate(q, 'archived')}
                />
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
