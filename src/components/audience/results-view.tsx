'use client';
// Live results ON THE PHONE. The stage rebroadcasts aggregated results on the
// session channel (throttled); the audience app consumes them and renders a
// compact, per-kind view with the participant's own answer highlighted — so
// people don't have to squint at the projector to see how the room voted.

import type { Phase, Slide, Results } from '@/lib/types';
import { loadAnswer } from './use-submit';
import { chartVar, letterFor, ShieldIcon } from './bits';

/** Read this participant's stored answer payload for the slide (or null). */
function myPayload(sessionId: string, slideId: string): Record<string, unknown> | null {
  const a = loadAnswer<Record<string, unknown>>(sessionId, slideId);
  return a?.payload ?? null;
}

function ResultsHeader({ total, anon }: { total: number; anon: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fg-dim">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
        </span>
        Live results
      </span>
      <span className="flex items-center gap-2 text-xs font-medium text-fg-dim">
        {anon && (
          <span className="inline-flex items-center gap-1">
            <ShieldIcon className="text-cyan" /> Anonymous
          </span>
        )}
        · {total} {total === 1 ? 'response' : 'responses'}
      </span>
    </div>
  );
}

function Bar({
  label,
  index,
  pct,
  mine,
}: {
  label: string;
  index: number;
  pct: number;
  mine: boolean;
}) {
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className={`font-semibold ${mine ? 'text-cyan' : 'text-fg'}`}>
          <span className="mr-1.5 font-mono text-xs text-fg-dim">{letterFor(index)}</span>
          {label}
          {mine && <span className="ml-1.5 text-xs font-bold text-cyan">· you</span>}
        </span>
        <span className="tabular-nums font-semibold text-fg-dim">{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: mine ? 'var(--color-cyan)' : chartVar(index) }}
        />
      </div>
    </div>
  );
}

/**
 * Decide whether results should show for this participant right now, and render
 * them. Returns null (nothing) when it shouldn't. Rules:
 *  - quiz: only at 'reveal' (never spoil the answer).
 *  - everything else: at 'reveal'/'closed', or while 'open' once you've answered
 *    AND the presenter allows live results (settings.showResultsLive !== false).
 */
export function PhoneResults({
  slide,
  phase,
  results,
  sessionId,
}: {
  slide: Slide;
  phase: Phase;
  results: Results | null;
  sessionId: string;
}) {
  if (!results || results.total === 0) return null;

  const answered = myPayload(sessionId, slide.id) !== null;
  const liveOk = slide.settings.showResultsLive !== false;
  const revealed = phase === 'reveal' || phase === 'closed';

  if (slide.kind === 'quiz') {
    if (phase !== 'reveal') return null;
  } else if (!revealed && !(phase === 'open' && answered && liveOk)) {
    return null;
  }

  const mine = myPayload(sessionId, slide.id);
  const anon = slide.kind !== 'quiz';

  return (
    <section
      aria-label="Live results"
      className="mt-6 rounded-2xl border border-edge bg-panel/70 p-4 shadow-soft"
    >
      <ResultsHeader total={results.total} anon={anon} />
      <PhoneResultsBody slide={slide} results={results} mine={mine} />
    </section>
  );
}

function PhoneResultsBody({
  slide,
  results,
  mine,
}: {
  slide: Slide;
  results: Results;
  mine: Record<string, unknown> | null;
}) {
  const total = results.total || 1;

  // ----- choice-style: poll / quiz -----
  if (results.kind === 'poll' || results.kind === 'quiz') {
    const options = slide.body.options ?? [];
    const myChoices = new Set<number>(
      mine && Array.isArray(mine.choices)
        ? (mine.choices as number[])
        : mine && typeof mine.choice === 'number'
          ? [mine.choice as number]
          : [],
    );
    const correct = new Set<number>(slide.body.correct ?? []);
    return (
      <div>
        {options.map((label, i) => {
          const c = results.counts[String(i)] ?? 0;
          const pct = Math.round((c / total) * 100);
          const isCorrect = results.kind === 'quiz' && correct.has(i);
          return (
            <Bar
              key={i}
              index={i}
              label={isCorrect ? `${label}  ✓` : label}
              pct={pct}
              mine={myChoices.has(i)}
            />
          );
        })}
      </div>
    );
  }

  // ----- wordcloud -----
  if (results.kind === 'wordcloud') {
    const myWords = new Set<string>(
      (Array.isArray(mine?.words) ? (mine!.words as string[]) : []).map((w) =>
        String(w).toLowerCase().trim(),
      ),
    );
    const entries = Object.entries(results.words).sort((a, b) => b[1] - a[1]).slice(0, 24);
    const max = entries[0]?.[1] ?? 1;
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {entries.map(([word, n]) => {
          const size = 0.9 + (n / max) * 0.9; // rem
          const isMine = myWords.has(word.toLowerCase());
          return (
            <span
              key={word}
              className={`font-bold leading-tight ${isMine ? 'text-cyan' : 'text-fg'}`}
              style={{ fontSize: `${size}rem`, opacity: 0.55 + (n / max) * 0.45 }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // ----- scale -----
  if (results.kind === 'scale') {
    const min = slide.body.min ?? 1;
    const max = slide.body.max ?? 5;
    const myVal = typeof mine?.value === 'number' ? (mine.value as number) : null;
    return (
      <div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-extrabold tabular-nums text-accent">{results.avg}</span>
          <span className="mb-1 text-sm font-medium text-fg-dim">
            average ({min}–{max})
          </span>
        </div>
        {myVal !== null && (
          <p className="mt-1 text-sm font-semibold text-cyan">Your answer: {myVal}</p>
        )}
      </div>
    );
  }

  // ----- open_text -----
  if (results.kind === 'open_text') {
    return (
      <div className="flex flex-col gap-2">
        {results.entries.slice(0, 5).map((e, i) => (
          <blockquote
            key={i}
            className="rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm text-fg"
          >
            “{e.text}”
          </blockquote>
        ))}
        {results.entries.length > 5 && (
          <p className="text-xs text-fg-dim">+ {results.entries.length - 5} more on the big screen</p>
        )}
      </div>
    );
  }

  // ----- ranking (aggregate not shown per-item on phone) -----
  return <p className="text-sm text-fg-dim">{results.total} people have ranked — see the big screen.</p>;
}
