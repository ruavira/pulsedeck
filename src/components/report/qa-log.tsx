'use client';
// Q&A log + optional AI theme summary for the post-session report.

import { useState } from 'react';
import { Button, Card, Pill, Spinner } from '@/components/shared/ui';
import type { QaSummary, ReportQuestion } from './types';

const STATUS_LABEL: Record<ReportQuestion['status'], string> = {
  pending: 'Pending',
  visible: 'Visible',
  answered: 'Answered',
  archived: 'Archived',
};

const STATUS_TONE: Record<ReportQuestion['status'], 'default' | 'accent' | 'dim'> = {
  pending: 'dim',
  visible: 'default',
  answered: 'accent',
  archived: 'dim',
};

type AiState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'disabled' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; summary: QaSummary };

function AiSummarizer({ sessionId, presenterKey }: { sessionId: string; presenterKey: string }) {
  const [ai, setAi] = useState<AiState>({ phase: 'idle' });

  const run = async () => {
    setAi({ phase: 'loading' });
    try {
      const res = await fetch('/api/ai/summarize-qa', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-presenter-key': presenterKey },
        body: JSON.stringify({ sessionId }),
      });
      if (res.status === 501) {
        setAi({ phase: 'disabled' });
        return;
      }
      if (!res.ok) {
        setAi({ phase: 'error', message: `Summarization failed (server responded ${res.status}). Try again.` });
        return;
      }
      const data = (await res.json()) as Partial<QaSummary>;
      setAi({
        phase: 'done',
        summary: {
          themes: Array.isArray(data.themes) ? data.themes : [],
          summary: typeof data.summary === 'string' ? data.summary : '',
        },
      });
    } catch {
      setAi({ phase: 'error', message: 'Summarization failed — check your connection and try again.' });
    }
  };

  return (
    <div aria-live="polite">
      {ai.phase === 'idle' && (
        <Button variant="secondary" className="no-print" onClick={run}>
          Summarize Q&amp;A with AI
        </Button>
      )}
      {ai.phase === 'loading' && (
        <span className="inline-flex min-h-[44px] items-center gap-2 text-sm text-fg-dim">
          <Spinner /> Summarizing questions…
        </span>
      )}
      {ai.phase === 'disabled' && (
        <p className="text-sm text-fg-dim">
          AI features are switched off on this deployment, so automatic summaries are unavailable.
        </p>
      )}
      {ai.phase === 'error' && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-red">{ai.message}</p>
          <Button variant="secondary" className="no-print" onClick={run}>
            Retry
          </Button>
        </div>
      )}
      {ai.phase === 'done' && (
        <div className="space-y-4">
          {ai.summary.summary && (
            <p className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-sm leading-relaxed text-fg print:border-neutral-300 print:bg-white print:text-black">
              {ai.summary.summary}
            </p>
          )}
          {ai.summary.themes.length === 0 ? (
            <p className="text-sm text-fg-dim print:text-neutral-600">No themes were identified.</p>
          ) : (
            <ul className="space-y-3">
              {ai.summary.themes.map((t, i) => (
                <li key={i}>
                  <h4 className="mb-1 text-sm font-semibold text-accent print:text-black">{t.theme}</h4>
                  <ul className="space-y-1 pl-4">
                    {t.questions.map((q, j) => (
                      <li key={j} className="list-disc text-sm text-fg-dim print:text-neutral-700">
                        {q}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function QaLog({
  questions,
  sessionId,
  presenterKey,
}: {
  questions: ReportQuestion[];
  sessionId: string;
  presenterKey: string;
}) {
  if (questions.length === 0) {
    return (
      <Card className="p-6 print:border-neutral-300 print:bg-white">
        <p className="text-sm text-fg-dim print:text-neutral-600">
          No audience questions were submitted in this session.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card className="p-5 print:border-neutral-300 print:bg-white sm:p-6">
        <AiSummarizer sessionId={sessionId} presenterKey={presenterKey} />
      </Card>
      <Card className="p-5 print:border-neutral-300 print:bg-white sm:p-6">
        <ul className="space-y-3">
          {questions.map((q) => (
            <li
              key={q.id}
              className="break-inside-avoid rounded-xl border border-edge bg-panel-2 px-4 py-3 print:border-neutral-200 print:bg-white"
            >
              <p className="text-sm text-fg print:text-black">{q.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-dim print:text-neutral-600">
                <span>{q.author || 'Anonymous'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  ▲ {q.upvotes} upvote{q.upvotes === 1 ? '' : 's'}
                </span>
                <Pill tone={STATUS_TONE[q.status]} className="print:border-neutral-300 print:bg-white print:text-neutral-700">
                  {STATUS_LABEL[q.status]}
                </Pill>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
