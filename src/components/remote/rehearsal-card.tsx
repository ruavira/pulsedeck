'use client';
// Rehearsal mode: fills the room with phantom participants (sibling module's
// POST /api/presenter/[sessionId]/simulate) so the presenter can run the whole
// show — polls, quiz, Q&A — against realistic activity before doors open.

import { useState } from 'react';
import { Button, Card, Pill } from '@/components/shared/ui';

export function RehearsalCard({
  busy,
  simulate,
  resetRehearsal,
}: {
  busy: string | null;
  simulate: (n: number) => Promise<number | null>;
  resetRehearsal: () => Promise<number | null>;
}) {
  const [added, setAdded] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [removed, setRemoved] = useState<number | null>(null);
  const inFlight = busy === 'simulate';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-fg">Rehearsal mode</p>
        <Pill tone="accent">Practice</Pill>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-fg-dim">
        Adds phantom participants who vote in polls, answer quiz questions and ask
        Q&amp;A — so you can rehearse the full show with live-looking results.
      </p>
      <Button
        variant="secondary"
        size="lg"
        className="mt-3 w-full min-h-[56px]"
        disabled={busy !== null}
        onClick={async () => {
          setFailed(false);
          const n = await simulate(20);
          if (n === null) setFailed(true);
          else setAdded((prev) => (prev ?? 0) + n);
        }}
      >
        {inFlight ? 'Summoning the crowd…' : 'Simulate 20 participants'}
      </Button>
      <div aria-live="polite">
        {added !== null && !failed && (
          <p className="mt-2 text-sm font-semibold text-emerald">
            {added} phantom {added === 1 ? 'participant' : 'participants'} in the room —
            advance slides to watch activity roll in.
          </p>
        )}
        {failed && (
          <p className="mt-2 text-sm text-red" role="alert">
            Couldn&apos;t start the simulation — check your connection and try again.
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={busy !== null}
        className="mt-3 min-h-[44px] w-full rounded-full text-sm font-semibold text-fg-dim transition-colors hover:text-fg disabled:opacity-40"
        onClick={async () => {
          if (!confirmReset) {
            setConfirmReset(true);
            return;
          }
          const count = await resetRehearsal();
          setConfirmReset(false);
          if (count !== null) {
            setAdded(null);
            setRemoved(count);
          }
        }}
      >
        {busy === 'reset-rehearsal'
          ? 'Clearing practice data…'
          : confirmReset
            ? 'Confirm: remove simulated data only'
            : 'Clear rehearsal data'}
      </button>
      {removed !== null && (
        <p className="mt-2 text-sm font-semibold text-emerald" aria-live="polite">
          Rehearsal reset complete. {removed} simulated participant{removed === 1 ? '' : 's'} removed; real participants were untouched.
        </p>
      )}
    </Card>
  );
}
