'use client';
// Ranking: tap options in preference order to build a numbered list. Tapping a
// ranked option removes it (undo). Submit unlocks once everything is ranked.

import { useEffect, useState } from 'react';
import type { Phase, Slide } from '@/lib/types';
import { Button } from '@/components/shared/ui';
import { AnonNote, chartVar, letterFor, Prompt, StatusNote, SubmitErrorNote } from './bits';
import { useSubmitResponse } from './use-submit';
import type { AudienceCtx } from './activity';

type RankingPayload = { ranking: number[] };

export function RankingView({
  slide,
  phase,
  ctx,
}: {
  slide: Slide;
  phase: Phase;
  ctx: AudienceCtx;
}) {
  const options = slide.body.options ?? [];
  const prompt = slide.body.prompt || slide.title || 'Rank these';

  const { status, errorCode, answer, submit, retry, clearError } =
    useSubmitResponse<RankingPayload>({
      sessionId: ctx.sessionId,
      slideId: slide.id,
      participantId: ctx.participantId,
      deviceKey: ctx.deviceKey,
      onStale: ctx.resync,
    });

  const [ranking, setRanking] = useState<number[]>([]);
  const [editing, setEditing] = useState(true);

  // Restore a previous submission.
  useEffect(() => {
    if (answer) {
      setRanking((prev) => (prev.length ? prev : answer.payload.ranking));
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer === null]);

  if (options.length === 0) {
    return (
      <section>
        <Prompt kindLabel="Ranking" text={prompt} />
        <StatusNote>Nothing to rank yet — watch the big screen.</StatusNote>
      </section>
    );
  }

  const open = phase === 'open';
  const sending = status === 'sending';
  const interactive = open && (editing || !answer) && !sending;
  const allRanked = ranking.length === options.length;

  const toggle = (i: number) => {
    if (!interactive) return;
    clearError();
    setRanking((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  const doSubmit = () => {
    if (!allRanked || sending) return;
    clearError();
    void submit({ ranking }).then((res) => {
      if (res?.ok) setEditing(false);
    });
  };

  return (
    <section>
      <Prompt kindLabel="Ranking · tap in order of preference" text={prompt} />

      <div className="flex flex-col gap-2.5" role="group" aria-label="Options to rank">
        {options.map((label, i) => {
          const pos = ranking.indexOf(i);
          const ranked = pos !== -1;
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={!interactive}
              aria-pressed={ranked}
              aria-label={
                ranked ? `${label}, ranked ${pos + 1}. Tap to remove.` : `${label}. Tap to rank next.`
              }
              className={`flex w-full min-h-[56px] items-center gap-3 rounded-xl border border-l-4 px-4 py-3 text-left transition-colors duration-150 disabled:opacity-60 ${
                ranked ? 'border-accent bg-accent-soft' : 'border-edge bg-panel active:bg-panel-2'
              }`}
              style={{ borderLeftColor: chartVar(i) }}
            >
              {ranked ? (
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-sm font-bold text-white"
                >
                  {pos + 1}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge font-mono text-sm font-bold text-fg-dim"
                >
                  {letterFor(i)}
                </span>
              )}
              <span className="flex-1 text-[16px] font-medium leading-snug text-fg">{label}</span>
              {ranked && interactive && (
                <span aria-hidden="true" className="text-lg font-bold text-fg-dim">
                  ×
                </span>
              )}
            </button>
          );
        })}
      </div>

      {open && (editing || !answer) && (
        <Button size="lg" className="mt-4 w-full" disabled={!allRanked || sending} onClick={doSubmit}>
          {sending
            ? 'Sending…'
            : allRanked
              ? answer
                ? 'Update ranking'
                : 'Lock in ranking'
              : `Rank ${options.length - ranking.length} more`}
        </Button>
      )}

      <div className="mt-4">
        {phase === 'show' && <StatusNote>Opening soon — think about your order.</StatusNote>}
        {open && answer && !editing && (
          <div>
            <>
              <StatusNote tone="ok">Ranking received ✓</StatusNote>
              <AnonNote />
            </>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                clearError();
                setEditing(true);
              }}
            >
              Change ranking
            </Button>
          </div>
        )}
        {phase === 'closed' && (
          <StatusNote>{answer ? 'Closed — your ranking is in.' : 'Ranking closed for this one.'}</StatusNote>
        )}
        {phase === 'reveal' && (
          <StatusNote tone="ok">The room&apos;s ranking is on the big screen 👀</StatusNote>
        )}
      </div>

      <SubmitErrorNote code={errorCode} onRetry={retry} />
    </section>
  );
}
