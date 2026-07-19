'use client';
// One-tap pace / comprehension signals + raise hand. A no-words way to tell the
// presenter "slow down / I'm lost / raise hand". Anonymous, throttled, ephemeral
// (broadcast only — never stored). The stage aggregates these into a live mood.

import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from './bits';

const SIGNALS: { kind: string; emoji: string; label: string }[] = [
  { kind: 'got_it', emoji: '👍', label: 'Got it' },
  { kind: 'slow', emoji: '🐢', label: 'Slow down' },
  { kind: 'lost', emoji: '🤔', label: "I'm lost" },
  { kind: 'fast', emoji: '⚡', label: 'Speed up' },
  { kind: 'hand', emoji: '✋', label: 'Raise hand' },
];

const THROTTLE_MS = 1500;

export function SignalBar({ broadcast }: { broadcast: (event: string, payload: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const last = useRef(0);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(sentTimer.current), []);

  const tap = useCallback((kind: string, label: string) => {
    const now = Date.now();
    if (now - last.current < THROTTLE_MS) return;
    last.current = now;
    broadcast('signal', { kind });
    haptic(20);
    setSent(label);
    clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => setSent(null), 1600);
    setOpen(false);
  }, [broadcast]);

  return (
    <div className="fixed bottom-24 left-4 z-30 flex flex-col items-start gap-2">
      {sent && (
        <span
          role="status"
          className="rounded-full border border-emerald/40 bg-emerald/10 px-3 py-1.5 text-xs font-semibold text-emerald"
        >
          Sent: {sent}
        </span>
      )}
      {open && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-edge bg-panel p-2 shadow-pop">
          {SIGNALS.map((s) => (
            <button
              key={s.kind}
              type="button"
              onClick={() => tap(s.kind, s.label)}
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-fg hover:bg-panel-2"
            >
              <span className="text-lg" aria-hidden="true">
                {s.emoji}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label="Signal the presenter"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-edge bg-panel text-xl shadow-pop transition-transform active:scale-95"
      >
        {open ? '×' : '✋'}
      </button>
    </div>
  );
}
