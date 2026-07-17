'use client';
// Q&A wall on stage: upvote-sorted question cards, biggest at top, answered
// questions get an explicit check + label (never color-only). The stage fetches
// get_questions on load, on `qa` broadcast nudges (bumpSignal) and every ~8s.

import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase/client';
import type { QaQuestion } from '@/lib/types';
import { Spinner } from '@/components/shared/ui';
import { joinHost } from './join-qr';

function UpvoteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-[1em] w-[1em]" aria-hidden="true">
      <path d="M10 3l7 9h-4v5H7v-5H3l7-9z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[1em] w-[1em]" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QaWall({ sessionId, bumpSignal, code }: { sessionId: string; bumpSignal: number; code: string }) {
  const [questions, setQuestions] = useState<QaQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);

  // One effect covers initial load, qa-broadcast nudges (bumpSignal) and the
  // ~8s jittered background refresh.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const qs = await rpc<QaQuestion[]>('get_questions', {
          p_session_id: sessionId,
          p_participant_id: null,
        });
        if (stop) return;
        setQuestions(Array.isArray(qs) ? qs : []);
        setFailed(false);
      } catch {
        if (!stop) setFailed(true);
      }
    };
    void load();
    const id = setInterval(() => void load(), 8000 + Math.random() * 2000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [sessionId, bumpSignal]);

  if (questions === null) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-fg-dim">
        {failed ? (
          <p className="text-xl">Couldn&rsquo;t load questions — retrying…</p>
        ) : (
          <>
            <Spinner /> <span className="text-xl">Loading questions…</span>
          </>
        )}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="text-[clamp(1.5rem,3vw,2.5rem)] font-semibold text-fg">No questions yet</p>
        <p className="text-[clamp(1.1rem,2vw,1.6rem)] text-fg-dim">
          Ask one at <span className="font-semibold text-fg">{joinHost()}/j</span> with code{' '}
          <span className="font-mono font-bold tracking-[0.2em] text-cyan">{code}</span>
        </p>
      </div>
    );
  }

  const [top, ...rest] = questions;

  return (
    <div className="flex h-full flex-col gap-5 overflow-hidden" aria-live="polite" aria-atomic="false">
      {failed && <p className="sr-only">Connection hiccup — showing last known questions</p>}

      <QaCard q={top} big />

      {rest.length > 0 && (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
          {rest.slice(0, 6).map((q) => (
            <QaCard key={q.id} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function QaCard({ q, big = false }: { q: QaQuestion; big?: boolean }) {
  const answered = q.status === 'answered';
  return (
    <div
      className={`flex items-start gap-5 rounded-2xl border bg-panel px-6 ${
        big ? 'border-accent/50 py-6' : 'border-edge py-4'
      } ${answered ? 'opacity-60' : ''}`}
    >
      <div
        className={`flex shrink-0 flex-col items-center rounded-xl bg-panel-2 px-3 py-2 font-mono font-bold tabular-nums text-accent ${
          big ? 'text-3xl' : 'text-xl'
        }`}
        aria-label={`${q.upvotes} upvotes`}
      >
        <UpvoteIcon />
        {q.upvotes}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-semibold leading-snug text-fg [overflow-wrap:anywhere] ${
            big ? 'text-[clamp(1.6rem,3vw,2.6rem)]' : 'text-[clamp(1.1rem,1.7vw,1.5rem)]'
          }`}
        >
          {q.text}
        </p>
        <div className="mt-2 flex items-center gap-3 text-fg-dim">
          <span className={big ? 'text-lg' : 'text-sm'}>{q.author}</span>
          {answered && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border border-emerald/50 px-2.5 py-0.5 font-semibold text-emerald ${
                big ? 'text-base' : 'text-xs'
              }`}
            >
              <CheckIcon /> Answered
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
