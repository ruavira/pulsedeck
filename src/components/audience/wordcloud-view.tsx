'use client';
// Wordcloud: up to settings.maxWords (default 3) short text inputs. Filtered
// words get a gentle, non-shaming inline note. Words can be updated while open.

import { useEffect, useState } from 'react';
import type { Phase, Slide } from '@/lib/types';
import { Button, Input } from '@/components/shared/ui';
import { AnonNote, Prompt, StatusNote, SubmitErrorNote } from './bits';
import { useSubmitResponse } from './use-submit';
import type { AudienceCtx } from './activity';

type WordsPayload = { words: string[] };

export function WordcloudView({
  slide,
  phase,
  ctx,
}: {
  slide: Slide;
  phase: Phase;
  ctx: AudienceCtx;
}) {
  const maxWords = Math.min(Math.max(slide.settings.maxWords ?? 3, 1), 5);
  const prompt = slide.body.prompt || slide.title || 'One word that comes to mind?';

  const { status, errorCode, answer, submit, retry, clearError } =
    useSubmitResponse<WordsPayload>({
      sessionId: ctx.sessionId,
      slideId: slide.id,
      participantId: ctx.participantId,
      deviceKey: ctx.deviceKey,
      onStale: ctx.resync,
    });

  const [words, setWords] = useState<string[]>(() => Array<string>(maxWords).fill(''));
  const [editing, setEditing] = useState(true);

  // Restore a previous submission (refresh / phone lock).
  useEffect(() => {
    if (answer) {
      setWords((prev) => {
        const next = Array<string>(maxWords).fill('');
        answer.payload.words.slice(0, maxWords).forEach((w, i) => (next[i] = w));
        return prev.some((p) => p !== '') ? prev : next;
      });
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer === null]);

  const open = phase === 'open';
  const sending = status === 'sending';
  const nonEmpty = words.map((w) => w.trim()).filter((w) => w !== '');

  const doSubmit = () => {
    if (nonEmpty.length === 0 || sending) return;
    clearError();
    void submit({ words: nonEmpty }).then((res) => {
      if (res?.ok) setEditing(false);
    });
  };

  return (
    <section>
      <Prompt
        kindLabel={`Word cloud · up to ${maxWords} ${maxWords === 1 ? 'word' : 'words'}`}
        text={prompt}
      />

      {phase === 'show' && <StatusNote>Get your words ready — opening soon.</StatusNote>}

      {open && (editing || !answer) && (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            doSubmit();
          }}
        >
          {words.map((w, i) => (
            <Input
              key={i}
              value={w}
              maxLength={40}
              placeholder={i === 0 ? 'Your word…' : `Another word (optional)`}
              aria-label={`Word ${i + 1} of ${maxWords}`}
              autoComplete="off"
              disabled={sending}
              onChange={(e) => {
                const next = [...words];
                next[i] = e.target.value;
                setWords(next);
              }}
            />
          ))}
          <Button type="submit" size="lg" disabled={nonEmpty.length === 0 || sending}>
            {sending ? 'Sending…' : answer ? 'Update words' : 'Send words'}
          </Button>
        </form>
      )}

      {open && answer && !editing && (
        <div>
          <>
            <StatusNote tone="ok">Your words are in the cloud ✓</StatusNote>
            <AnonNote />
          </>
          <div className="mt-3 flex flex-wrap gap-2">
            {answer.payload.words.map((w, i) => (
              <span
                key={`${w}-${i}`}
                className="rounded-full border border-accent/40 bg-accent-soft px-3.5 py-2 text-sm font-semibold text-fg"
              >
                {w}
              </span>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => {
              clearError();
              setEditing(true);
            }}
          >
            Change my words
          </Button>
        </div>
      )}

      {phase === 'closed' && (
        <StatusNote>
          {answer ? 'Submissions closed — your words made it in.' : 'Submissions closed for this one.'}
        </StatusNote>
      )}
      {phase === 'reveal' && (
        <StatusNote tone="ok">The cloud is up on the big screen ☁️</StatusNote>
      )}

      {errorCode === 'filtered' ? (
        <p role="alert" className="mt-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-fg">
          Those words can&apos;t be shown on the big screen — no worries, try different ones.
        </p>
      ) : (
        <SubmitErrorNote code={errorCode} onRetry={retry} />
      )}
    </section>
  );
}
