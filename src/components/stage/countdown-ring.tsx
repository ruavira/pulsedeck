'use client';
// Server-authoritative quiz countdown: remaining time is derived from the
// server-stamped phaseOpenedAt (+ measured clock skew), never a local timer start.

import { useEffect, useState } from 'react';

function remainingSeconds(openedAt: string, seconds: number, skewMs: number): number {
  const end = Date.parse(openedAt) + seconds * 1000;
  if (!Number.isFinite(end)) return 0;
  const serverNow = Date.now() + skewMs;
  return Math.max(0, (end - serverNow) / 1000);
}

export function CountdownRing({
  openedAt,
  seconds,
  skewMs = 0,
  size = 108,
}: {
  openedAt: string;
  seconds: number;
  skewMs?: number;
  size?: number;
}) {
  // Tick a clock; remaining time is derived during render (no setState-in-effect).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  void now; // re-render driver — remainingSeconds reads the live clock
  const remaining = remainingSeconds(openedAt, seconds, skewMs);

  const frac = seconds > 0 ? Math.min(1, remaining / seconds) : 0;
  const shown = Math.ceil(remaining);
  // Final-5-seconds urgency: ring + digits shift to amber and the digits
  // scale-pulse on every tick (CSS keyframes; suppressed under reduced motion).
  const urgent = remaining > 0 && remaining <= 5;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const stroke = remaining <= 10 ? 'var(--color-amber)' : 'var(--color-cyan)';

  return (
    <div
      role="timer"
      aria-label={`${shown} seconds remaining`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes pd-count-pulse { 0% { transform: scale(1.35); } 100% { transform: scale(1); } }
        @media (prefers-reduced-motion: no-preference) {
          .pd-count-urgent { animation: pd-count-pulse 0.45s ease-out; }
        }
      `}</style>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="var(--color-panel)" stroke="var(--color-edge)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 200ms linear, stroke 200ms linear' }}
        />
      </svg>
      <span
        // Re-keying per displayed second restarts the pulse on each tick.
        key={urgent ? `u-${shown}` : 'steady'}
        className={`absolute font-mono text-3xl font-bold tabular-nums ${
          urgent ? 'pd-count-urgent text-red' : 'text-fg'
        }`}
        aria-hidden="true"
      >
        {shown}
      </span>
    </div>
  );
}
