'use client';
// Per-slide dispatcher: renders the right audience view for the current slide.
// Keyed by slide.id upstream so all per-slide state resets on navigation.

import { isInteractiveKind } from '@/lib/types';
import type { Phase, Slide, Results } from '@/lib/types';
import { ContentView } from './content-view';
import { PollView } from './poll-view';
import { WordcloudView } from './wordcloud-view';
import { QuizView } from './quiz-view';
import { ScaleView } from './scale-view';
import { RankingView } from './ranking-view';
import { OpenTextView } from './open-text-view';
import { QaSlideView } from './qa-slide-view';
import { BreathingView } from './breathing-view';
import { PhoneResults } from './results-view';

/** Everything a view needs to talk to the server for this participant. */
export interface AudienceCtx {
  sessionId: string;
  participantId: string;
  deviceKey: string;
  /** Resync session state via RPC (e.g. after a stale_slide rejection). */
  resync: () => void;
}

export function Activity({
  slide,
  phase,
  phaseOpenedAt,
  deckTitle,
  ctx,
  qaBump,
  broadcast,
  onQuizResult,
  results,
}: {
  slide: Slide;
  phase: Phase;
  phaseOpenedAt: string | null | undefined;
  deckTitle: string;
  ctx: AudienceCtx;
  qaBump: number;
  broadcast: (event: string, payload: unknown) => void;
  onQuizResult: (points: number, correct: boolean) => void;
  /** Latest aggregated results for THIS slide (from the stage rebroadcast). */
  results: Results | null;
}) {
  const view = (() => {
    switch (slide.kind) {
      case 'content':
        return <ContentView slide={slide} deckTitle={deckTitle} />;
      case 'poll':
        return <PollView slide={slide} phase={phase} ctx={ctx} />;
      case 'wordcloud':
        return <WordcloudView slide={slide} phase={phase} ctx={ctx} />;
      case 'quiz':
        return (
          <QuizView
            slide={slide}
            phase={phase}
            phaseOpenedAt={phaseOpenedAt}
            ctx={ctx}
            onQuizResult={onQuizResult}
          />
        );
      case 'scale':
        return <ScaleView slide={slide} phase={phase} ctx={ctx} />;
      case 'ranking':
        return <RankingView slide={slide} phase={phase} ctx={ctx} />;
      case 'open_text':
        return <OpenTextView slide={slide} phase={phase} ctx={ctx} />;
      case 'qa':
        return <QaSlideView slide={slide} ctx={ctx} qaBump={qaBump} broadcast={broadcast} />;
      case 'breathing':
        return <BreathingView slide={slide} />;
      case 'timer':
        // The countdown lives on the big screen — phones get the calm look-up state.
        return <ContentView slide={slide} deckTitle={deckTitle} />;
      case 'join':
        // They're already in — a friendly confirmation while the room scans.
        return <ContentView slide={{ ...slide, title: "You're in ✓" }} deckTitle={deckTitle} />;
      default:
        return <ContentView slide={slide} deckTitle={deckTitle} />;
    }
  })();

  // Live results on the phone appear below the answer UI for interactive kinds.
  return (
    <>
      {view}
      {isInteractiveKind(slide.kind) && (
        <PhoneResults slide={slide} phase={phase} results={results} sessionId={ctx.sessionId} />
      )}
    </>
  );
}
