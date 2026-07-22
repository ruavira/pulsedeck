'use client';
// PulseDeck Embeds — the view layer. Thin wrappers around the stage's
// presentational components (BarChart, WordCloud, ScaleView, OpenTextWall,
// QaWall, JoinQr) so an embed renders exactly what the projector shows publicly.
// Every branch resolves to a real state — no dead ends: loading, pre-live, ended,
// idle/between-activities, live widget, and a degraded "reconnecting" note.

import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase/client';
import type { LeaderboardEntry, Results, SlideKind } from '@/lib/types';
import { Spinner, JoinCode } from '@/components/shared/ui';
import { BarChart } from '@/components/stage/bar-chart';
import { WordCloud } from '@/components/stage/word-cloud';
import { ScaleView } from '@/components/stage/scale-view';
import { OpenTextWall } from '@/components/stage/open-text-wall';
import { QaWall } from '@/components/stage/qa-wall';
import { JoinQr, joinHost } from '@/components/stage/join-qr';
import type { EmbedSession, EmbedSlide } from '@/hooks/use-embed-session';
import type { EmbedWidget } from './embed-app';

const WIDGET_KIND: Partial<Record<EmbedWidget, SlideKind>> = {
  poll: 'poll',
  quiz: 'quiz',
  ranking: 'ranking',
  wordcloud: 'wordcloud',
  qa: 'qa',
};

const WIDGET_LABEL: Record<EmbedWidget, string> = {
  auto: 'activity',
  poll: 'poll',
  quiz: 'quiz',
  ranking: 'ranking',
  wordcloud: 'word cloud',
  qa: 'Q&A',
  leaderboard: 'leaderboard',
  join: 'join',
};

function bodyHeight(compact: boolean): string {
  return compact ? 'h-[clamp(150px,34vh,300px)]' : 'h-[clamp(190px,44vh,400px)]';
}

/** A centered, quiet status message — the shared shape for every non-live state. */
function Notice({
  title,
  sub,
  compact,
  spinner = false,
}: {
  title: string;
  sub?: React.ReactNode;
  compact: boolean;
  spinner?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-center ${
        compact ? 'py-6' : 'py-10'
      }`}
    >
      {spinner && <Spinner className="mb-1" />}
      <p className="text-base font-semibold text-fg [text-wrap:balance]">{title}</p>
      {sub && <p className="text-sm text-fg-dim [text-wrap:balance]">{sub}</p>}
    </div>
  );
}

function JoinLine({ code }: { code?: string | null }) {
  return (
    <>
      Join at <span className="font-semibold text-fg">{joinHost()}/j</span>
      {code ? (
        <>
          {' '}· code <JoinCode code={code} className="text-[1.05em]" />
        </>
      ) : null}
    </>
  );
}

function JoinWidget({
  session,
  compact,
}: {
  session: EmbedSession;
  compact: boolean;
}) {
  const code = session.code;
  const count = session.participantCount ?? 0;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {code ? (
        <>
          <JoinQr code={code} size={compact ? 120 : 168} pad={12} />
          <div>
            <p className="text-sm font-medium text-fg-dim">
              Scan, or go to <span className="font-semibold text-fg">{joinHost()}/j</span>
            </p>
            <JoinCode code={code} className="mt-1 block text-3xl" />
          </div>
          <p className="text-sm font-semibold text-cyan" aria-live="polite">
            {count === 0
              ? 'Waiting for the first join…'
              : `${count} ${count === 1 ? 'person is' : 'people are'} in`}
          </p>
        </>
      ) : (
        <Notice
          compact={compact}
          title="Session opens soon"
          sub={<JoinLine />}
        />
      )}
    </div>
  );
}

function LeaderboardWidget({
  sessionId,
  compact,
}: {
  sessionId: string;
  compact: boolean;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const rows = await rpc<LeaderboardEntry[]>('get_leaderboard', {
          p_session_id: sessionId,
          p_limit: compact ? 5 : 10,
        });
        if (!stop) {
          setEntries(Array.isArray(rows) ? rows : []);
          setFailed(false);
        }
      } catch {
        if (!stop) setFailed(true);
      }
    };
    void load();
    const id = setInterval(() => void load(), 5000 + Math.random() * 1500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [sessionId, compact]);

  if (entries === null) {
    return <Notice compact={compact} spinner title="Tallying scores…" />;
  }
  if (entries.length === 0) {
    return (
      <Notice
        compact={compact}
        title="No scores yet"
        sub={failed ? 'Reconnecting…' : 'Run a quiz question to get the board going.'}
      />
    );
  }

  return (
    <ol className="flex flex-col gap-1.5" aria-label="Leaderboard">
      {entries.map((e, i) => (
        <li
          key={`${i}-${e.nickname}`}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
            i === 0 ? 'border-amber/60 bg-amber/10' : 'border-edge bg-panel'
          }`}
        >
          <span className="w-6 shrink-0 text-center font-mono font-bold tabular-nums text-fg-dim">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold text-fg">
            {e.nickname || 'Anonymous'}
          </span>
          <span className="shrink-0 font-mono font-bold tabular-nums text-cyan">
            {e.score.toLocaleString()}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ResultsBody({
  slide,
  results,
  degraded,
  compact,
}: {
  slide: EmbedSlide;
  results: Results | null;
  degraded: boolean;
  compact: boolean;
}) {
  const prompt = slide.body.prompt || slide.title || '';
  const total = results?.total ?? 0;

  let body: React.ReactNode;
  if (!results || total === 0) {
    body = (
      <Notice
        compact={compact}
        title={degraded ? 'Reconnecting to live results…' : 'Waiting for responses…'}
        sub={degraded ? undefined : 'Answers appear here live.'}
      />
    );
  } else {
    switch (results.kind) {
      case 'poll':
      case 'quiz':
      case 'ranking':
        body = (
          <div className={`${bodyHeight(compact)} overflow-hidden`}>
            <BarChart
              options={slide.body.options ?? []}
              counts={results.counts}
              total={results.total}
            />
          </div>
        );
        break;
      case 'wordcloud':
        body = (
          <div className={`${bodyHeight(compact)} overflow-hidden`}>
            <WordCloud words={results.words} total={results.total} />
          </div>
        );
        break;
      case 'scale':
        body = (
          <div className={`${bodyHeight(compact)} overflow-hidden`}>
            <ScaleView
              results={results}
              min={slide.body.min ?? 1}
              max={slide.body.max ?? 5}
              minLabel={slide.body.minLabel}
              maxLabel={slide.body.maxLabel}
            />
          </div>
        );
        break;
      case 'open_text':
        body = (
          <div className={`${bodyHeight(compact)} overflow-hidden`}>
            <OpenTextWall results={results} />
          </div>
        );
        break;
      default:
        body = null;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {prompt && (
        <h1 className="font-bold leading-tight text-fg [font-size:clamp(1.1rem,3vw,1.6rem)] [text-wrap:balance]">
          {prompt}
        </h1>
      )}
      {body}
      {results && total > 0 && (
        <p className="font-mono text-xs font-semibold tabular-nums text-fg-dim" aria-live="polite">
          {total} {total === 1 ? 'response' : 'responses'}
          {degraded ? ' · reconnecting…' : ''}
        </p>
      )}
    </div>
  );
}

const RESULT_KINDS: ReadonlySet<SlideKind> = new Set([
  'poll',
  'quiz',
  'ranking',
  'wordcloud',
  'scale',
  'open_text',
]);

export function EmbedWidgetView({
  widget,
  session,
  results,
  degraded,
  compact,
}: {
  widget: EmbedWidget;
  session: EmbedSession;
  results: Results | null;
  degraded: boolean;
  compact: boolean;
}) {
  // ----- non-live states (no dead ends) -----
  if (session.loading && !session.live && !session.ended) {
    return <Notice compact={compact} spinner title="Connecting…" />;
  }
  if (session.ended) {
    return (
      <Notice
        compact={compact}
        title="Session ended"
        sub="Thanks for taking part."
      />
    );
  }
  if (!session.live) {
    return (
      <Notice
        compact={compact}
        title="Session opens soon"
        sub={<JoinLine />}
      />
    );
  }

  // ----- live -----
  const sessionId = session.sessionId as string;
  const slide = session.currentSlide;

  if (widget === 'join') {
    return <JoinWidget session={session} compact={compact} />;
  }
  if (widget === 'leaderboard') {
    return <LeaderboardWidget sessionId={sessionId} compact={compact} />;
  }

  // Q&A (fixed, or auto on a Q&A slide) renders the self-fetching wall.
  const kind = slide?.kind;
  if (widget === 'qa' || (widget === 'auto' && kind === 'qa')) {
    return (
      <div className={`${bodyHeight(compact)} overflow-hidden`}>
        <QaWall sessionId={sessionId} bumpSignal={session.qaBump} code={session.code ?? ''} />
      </div>
    );
  }

  // Fixed activity widgets: render when the live slide matches, else idle.
  if (widget !== 'auto') {
    const want = WIDGET_KIND[widget];
    if (slide && want && slide.kind === want) {
      return <ResultsBody slide={slide} results={results} degraded={degraded} compact={compact} />;
    }
    return (
      <Notice
        compact={compact}
        title={`Waiting for the next ${WIDGET_LABEL[widget]}`}
        sub={<JoinLine code={session.code} />}
      />
    );
  }

  // auto: mirror the live slide's current activity.
  if (slide && RESULT_KINDS.has(slide.kind)) {
    return <ResultsBody slide={slide} results={results} degraded={degraded} compact={compact} />;
  }
  if (slide && slide.kind === 'join') {
    return <JoinWidget session={session} compact={compact} />;
  }
  // Content / timer / breathing / between activities → a compact join prompt.
  return <JoinWidget session={session} compact={compact} />;
}
