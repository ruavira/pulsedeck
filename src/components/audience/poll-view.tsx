'use client';
// Poll: single-tap instant submit, or multi-select with checkboxes + Submit.
// Votes can be changed while the phase is open (server upserts).

import { useEffect, useState } from 'react';
import type { Phase, Slide } from '@/lib/types';
import { Button } from '@/components/shared/ui';
import { AnonNote, CheckMark, OptionRow, Prompt, StatusNote, SubmitErrorNote } from './bits';
import { useSubmitResponse } from './use-submit';
import type { AudienceCtx } from './activity';

type PollPayload = { choice: number } | { choices: number[] };

export function PollView({ slide, phase, ctx }: { slide: Slide; phase: Phase; ctx: AudienceCtx }) {
  const options = slide.body.options ?? [];
  const multi = Boolean(slide.settings.multiSelect);
  const prompt = slide.body.prompt || slide.title || 'What do you think?';

  const { status, errorCode, answer, submit, retry, clearError } =
    useSubmitResponse<PollPayload>({
      sessionId: ctx.sessionId,
      slideId: slide.id,
      participantId: ctx.participantId,
      deviceKey: ctx.deviceKey,
      onStale: ctx.resync,
    });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);

  // Hydrate multi-select checkboxes from a restored answer.
  useEffect(() => {
    if (answer && 'choices' in answer.payload) setSelected(new Set(answer.payload.choices));
  }, [answer]);

  useEffect(() => {
    if (status !== 'sending') setPendingIdx(null);
  }, [status]);

  if (options.length === 0) {
    return (
      <section>
        <Prompt kindLabel="Poll" text={prompt} />
        <StatusNote>This poll has no options yet — watch the big screen.</StatusNote>
      </section>
    );
  }

  const chosenSingle = answer && 'choice' in answer.payload ? answer.payload.choice : null;
  const chosenMulti =
    answer && 'choices' in answer.payload ? new Set(answer.payload.choices) : null;
  const open = phase === 'open';
  const sending = status === 'sending';

  const tapSingle = (i: number) => {
    if (!open || sending) return;
    if (chosenSingle === i) return; // already this vote
    clearError();
    setPendingIdx(i);
    void submit({ choice: i });
  };

  const toggleMulti = (i: number) => {
    if (!open || sending) return;
    clearError();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const submitMulti = () => {
    if (selected.size === 0 || sending) return;
    clearError();
    void submit({ choices: [...selected].sort((a, b) => a - b) });
  };

  const multiDirty =
    chosenMulti === null ||
    selected.size !== chosenMulti.size ||
    [...selected].some((i) => !chosenMulti.has(i));

  return (
    <section>
      <Prompt kindLabel={multi ? 'Poll · pick all that apply' : 'Poll'} text={prompt} />

      <div className="flex flex-col gap-2.5" role={multi ? 'group' : undefined}>
        {options.map((label, i) => {
          const isChosen = multi ? selected.has(i) : chosenSingle === i;
          return (
            <OptionRow
              key={i}
              index={i}
              label={label}
              image={slide.body.optionImages?.[i]}
              selected={isChosen}
              pending={pendingIdx === i && sending}
              disabled={!open || (sending && pendingIdx !== i)}
              ariaPressed={isChosen}
              onClick={() => (multi ? toggleMulti(i) : tapSingle(i))}
              trailing={isChosen ? <CheckMark className="text-accent" /> : undefined}
            />
          );
        })}
      </div>

      {multi && open && (
        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={selected.size === 0 || sending || (status === 'submitted' && !multiDirty)}
          onClick={submitMulti}
        >
          {sending ? 'Sending…' : answer ? 'Update vote' : 'Submit vote'}
        </Button>
      )}

      <div className="mt-4">
        {phase === 'show' && <StatusNote>Voting opens in a moment — get ready.</StatusNote>}
        {open && answer && status !== 'sending' && (
          <>
            <StatusNote tone="ok">
              Vote received ✓{' '}
              {multi ? 'Adjust your picks any time while voting is open.' : 'Tap another option to change it.'}
            </StatusNote>
            <AnonNote />
          </>
        )}
        {phase === 'closed' &&
          (answer ? (
            <StatusNote>Voting closed — your vote is in.</StatusNote>
          ) : (
            <StatusNote>Voting closed for this one.</StatusNote>
          ))}
        {phase === 'reveal' && (
          <StatusNote tone="ok">Results are up on the big screen 👀</StatusNote>
        )}
      </div>

      <SubmitErrorNote code={errorCode} onRetry={retry} />
    </section>
  );
}
