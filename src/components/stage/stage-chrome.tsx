'use client';
// Persistent stage chrome: bottom-left join ritual (QR + host + code),
// top-right participant count + connection badge, bottom-right progress.
// Collapses to a mini QR on content slides after idle; always full on
// interactive slides.

import { JoinCode } from '@/components/shared/ui';
import { joinHost } from './join-qr';
import { useParticipantCount } from './use-participant-count';

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 14.7c2.3.2 4 1.5 4.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function StageChrome({
  sessionId,
  code,
  connected,
  index,
  total,
}: {
  sessionId: string;
  code: string;
  connected: boolean;
  index: number;
  total: number;
  mini?: boolean;
}) {
  const participants = useParticipantCount(sessionId, 5000);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Top-right: participants + connection */}
      <div className="absolute right-6 top-6 flex items-center gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-edge bg-panel/90 px-4 py-2 text-base font-semibold text-fg backdrop-blur-sm"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${participants ?? 0} participants joined`}
        >
          <PeopleIcon />
          <span className="font-mono tabular-nums">{participants ?? '—'}</span>
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest backdrop-blur-sm ${
            connected
              ? 'border-emerald/50 bg-panel/90 text-emerald'
              : 'border-amber/50 bg-panel/90 text-amber'
          }`}
          role="status"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald' : 'animate-pulse bg-amber'}`}
            aria-hidden="true"
          />
          {connected ? 'Live' : 'Reconnecting'}
        </span>
      </div>

      {/* Bottom-left: slim join chip — never a QR, never covers content.
          The big join ritual lives on the lobby, Join slides, and the Q overlay. */}
      <div className="absolute bottom-6 left-6">
        <div className="flex items-center gap-2.5 rounded-full border border-edge bg-panel/90 px-4 py-2 backdrop-blur-sm">
          <span className="text-sm font-medium text-fg-dim">{joinHost()}/j</span>
          <span className="text-fg-dim/50" aria-hidden="true">·</span>
          <JoinCode code={code} className="text-xl" />
        </div>
      </div>

      {/* Bottom-right: slide progress */}
      <div
        className="absolute bottom-6 right-6 rounded-full border border-edge bg-panel/90 px-4 py-2 font-mono text-base font-semibold tabular-nums text-fg-dim backdrop-blur-sm"
        aria-label={`Slide ${index + 1} of ${total}`}
      >
        {index + 1} <span className="text-fg-dim/60">/</span> {total}
      </div>
    </div>
  );
}
