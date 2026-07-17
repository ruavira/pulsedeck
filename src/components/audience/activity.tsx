'use client';
// Per-slide dispatcher: renders the right audience view for the current slide.
// Keyed by slide.id upstream so all per-slide state resets on navigation.

import { useState } from 'react';
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
import { useAudiencePrefs } from './prefs';
import { useTranslatedSlide } from './use-translated-slide';

/** Everything a view needs to talk to the server for this participant. */
export interface AudienceCtx {
  sessionId: string;
  participantId: string;
  deviceKey: string;
  /** Resync session state via RPC (e.g. after a stale_slide rejection). */
  resync: () => void;
}

// Small transparency strip shown when a slide is being auto-translated. Machine
// translation can be imperfect, so the participant can always flip to the source.
function TranslateBar({
  translating,
  showingOriginal,
  onToggle,
  t,
}: {
  translating: boolean;
  showingOriginal: boolean;
  onToggle: () => void;
  t: (k: 'translated' | 'translating' | 'showOriginal' | 'showTranslation') => string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-edge bg-panel-2/60 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-fg-dim">
        <span aria-hidden="true">🌐</span>
        {translating ? t('translating') : t('translated')}
      </span>
      <button
        type="button"
        onClick={onToggle}
        className="min-h-[32px] rounded-full border border-edge px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
      >
        {showingOriginal ? t('showTranslation') : t('showOriginal')}
      </button>
    </div>
  );
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
  translate = false,
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
  /** Facilitator has live translation switched on for this room. */
  translate?: boolean;
}) {
  const prefs = useAudiencePrefs();
  const [showOriginal, setShowOriginal] = useState(false);
  const { slide: translatedSlide, translating, active } = useTranslatedSlide(
    slide,
    translate,
    prefs.lang,
    ctx.sessionId,
  );
  const shown = active && !showOriginal ? translatedSlide : slide;

  const view = (() => {
    switch (shown.kind) {
      case 'content':
        return <ContentView slide={shown} deckTitle={deckTitle} />;
      case 'poll':
        return <PollView slide={shown} phase={phase} ctx={ctx} />;
      case 'wordcloud':
        return <WordcloudView slide={shown} phase={phase} ctx={ctx} />;
      case 'quiz':
        return (
          <QuizView
            slide={shown}
            phase={phase}
            phaseOpenedAt={phaseOpenedAt}
            ctx={ctx}
            onQuizResult={onQuizResult}
          />
        );
      case 'scale':
        return <ScaleView slide={shown} phase={phase} ctx={ctx} />;
      case 'ranking':
        return <RankingView slide={shown} phase={phase} ctx={ctx} />;
      case 'open_text':
        return <OpenTextView slide={shown} phase={phase} ctx={ctx} />;
      case 'qa':
        return <QaSlideView slide={shown} ctx={ctx} qaBump={qaBump} broadcast={broadcast} />;
      case 'breathing':
        return <BreathingView slide={shown} />;
      case 'timer':
        // The countdown lives on the big screen — phones get the calm look-up state.
        return <ContentView slide={shown} deckTitle={deckTitle} />;
      case 'join':
        // They're already in — a friendly confirmation while the room scans.
        return <ContentView slide={{ ...shown, title: "You're in ✓" }} deckTitle={deckTitle} />;
      default:
        return <ContentView slide={shown} deckTitle={deckTitle} />;
    }
  })();

  // Live results on the phone appear below the answer UI for interactive kinds.
  return (
    <>
      {active && (
        <TranslateBar
          translating={translating}
          showingOriginal={showOriginal}
          onToggle={() => setShowOriginal((v) => !v)}
          t={prefs.t}
        />
      )}
      {view}
      {isInteractiveKind(shown.kind) && (
        <PhoneResults slide={shown} phase={phase} results={results} sessionId={ctx.sessionId} />
      )}
    </>
  );
}
