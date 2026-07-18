'use client';
// Pre-show lobby (the join wave moment) and the session-ended screen.

import { JoinCode } from '@/components/shared/ui';
import { JoinQr, joinHost } from './join-qr';
import { useParticipantCount } from './use-participant-count';

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[1em] w-[1em]" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 14.7c2.3.2 4 1.5 4.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Lobby({
  sessionId,
  code,
  deckTitle,
  connected,
  logoUrl,
  orgName,
}: {
  sessionId: string;
  code: string;
  deckTitle: string;
  connected: boolean;
  logoUrl?: string;
  orgName?: string;
}) {
  // Faster poll in the lobby so the counter visibly ticks as the room fills.
  const participants = useParticipantCount(sessionId, 2500);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3.5vh] overflow-hidden px-[6vw] text-center">
      <style>{`@keyframes pd-lobby-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>

      <span
        className={`absolute right-6 top-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest ${
          connected ? 'border-emerald/50 text-emerald' : 'border-amber/50 text-fg'
        }`}
        role="status"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald' : 'animate-pulse bg-amber'}`} aria-hidden="true" />
        {connected ? 'Live' : 'Reconnecting'}
      </span>

      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={orgName ? `${orgName} logo` : 'Organizer logo'}
          className="absolute left-6 top-6 max-h-[9vh] max-w-[22vw] object-contain"
        />
      )}

      <h1 className="max-w-[80vw] text-[clamp(2rem,5vw,4rem)] font-bold leading-tight text-fg">{deckTitle}</h1>
      {orgName && (
        <p className="-mt-[1.5vh] text-[clamp(1rem,2vw,1.5rem)] font-medium text-fg-dim">
          Presented by <span className="font-semibold text-fg">{orgName}</span>
        </p>
      )}

      <p className="text-[clamp(1.25rem,2.5vw,2rem)] font-medium text-fg-dim">
        Join at <span className="font-semibold text-fg">{joinHost()}/j</span>
      </p>

      <JoinQr code={code} size={280} pad={16} />

      <JoinCode code={code} className="text-[clamp(2.5rem,7vw,5.5rem)]" />

      <div
        className="flex items-center gap-3 text-[clamp(1.25rem,2.5vw,2rem)] font-semibold text-fg"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="text-cyan"><PeopleIcon /></span>
        <span className="font-mono tabular-nums">{participants ?? 0}</span>
        <span className="text-fg-dim">{(participants ?? 0) === 1 ? 'person is in' : 'people are in'}</span>
      </div>

      <p
        className="text-sm font-medium uppercase tracking-[0.25em] text-fg-dim"
        style={{ animation: 'pd-lobby-pulse 2.4s ease-in-out infinite' }}
      >
        Press → or Space to start the show
      </p>
    </div>
  );
}

export function EndedScreen({
  sessionId,
  deckTitle,
}: {
  sessionId: string;
  deckTitle: string;
}) {
  const participants = useParticipantCount(sessionId, 60000);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3vh] overflow-hidden px-[6vw] text-center">
      <p className="text-base font-bold uppercase tracking-[0.3em] text-accent">Session ended</p>
      <h1 className="max-w-[80vw] text-[clamp(2.5rem,6vw,5rem)] font-bold leading-tight text-fg">
        That&rsquo;s a wrap
      </h1>
      <p className="text-[clamp(1.25rem,2.5vw,2rem)] text-fg-dim">
        Thanks for playing <span className="font-semibold text-fg">{deckTitle}</span>
        {participants !== null && participants > 0 && (
          <>
            {' '}
            with <span className="font-mono font-bold tabular-nums text-cyan">{participants}</span>{' '}
            {participants === 1 ? 'participant' : 'participants'}
          </>
        )}
        .
      </p>
      <p className="text-base text-fg-dim">
        The full results report is waiting in the studio.
      </p>
    </div>
  );
}
