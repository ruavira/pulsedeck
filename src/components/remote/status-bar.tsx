'use client';
// Sticky top status bar: join code (big), live participant count (polled 5s),
// connection indicator (never color-only), and a ⋯ menu toggle for extras
// (rehearsal mode while live).

import { JoinCode, Pill } from '@/components/shared/ui';
import type { SessionStatus } from '@/lib/types';
import { useRemoteParticipantCount } from './use-remote-polls';

export function StatusBar({
  sessionId,
  code,
  status,
  connected,
  extrasOpen,
  onToggleExtras,
}: {
  sessionId: string;
  code: string;
  status: SessionStatus;
  connected: boolean;
  extrasOpen: boolean;
  onToggleExtras: () => void;
}) {
  const count = useRemoteParticipantCount(status === 'ended' ? null : sessionId);

  return (
    <header className="sticky top-0 z-20 border-b border-edge bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <JoinCode code={code} className="text-[26px] leading-none" />
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-fg-dim">
              Join code
            </span>
            {status === 'lobby' && <Pill tone="accent">Lobby</Pill>}
            {status === 'live' && <Pill tone="live">Live</Pill>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right" aria-live="polite">
            <div className="text-xl font-bold text-fg tabular-nums">
              {count ?? '–'}
            </div>
            <div className="text-[11px] text-fg-dim">joined</div>
          </div>

          <div role="status" className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${
                connected ? 'bg-emerald' : 'bg-amber animate-pulse'
              }`}
            />
            <span className="text-[10px] text-fg-dim">
              {connected ? 'Live' : 'Reconnecting'}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleExtras}
            aria-expanded={extrasOpen}
            aria-label="More options"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-panel-2 text-xl font-bold text-fg transition-all duration-150 active:scale-95 hover:border-accent/60"
          >
            <span aria-hidden="true">⋯</span>
          </button>
        </div>
      </div>
    </header>
  );
}
