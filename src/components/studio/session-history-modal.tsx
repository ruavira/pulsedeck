'use client';
// Session history: lists every session ever run from this deck (newest first) with a
// status pill, participant count and quick links to the stage, remote and report.
// Data comes from GET /api/decks/[id]/sessions/list (x-presenter-key auth).

import { useEffect, useState } from 'react';
import { Button, Pill, Spinner } from '@/components/shared/ui';
import { Modal } from './modal';
import { relativeTime } from './studio-api';
import { IconExternal } from './icons';

export interface SessionListItem {
  id: string;
  code: string;
  status: 'lobby' | 'live' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

type FetchState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'ready'; sessions: SessionListItem[] };

function StatusPill({ status }: { status: SessionListItem['status'] }) {
  if (status === 'live') return <Pill tone="live">● LIVE</Pill>;
  if (status === 'ended') return <Pill tone="dim">Ended</Pill>;
  return <Pill>Lobby</Pill>;
}

function RowLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-fg-dim transition-colors hover:bg-panel hover:text-fg"
    >
      <IconExternal width={13} height={13} /> {label}
    </a>
  );
}

export function SessionHistoryModal({
  open,
  onClose,
  deckId,
  presenterKey,
}: {
  open: boolean;
  onClose: () => void;
  deckId: string;
  presenterKey: string;
}) {
  const [state, setState] = useState<FetchState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ phase: 'loading' });
    fetch(`/api/decks/${deckId}/sessions/list`, {
      headers: { 'x-presenter-key': presenterKey },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`list_failed_${res.status}`);
        return (await res.json()) as { sessions?: SessionListItem[] };
      })
      .then((data) => {
        if (!cancelled) setState({ phase: 'ready', sessions: data.sessions ?? [] });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [open, deckId, presenterKey, attempt]);

  const keyQ = `?key=${encodeURIComponent(presenterKey)}`;

  return (
    <Modal open={open} onClose={onClose} title="Sessions" wide>
      <div aria-live="polite">
        {state.phase === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-12 text-fg-dim">
            <Spinner /> Loading sessions…
          </div>
        )}

        {state.phase === 'error' && (
          <div className="py-8 text-center">
            <p role="alert" className="text-sm text-fg">
              Couldn&rsquo;t load this deck&rsquo;s sessions — check your connection.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Try again
            </Button>
          </div>
        )}

        {state.phase === 'ready' && state.sessions.length === 0 && (
          <p className="py-12 text-center text-sm text-fg-dim">
            No sessions yet — hit Present.
          </p>
        )}

        {state.phase === 'ready' && state.sessions.length > 0 && (
          <ul role="list" className="space-y-2.5">
            {state.sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-edge bg-panel-2/60 px-4 py-3"
              >
                <span
                  className="font-mono text-sm font-bold tracking-[0.2em] text-cyan"
                  aria-label={`Join code ${s.code.split('').join(' ')}`}
                >
                  {s.code}
                </span>
                <StatusPill status={s.status} />
                <span className="text-xs text-fg-dim">
                  {s.participantCount} joined
                  {s.startedAt ? ` · started ${relativeTime(s.startedAt)}` : ''}
                  {s.endedAt ? ` · ended ${relativeTime(s.endedAt)}` : ''}
                </span>
                <span className="ml-auto flex flex-wrap gap-1">
                  <RowLink href={`/present/${s.id}${keyQ}`} label="Stage" />
                  <RowLink href={`/remote/${s.id}${keyQ}`} label="Remote" />
                  <RowLink href={`/report/${s.id}${keyQ}`} label="Report" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
