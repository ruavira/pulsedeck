'use client';
// Scale: a big slider with a huge live readout. Resubmit allowed while open.

import { useEffect, useState } from 'react';
import type { Phase, Slide } from '@/lib/types';
import { Button } from '@/components/shared/ui';
import { AnonNote, Prompt, StatusNote, SubmitErrorNote } from './bits';
import { useSubmitResponse } from './use-submit';
import type { AudienceCtx } from './activity';

type ScalePayload = { value: number };

export function ScaleView({ slide, phase, ctx }: { slide: Slide; phase: Phase; ctx: AudienceCtx }) {
  const rawMin = slide.body.min ?? 1;
  const rawMax = slide.body.max ?? 10;
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax) === min ? min + 1 : Math.max(rawMin, rawMax);
  const prompt = slide.body.prompt || slide.title || 'Where do you land?';

  const { status, errorCode, answer, submit, retry, clearError } = useSubmitResponse<ScalePayload>({
    sessionId: ctx.sessionId,
    slideId: slide.id,
    participantId: ctx.participantId,
    deviceKey: ctx.deviceKey,
    onStale: ctx.resync,
  });

  const [value, setValue] = useState<number>(() => Math.round((min + max) / 2));

  // Restore prior submission's value.
  useEffect(() => {
    if (answer) setValue(answer.payload.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer === null]);

  const open = phase === 'open';
  const sending = status === 'sending';
  const submittedValue = answer?.payload.value ?? null;
  const dirty = submittedValue === null || submittedValue !== value;

  return (
    <section>
      <Prompt kindLabel="Scale" text={prompt} />

      <div className="py-4 text-center" aria-live="off">
        <p className="font-mono text-7xl font-bold text-fg tabular-nums" aria-hidden="true">
          {value}
        </p>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={!open || sending}
        onChange={(e) => {
          clearError();
          setValue(Number(e.target.value));
        }}
        aria-label={`${prompt} — value ${value} of ${min} to ${max}`}
        className="h-12 w-full cursor-pointer disabled:opacity-50"
        style={{ accentColor: 'var(--color-accent)' }}
      />
      <div className="mt-1 flex justify-between text-xs font-medium text-fg-dim">
        <span>
          {min}
          {slide.body.minLabel ? ` · ${slide.body.minLabel}` : ''}
        </span>
        <span>
          {max}
          {slide.body.maxLabel ? ` · ${slide.body.maxLabel}` : ''}
        </span>
      </div>

      {open && (
        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={sending || !dirty}
          onClick={() => void submit({ value })}
        >
          {sending ? 'Sending…' : submittedValue !== null ? 'Update answer' : 'Submit'}
        </Button>
      )}

      <div className="mt-4">
        {phase === 'show' && <StatusNote>Opening soon — feel out your number.</StatusNote>}
        {open && submittedValue !== null && !sending && !dirty && (
          <>
            <StatusNote tone="ok">Answer received ✓ Slide to change it while voting is open.</StatusNote>
            <AnonNote />
          </>
        )}
        {phase === 'closed' && (
          <StatusNote>
            {submittedValue !== null
              ? `Voting closed — you said ${submittedValue}.`
              : 'Voting closed for this one.'}
          </StatusNote>
        )}
        {phase === 'reveal' && (
          <StatusNote tone="ok">The room&apos;s average is on the big screen 👀</StatusNote>
        )}
      </div>

      <SubmitErrorNote code={errorCode} onRetry={retry} />
    </section>
  );
}
