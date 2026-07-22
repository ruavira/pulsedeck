'use client';
// PulseDeck Embeds — client orchestrator for a single deck-scoped widget.
//
// ONE session channel (via use-embed-session): it carries state broadcasts,
// presence (role 'embed'), and the aggregated `results` stream. Presence drives
// use-aggregator-election, which names exactly one poller: a live stage if present
// (embeds defer), otherwise the embed with the smallest clientId. ONLY the elected
// aggregator runs use-results-poller (poll get_results + rebroadcast throttled
// `results`); every embed — the aggregator included, thanks to broadcast self:true —
// renders from the single `results` broadcast path. Handoff is flicker-free: the
// new poller's leading fetch is gap-free and consumers keep the last-known results.

import { useCallback, useMemo, useState } from 'react';
import type { RealtimePresenceState } from '@supabase/supabase-js';
import { useEmbedSession } from '@/hooks/use-embed-session';
import { useAggregatorElection } from '@/hooks/use-aggregator-election';
import { useResultsPoller } from '@/hooks/use-results-poller';
import { INTERACTIVE_KINDS, type Results, type SlideKind } from '@/lib/types';
import type { ThemeId } from '@/components/shared/theme-switcher';
import { EmbedWidgetView } from './embed-widget';

export type EmbedWidget =
  | 'auto'
  | 'poll'
  | 'quiz'
  | 'ranking'
  | 'wordcloud'
  | 'qa'
  | 'leaderboard'
  | 'join';

export interface EmbedConfig {
  theme?: ThemeId;
  /** Sanitized #hex accent (the only dynamic inline color). */
  accent?: string;
  compact: boolean;
  preset?: 'gamma';
}

// Result kinds the single aggregator polls (every interactive kind except Q&A,
// which has its own fetch path). Mirrors the stage's RESULT_KINDS.
const RESULT_KINDS: ReadonlySet<SlideKind> = new Set(INTERACTIVE_KINDS.filter((k) => k !== 'qa'));

export function EmbedApp({
  deckId,
  widget,
  config,
}: {
  deckId: string;
  widget: EmbedWidget;
  config: EmbedConfig;
}) {
  // Presence snapshot → election. clientId is stable per tab (owned by the hook).
  const [presenceState, setPresenceState] = useState<RealtimePresenceState | null>(null);
  const { isAggregator, clientId } = useAggregatorElection(presenceState);

  // Latest aggregated results (keyed to the slide they belong to).
  const [resultsBox, setResultsBox] = useState<{ slideId: string; results: Results } | null>(null);
  const onResults = useCallback(
    (p: { slideId: string; results: Results }) => setResultsBox(p),
    [],
  );

  const presence = useMemo(() => ({ key: clientId, role: 'embed' }), [clientId]);
  const session = useEmbedSession(deckId, {
    presence,
    onPresenceSync: setPresenceState,
    onResults,
  });

  const currentSlide = session.currentSlide;
  const currentSlideId = currentSlide?.id ?? null;
  const results =
    resultsBox && resultsBox.slideId === currentSlideId ? resultsBox.results : null;

  // The current slide's live results are worth polling when it's a result-kind
  // activity past the "get ready" phase — independent of which widget is shown,
  // because the aggregator feeds results to every consumer on this session.
  const active =
    session.live &&
    session.status === 'live' &&
    !!currentSlide &&
    RESULT_KINDS.has(currentSlide.kind) &&
    session.phase !== 'show';
  const open = session.phase === 'open';

  // Depend on the stable `broadcast` identity (not the whole session object, which
  // is a fresh literal each render) so the poller effect isn't torn down per render.
  const broadcast = session.broadcast;
  const rebroadcast = useCallback(
    (payload: { slideId: string; results: Results }) => broadcast('results', payload),
    [broadcast],
  );

  // ONLY the elected aggregator polls. Its leading tick is the gap-free fetch on
  // becoming aggregator; on losing the role it simply stops (active → false).
  const { degraded: pollerDegraded } = useResultsPoller(
    session.sessionId,
    currentSlideId,
    isAggregator && active,
    open,
    rebroadcast,
  );

  // Degraded = the live results stream is unreliable. For the aggregator that's
  // repeated get_results failures; for a consumer it's a dropped channel.
  const degraded = active && (isAggregator ? pollerDegraded : !session.connected);

  const themed = config.theme && config.theme !== 'ice' ? config.theme : undefined;
  const framed = config.preset !== 'gamma';
  const style = config.accent
    ? ({ '--color-accent': config.accent } as React.CSSProperties)
    : undefined;

  return (
    <div
      data-theme={themed}
      style={style}
      className={`flex min-h-[100dvh] flex-col justify-center text-fg ${config.compact ? 'p-2' : 'p-3'}`}
    >
      <div
        className={
          framed
            ? 'w-full rounded-2xl border border-edge bg-panel/80 shadow-soft ' +
              (config.compact ? 'p-3' : 'p-4 sm:p-5')
            : 'w-full'
        }
      >
        <EmbedWidgetView
          widget={widget}
          session={session}
          results={results}
          degraded={degraded}
          compact={config.compact}
        />
      </div>
    </div>
  );
}
