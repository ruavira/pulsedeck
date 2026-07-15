'use client';
// Dedicated Q&A slide: the full Q&A experience inline (no sheet needed).

import type { Slide } from '@/lib/types';
import { QaPanel } from './qa-panel';
import type { AudienceCtx } from './activity';

export function QaSlideView({
  slide,
  ctx,
  qaBump,
  broadcast,
}: {
  slide: Slide;
  ctx: AudienceCtx;
  qaBump: number;
  broadcast: (event: string, payload: unknown) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4 shrink-0">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-fg-dim">
          Q&amp;A time
        </p>
        <h1 className="text-xl font-bold leading-snug text-fg">
          {slide.body.prompt || slide.title || 'What would you like to ask?'}
        </h1>
        <p className="mt-1 text-sm text-fg-dim">Upvote the questions you want answered.</p>
      </header>
      <QaPanel
        sessionId={ctx.sessionId}
        participantId={ctx.participantId}
        deviceKey={ctx.deviceKey}
        qaBump={qaBump}
        active
        broadcast={broadcast}
      />
    </section>
  );
}
