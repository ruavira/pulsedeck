'use client';
// Quiz: get-ready → tap once (LOCKED, no changes) → reveal with correct/incorrect,
// points, and personal rank. Countdown ring is display-only — scoring is 100%
// server-side from phase_opened_at.

import { useEffect, useRef, useState } from 'react';
import type { Phase, Slide } from '@/lib/types';
import { rpc } from '@/lib/supabase/client';
import { Card, Spinner } from '@/components/shared/ui';
import {
  CheckMark,
  letterFor,
  OptionRow,
  prefersReducedMotion,
  Prompt,
  StatusNote,
  SubmitErrorNote,
} from './bits';
import { useSubmitResponse } from './use-submit';
import type { AudienceCtx } from './activity';

type QuizPayload = { choice: number };

function useRemainingMs(phaseOpenedAt: string | null | undefined, timeLimitSec: number) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!phaseOpenedAt) {
      setRemaining(null);
      return;
    }
    const endsAt = Date.parse(phaseOpenedAt) + timeLimitSec * 1000;
    if (Number.isNaN(endsAt)) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phaseOpenedAt, timeLimitSec]);
  return remaining;
}

function CountdownRing({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const frac = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const secs = Math.ceil(remainingMs / 1000);
  const low = secs <= 5;
  return (
    <div className="relative h-16 w-16 shrink-0" role="timer" aria-label={`${secs} seconds left`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={R} fill="none" strokeWidth="5" className="stroke-edge" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          className={low ? 'stroke-amber' : 'stroke-cyan'}
        />
      </svg>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center font-mono text-xl font-bold ${
          low ? 'text-amber' : 'text-fg'
        }`}
      >
        {secs}
      </span>
    </div>
  );
}

/**
 * "+N pts" pill for the reveal: counts 0 → points over ~700ms with a one-shot
 * scale-pop. Reduced motion (or old browsers) = final value instantly, no pop.
 * The animating digits are aria-hidden; screen readers get one static line.
 */
function ScorePop({ points }: { points: number }) {
  const [shown, setShown] = useState<number>(() => (prefersReducedMotion() ? points : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(points);
      return;
    }
    const DURATION = 700;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setShown(Math.round(points * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [points]);

  return (
    <>
      <style>{`
        @keyframes pd-pop {
          0% { transform: scale(0.55); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pd-score-pop { animation: pd-pop 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .pd-score-pop { animation: none; }
        }
      `}</style>
      <span className="pd-score-pop inline-flex min-h-[2.25rem] items-center rounded-full border border-emerald/50 bg-emerald/20 px-4 py-1.5 font-mono text-lg font-bold text-emerald tabular-nums">
        <span aria-hidden="true">+{shown.toLocaleString()} pts</span>
        <span className="sr-only">plus {points.toLocaleString()} points</span>
      </span>
    </>
  );
}

export function QuizView({
  slide,
  phase,
  phaseOpenedAt,
  ctx,
  onQuizResult,
}: {
  slide: Slide;
  phase: Phase;
  phaseOpenedAt: string | null | undefined;
  ctx: AudienceCtx;
  onQuizResult: (points: number, correct: boolean) => void;
}) {
  const options = slide.body.options ?? [];
  const correctIdx = slide.body.correct ?? [];
  const prompt = slide.body.prompt || slide.title || 'Quiz time';
  const timeLimitSec = slide.settings.timeLimitSec ?? 30;

  const { status, errorCode, answer, submit, retry, markCounted, clearError } =
    useSubmitResponse<QuizPayload>({
      sessionId: ctx.sessionId,
      slideId: slide.id,
      participantId: ctx.participantId,
      deviceKey: ctx.deviceKey,
      onStale: ctx.resync,
    });

  const remainingMs = useRemainingMs(phase === 'open' ? phaseOpenedAt : null, timeLimitSec);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const sending = status === 'sending';
  const locked = answer !== null; // one answer per quiz — no changes

  useEffect(() => {
    if (status !== 'sending') setPendingIdx(null);
  }, [status]);

  // On reveal, feed points/streak into the running score header exactly once.
  const countedRef = useRef(false);
  useEffect(() => {
    if (phase !== 'reveal' || !answer || answer.counted || countedRef.current) return;
    countedRef.current = true;
    onQuizResult(answer.result.points ?? 0, answer.result.isCorrect === true);
    markCounted();
  }, [phase, answer, markCounted, onQuizResult]);

  // Personal rank, fetched at reveal.
  const [rank, setRank] = useState<{ rank: number; total: number } | null>(null);
  const [rankErr, setRankErr] = useState(false);
  useEffect(() => {
    if (phase !== 'reveal') return;
    let stop = false;
    (async () => {
      try {
        const [mine, total] = await Promise.all([
          rpc<{ rank: number; score: number } | null>('get_my_rank', {
            p_session_id: ctx.sessionId,
            p_participant_id: ctx.participantId,
          }),
          rpc<number>('get_participant_count', { p_session_id: ctx.sessionId }),
        ]);
        if (!stop && mine && typeof mine.rank === 'number') {
          setRank({ rank: mine.rank, total: total ?? 0 });
        }
      } catch {
        if (!stop) setRankErr(true);
      }
    })();
    return () => {
      stop = true;
    };
  }, [phase, ctx.sessionId, ctx.participantId]);

  // ---------- phase: show — get ready ----------
  if (phase === 'show') {
    return (
      <section className="flex flex-1 flex-col items-center justify-center py-14 text-center">
        <span className="relative mb-7 flex h-4 w-4" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-60" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-cyan" />
        </span>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-dim">Quiz</p>
        <h1 className="text-3xl font-bold text-fg" role="status" aria-live="polite">
          Get ready…
        </h1>
        <p className="mt-3 text-sm text-fg-dim">Fingers on the screen. It&apos;s about to start.</p>
      </section>
    );
  }

  const chosen = answer?.payload.choice ?? null;
  const timeUp = remainingMs !== null && remainingMs <= 0;

  // ---------- phase: reveal ----------
  if (phase === 'reveal') {
    const isCorrect = answer?.result.isCorrect === true;
    const points = answer?.result.points ?? 0;
    const correctText = correctIdx
      .map((i) => (options[i] !== undefined ? `${letterFor(i)} — ${options[i]}` : null))
      .filter(Boolean)
      .join(', ');
    return (
      <section>
        <Prompt kindLabel="Quiz · results" text={prompt} />
        {answer ? (
          isCorrect ? (
            <Card
              role="status"
              aria-live="polite"
              className="border-emerald bg-emerald/15 px-5 py-6 text-center"
            >
              <p className="text-2xl font-bold text-emerald">Correct!</p>
              {points > 0 && (
                <div className="mt-3">
                  <ScorePop points={points} />
                </div>
              )}
              <p className="mt-2 text-sm text-fg-dim">
                You picked {chosen !== null ? letterFor(chosen) : ''} —{' '}
                {chosen !== null ? options[chosen] : ''}
              </p>
            </Card>
          ) : (
            <Card
              role="status"
              aria-live="polite"
              className="border-red/50 bg-red/10 px-5 py-6 text-center"
            >
              <p className="text-2xl font-bold text-fg">Not quite</p>
              <p className="mt-2 text-sm text-fg-dim">
                {correctText ? `Right answer: ${correctText}` : 'Better luck on the next one.'}
              </p>
            </Card>
          )
        ) : (
          <Card role="status" aria-live="polite" className="px-5 py-6 text-center">
            <p className="text-xl font-bold text-fg">No answer this round</p>
            <p className="mt-2 text-sm text-fg-dim">
              {correctText ? `Right answer: ${correctText}` : 'Jump back in on the next question.'}
            </p>
          </Card>
        )}
        <div className="mt-4 text-center" aria-live="polite">
          {rank ? (
            <p className="text-lg font-semibold text-fg">
              You&apos;re <span className="text-cyan">#{rank.rank}</span>
              {rank.total > 0 && <span className="text-fg-dim"> of {rank.total}</span>}
            </p>
          ) : rankErr ? (
            <p className="text-sm text-fg-dim">Couldn&apos;t load your rank — it&apos;s on the big screen.</p>
          ) : (
            <p className="text-sm text-fg-dim inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Fetching your rank…
            </p>
          )}
        </div>
      </section>
    );
  }

  // ---------- phase: open / closed ----------
  return (
    <section>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-fg-dim">Quiz</p>
          <h1 className="text-xl font-bold leading-snug text-fg">{prompt}</h1>
        </div>
        {phase === 'open' && remainingMs !== null && !locked && (
          <CountdownRing remainingMs={remainingMs} totalMs={timeLimitSec * 1000} />
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {options.map((label, i) => (
          <OptionRow
            key={i}
            index={i}
            label={label}
            image={slide.body.optionImages?.[i]}
            selected={chosen === i}
            pending={pendingIdx === i && sending}
            disabled={phase !== 'open' || locked || sending || timeUp}
            onClick={() => {
              if (phase !== 'open' || locked || sending || timeUp) return;
              clearError();
              setPendingIdx(i);
              void submit({ choice: i });
            }}
            trailing={chosen === i ? <CheckMark className="text-accent" /> : undefined}
          />
        ))}
      </div>

      <div className="mt-4">
        {phase === 'open' && locked && (
          <StatusNote tone="ok">Answer locked in ✓ Results coming up…</StatusNote>
        )}
        {phase === 'open' && !locked && timeUp && (
          <StatusNote tone="warn">Time&apos;s up — watch the reveal on the big screen.</StatusNote>
        )}
        {phase === 'open' && !locked && !timeUp && (
          <StatusNote>One tap locks your answer — choose carefully.</StatusNote>
        )}
        {phase === 'closed' && (
          <StatusNote>
            {locked ? 'Answer locked in ✓ Waiting for the reveal…' : 'Voting closed for this question.'}
          </StatusNote>
        )}
      </div>

      <SubmitErrorNote code={errorCode} onRetry={retry} />
    </section>
  );
}
