'use client';
// Open text: one answer per person (resubmitting replaces it — the copy says so).
// 250-char textarea with a live counter.

import { useEffect, useState } from 'react';
import type { Phase, Slide } from '@/lib/types';
import { Button } from '@/components/shared/ui';
import { AnonNote, Prompt, StatusNote, SubmitErrorNote } from './bits';
import { useSubmitResponse } from './use-submit';
import type { AudienceCtx } from './activity';

const MAX = 250;

type TextPayload = { text: string };

export function OpenTextView({
  slide,
  phase,
  ctx,
}: {
  slide: Slide;
  phase: Phase;
  ctx: AudienceCtx;
}) {
  const prompt = slide.body.prompt || slide.title || 'Your thoughts?';

  const { status, errorCode, answer, submit, retry, clearError } = useSubmitResponse<TextPayload>({
    sessionId: ctx.sessionId,
    slideId: slide.id,
    participantId: ctx.participantId,
    deviceKey: ctx.deviceKey,
    onStale: ctx.resync,
  });

  const [text, setText] = useState('');
  const [editing, setEditing] = useState(true);

  useEffect(() => {
    if (answer) {
      setText((prev) => prev || answer.payload.text);
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer === null]);

  const open = phase === 'open';
  const sending = status === 'sending';
  const trimmed = text.trim();

  const doSubmit = () => {
    if (!trimmed || sending) return;
    clearError();
    void submit({ text: trimmed }).then((res) => {
      if (res?.ok) setEditing(false);
    });
  };

  return (
    <section>
      <Prompt kindLabel="Open answer" text={prompt} />

      {phase === 'show' && <StatusNote>Opening soon — start composing in your head.</StatusNote>}

      {open && (editing || !answer) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSubmit();
          }}
        >
          <textarea
            value={text}
            maxLength={MAX}
            rows={4}
            disabled={sending}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            aria-label="Your answer"
            className="w-full resize-none rounded-xl border border-edge bg-panel-2 px-4 py-3 text-[16px] text-fg placeholder:text-fg-dim/70 focus:border-accent focus:outline-none transition-colors"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs text-fg-dim" aria-live="polite">
              {text.length}/{MAX}
            </p>
            <p className="text-xs text-fg-dim">One answer per person — updates replace it.</p>
          </div>
          <Button type="submit" size="lg" className="mt-3 w-full" disabled={!trimmed || sending}>
            {sending ? 'Sending…' : answer ? 'Update your answer' : 'Send answer'}
          </Button>
        </form>
      )}

      {open && answer && !editing && (
        <div>
          <>
            <StatusNote tone="ok">Answer received ✓</StatusNote>
            <AnonNote />
          </>
          <blockquote className="mt-3 rounded-xl border border-edge bg-panel px-4 py-3 text-[15px] leading-relaxed text-fg">
            {answer.payload.text}
          </blockquote>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              clearError();
              setEditing(true);
            }}
          >
            Update your answer
          </Button>
        </div>
      )}

      {phase === 'closed' && (
        <StatusNote>
          {answer ? 'Submissions closed — your answer is in.' : 'Submissions closed for this one.'}
        </StatusNote>
      )}
      {phase === 'reveal' && (
        <StatusNote tone="ok">Responses are up on the big screen 👀</StatusNote>
      )}

      {errorCode === 'filtered' ? (
        <p role="alert" className="mt-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-fg">
          That answer can&apos;t be shown as written — no worries, try rephrasing it.
        </p>
      ) : (
        <SubmitErrorNote code={errorCode} onRetry={retry} />
      )}
    </section>
  );
}
