'use client';
// Full-screen break/exercise countdown for 'timer' slides. Starts automatically
// on mount from settings.durationSec; the whole slide is a giant restart button
// (click anywhere, or press T). Final 10 seconds shift amber with a gentle
// scale pulse (color-only under prefers-reduced-motion); at zero an emerald
// "Time!" state flashes once and the timer stops until restarted.

import { useCallback, useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Slide } from '@/lib/types';

function fmt(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerSlide({ slide }: { slide: Slide }) {
  const durationSec = Math.max(
    1,
    Math.round(
      typeof slide.settings.durationSec === 'number' && Number.isFinite(slide.settings.durationSec)
        ? slide.settings.durationSec
        : 300,
    ),
  );
  const label = slide.settings.timerLabel?.trim() || slide.title || 'Back in';
  const reduced = useReducedMotion();

  // endAt anchors the countdown; restarting just moves the anchor.
  const [endAt, setEndAt] = useState<number>(() => Date.now() + durationSec * 1000);
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    const tick = () => setRemaining(Math.min(durationSec, Math.max(0, Math.ceil((endAt - Date.now()) / 1000))));
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [endAt, durationSec]);

  const restart = useCallback(() => {
    setEndAt(Date.now() + durationSec * 1000);
    setRemaining(durationSec);
  }, [durationSec]);

  // 'T' restarts — self-contained listener with the same guards as the stage
  // keyboard handler (never fires while typing, never eats modifier chords).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 't' && e.key !== 'T') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  const done = remaining <= 0;
  const closing = !done && remaining <= 10;
  const frac = Math.min(1, Math.max(0, remaining / durationSec));
  // Progress color drifts accent → amber as time depletes.
  const barColor = `color-mix(in oklab, var(--color-amber) ${Math.round((1 - frac) * 100)}%, var(--color-accent))`;

  return (
    <button
      type="button"
      onClick={restart}
      aria-label="Restart timer (or press T)"
      className="relative flex h-full w-full cursor-pointer appearance-none flex-col items-center justify-center gap-[4vh] border-0 bg-transparent px-[6vw] text-center outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-inset"
    >
      <style>{`
        @keyframes pd-timer-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
        @keyframes pd-timer-flash { 0% { opacity: 0.55; } 100% { opacity: 0; } }
      `}</style>

      {/* One-shot soft flash when the countdown completes (motion-safe only). */}
      {done && !reduced && (
        <div
          key={endAt}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-emerald"
          style={{ animation: 'pd-timer-flash 900ms ease-out forwards' }}
        />
      )}

      <p className="text-[clamp(1.5rem,3vw,2.5rem)] font-semibold text-fg-dim [text-wrap:balance]">
        {label}
      </p>

      <p
        role="timer"
        className={`font-bold leading-none tabular-nums [font-size:clamp(6rem,20vw,16rem)] ${
          done ? 'text-emerald' : closing ? 'text-red' : 'text-fg'
        }`}
        style={
          closing && !reduced
            ? { animation: 'pd-timer-pulse 1s ease-in-out infinite' }
            : undefined
        }
      >
        {done ? 'Time!' : fmt(remaining)}
      </p>

      {/* Thin progress bar under the digits, draining left to right. */}
      <div
        className="h-2 w-[min(60vw,720px)] overflow-hidden rounded-full bg-panel-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={durationSec}
        aria-valuenow={remaining}
        aria-label="Time remaining"
      >
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{ width: `${frac * 100}%`, backgroundColor: done ? 'var(--color-emerald)' : barColor }}
        />
      </div>

      <p className="text-[clamp(0.9rem,1.4vw,1.2rem)] font-medium text-fg-dim/80">
        {done ? 'Click anywhere to restart' : 'Click or press T to restart'}
      </p>

      {/* Announce completion politely; the ticking digits stay silent. */}
      <span role="status" aria-live="polite" className="sr-only">
        {done ? 'Time is up' : ''}
      </span>
    </button>
  );
}
