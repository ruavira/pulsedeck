'use client';
// /report/[sessionId] client shell: key resolution (localStorage → ?key= → paste
// screen), report fetch, and the print-friendly report layout.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, Input, JoinCode, Pill, Spinner } from '@/components/shared/ui';
import { getSessionKey, storeSessionKey } from '@/lib/presenter-api';
import { LeaderboardTable } from './leaderboard-table';
import { QaLog } from './qa-log';
import { ResultCard } from './result-card';
import type { SessionReport } from './types';

type LoadState =
  | { phase: 'resolving-key' }
  | { phase: 'need-key'; message?: string }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; report: SessionReport; key: string };

/** Download button with a brief "Preparing…" busy state (server-generated files
 *  can take a second; the navigation has no completion event, so we time-box it). */
function ExportButton({ href, children }: { href: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      aria-live="polite"
      onClick={() => {
        setBusy(true);
        window.location.href = href;
        setTimeout(() => setBusy(false), 2500);
      }}
    >
      {busy ? 'Preparing…' : children}
    </Button>
  );
}

function formatWhen(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) return 'Never went live';
  const start = new Date(startedAt);
  const date = start.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (!endedAt) return `${date}, ${startTime}`;
  const endTime = new Date(endedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date}, ${startTime} – ${endTime}`;
}

function KeyEntry({
  message,
  onSubmit,
}: {
  message?: string;
  onSubmit: (key: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Card className="p-6">
        <h1 className="mb-2 text-xl font-bold text-fg">Session report</h1>
        <p className="mb-5 text-sm text-fg-dim">
          This report is presenter-only. Paste the presenter key for this deck (it&apos;s in your
          Studio on the device you presented from).
        </p>
        {message && (
          <p role="alert" className="mb-4 rounded-xl border border-red/40 bg-red/10 px-4 py-2.5 text-sm text-red">
            {message}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }}
        >
          <label htmlFor="presenter-key" className="mb-1.5 block text-sm font-medium text-fg">
            Presenter key
          </label>
          <Input
            id="presenter-key"
            name="presenter-key"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste your presenter key"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" className="mt-4 w-full" disabled={!value.trim()}>
            Open report
          </Button>
        </form>
      </Card>
    </main>
  );
}

export function ReportClient({ sessionId }: { sessionId: string }) {
  const [lmsState, setLmsState] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle');
  const searchParams = useSearchParams();
  const urlKey = searchParams.get('key');
  const [state, setState] = useState<LoadState>({ phase: 'resolving-key' });

  const load = useCallback(
    async (key: string) => {
      setState({ phase: 'loading' });
      let res: Response;
      try {
        res = await fetch(`/api/presenter/${sessionId}/report`, {
          headers: { 'x-presenter-key': key },
          cache: 'no-store',
        });
      } catch {
        setState({ phase: 'error', message: 'Could not reach the server. Check your connection and retry.' });
        return;
      }
      if (res.status === 401) {
        setState({ phase: 'need-key', message: 'That presenter key was not accepted for this session.' });
        return;
      }
      if (res.status === 404) {
        setState({ phase: 'error', message: 'This session no longer exists.' });
        return;
      }
      if (!res.ok) {
        setState({ phase: 'error', message: `The report could not be loaded (server responded ${res.status}).` });
        return;
      }
      try {
        const report = (await res.json()) as SessionReport;
        storeSessionKey(sessionId, key);
        setState({ phase: 'ready', report, key });
      } catch {
        setState({ phase: 'error', message: 'The server returned an unreadable report. Please retry.' });
      }
    },
    [sessionId],
  );

  useEffect(() => {
    const key = urlKey ?? getSessionKey(sessionId);
    if (key) void load(key);
    else setState({ phase: 'need-key' });
  }, [sessionId, urlKey, load]);

  if (state.phase === 'resolving-key' || state.phase === 'loading') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-fg-dim" role="status">
          Loading session report…
        </p>
      </main>
    );
  }

  if (state.phase === 'need-key') {
    return <KeyEntry message={state.message} onSubmit={(key) => void load(key)} />;
  }

  if (state.phase === 'error') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <Card className="p-6 text-center">
          <h1 className="mb-2 text-lg font-bold text-fg">Report unavailable</h1>
          <p role="alert" className="mb-5 text-sm text-fg-dim">
            {state.message}
          </p>
          <Button variant="secondary" onClick={() => setState({ phase: 'need-key' })}>
            Try a different key
          </Button>
        </Card>
      </main>
    );
  }

  const { report, key } = state;
  const exportBase = `/api/export/results/${sessionId}?key=${encodeURIComponent(key)}&format=`;

  const pushLms = async () => {
    setLmsState('sending');
    try {
      const res = await fetch(`/api/presenter/${sessionId}/lms-push`, {
        method: 'POST',
        headers: { 'x-presenter-key': key },
      });
      setLmsState(res.ok ? 'ok' : 'fail');
    } catch {
      setLmsState('fail');
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:px-0 sm:px-6">
      {/* Header */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Pill tone={report.session.status === 'ended' ? 'dim' : 'live'} className="print:border-neutral-300 print:bg-white print:text-neutral-700">
            {report.session.status === 'ended' ? 'Session ended' : 'Session still running'}
          </Pill>
          <span className="text-sm text-fg-dim print:text-neutral-600">
            {formatWhen(report.session.startedAt, report.session.endedAt)}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-fg print:text-black">{report.session.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg-dim print:text-neutral-600">
          <span>
            Join code <JoinCode code={report.session.code} className="text-base print:text-black" />
          </span>
          <span className="tabular-nums">
            {report.session.participantCount} participant
            {report.session.participantCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* Actions (hidden in print) */}
        <div className="no-print mt-6 flex flex-wrap gap-3">
          <ExportButton href={`${exportBase}xlsx`}>Download XLSX</ExportButton>
          <ExportButton href={`${exportBase}csv`}>Download CSV</ExportButton>
          <ExportButton href={`${exportBase}pdf`}>Download PDF</ExportButton>
          <Button variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          {report.lms?.configured && (
            <Button variant="secondary" onClick={() => void pushLms()} disabled={lmsState === 'sending'}>
              {lmsState === 'sending' ? 'Sending to LMS…' : 'Send to LMS'}
            </Button>
          )}
        </div>
        {report.lms?.configured && (
          <p aria-live="polite" className="no-print mt-2 text-sm text-fg-dim">
            {lmsState === 'ok' && <span className="font-semibold text-emerald">Results delivered to your LMS ✓</span>}
            {lmsState === 'fail' && (
              <span className="font-semibold text-red">
                Delivery failed — check the LMS bridge settings in the deck editor.
              </span>
            )}
            {lmsState === 'idle' && report.lms.lastDelivery && (
              <>
                Last LMS push{' '}
                {report.lms.lastDelivery.ok ? 'delivered' : `failed (${report.lms.lastDelivery.error ?? report.lms.lastDelivery.status ?? 'error'})`}{' '}
                · {new Date(report.lms.lastDelivery.at).toLocaleString()}
              </>
            )}
          </p>
        )}
      </header>

      {/* Activity results */}
      <section aria-labelledby="report-activities" className="mb-10">
        <h2 id="report-activities" className="mb-4 text-xl font-bold text-fg print:text-black">
          Activity results
        </h2>
        {report.slides.length === 0 ? (
          <Card className="p-6 print:border-neutral-300 print:bg-white">
            <p className="text-sm text-fg-dim print:text-neutral-600">
              This deck had no interactive activities — nothing to aggregate.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {report.slides.map((s, i) => (
              <ResultCard key={s.id} slide={s} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Leaderboard */}
      <section aria-labelledby="report-leaderboard" className="mb-10 break-inside-avoid">
        <h2 id="report-leaderboard" className="mb-4 text-xl font-bold text-fg print:text-black">
          Leaderboard
        </h2>
        <LeaderboardTable entries={report.leaderboard} />
      </section>

      {/* Q&A */}
      <section aria-labelledby="report-qa" className="mb-10">
        <h2 id="report-qa" className="mb-4 text-xl font-bold text-fg print:text-black">
          Audience Q&amp;A
        </h2>
        <QaLog questions={report.questions} sessionId={sessionId} presenterKey={key} />
      </section>

      <footer className="border-t border-edge pt-4 text-xs text-fg-dim print:border-neutral-300 print:text-neutral-600">
        Generated by PulseDeck · session {report.session.code}
      </footer>
    </main>
  );
}
