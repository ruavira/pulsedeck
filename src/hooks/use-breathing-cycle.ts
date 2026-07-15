'use client';
// Shared state machine for 'breathing' slides: inhale → hold → exhale, repeated
// settings.rounds times, then 'done'. Pure JS timers driven by the per-phase
// durations from slide settings — rendering (CSS transitions) stays in the
// consuming components, so the audience bundle ships no animation library.
// Used by both the stage view and the audience companion view so the two
// screens breathe in the same rhythm.

import { useEffect, useState } from 'react';
import type { SlideSettings } from '@/lib/types';

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'done';

export interface BreathingConfig {
  rounds: number;
  inhaleSec: number;
  holdSec: number;
  exhaleSec: number;
}

/** On-screen word for each phase. */
export const BREATH_PHASE_WORDS: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
  done: 'Well done.',
};

const clampNum = (v: number | undefined, fallback: number, min: number, max: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
};

/** Normalize slide settings into safe, bounded breathing timings. */
export function breathingConfig(settings: SlideSettings): BreathingConfig {
  return {
    rounds: clampNum(settings.rounds, 5, 1, 12),
    inhaleSec: clampNum(settings.inhaleSec, 4, 1, 30),
    // hold may be 0 (skipped entirely)
    holdSec: clampNum(settings.holdSec, 4, 0, 30),
    exhaleSec: clampNum(settings.exhaleSec, 6, 1, 30),
  };
}

export interface BreathingCycle {
  phase: BreathPhase;
  /** 1-based; stays at the final round once done. */
  round: number;
  /**
   * False only for the very first paint: consumers should render the circle
   * small until started, so the first inhale animates via CSS transition
   * instead of mounting fully grown.
   */
  started: boolean;
}

/** Auto-starts on mount; advances phases on the configured durations. */
export function useBreathingCycle(cfg: BreathingConfig): BreathingCycle {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<{ phase: BreathPhase; round: number }>({
    phase: 'inhale',
    round: 1,
  });

  // Arm one tick after first paint so the initial inhale transitions from small.
  useEffect(() => {
    const t = window.setTimeout(() => setStarted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const { rounds, inhaleSec, holdSec, exhaleSec } = cfg;
  const { phase, round } = state;

  useEffect(() => {
    if (!started || phase === 'done') return;
    const sec = phase === 'inhale' ? inhaleSec : phase === 'hold' ? holdSec : exhaleSec;
    const t = window.setTimeout(() => {
      setState((cur) => {
        switch (cur.phase) {
          case 'inhale':
            return { ...cur, phase: holdSec > 0 ? 'hold' : 'exhale' };
          case 'hold':
            return { ...cur, phase: 'exhale' };
          case 'exhale':
            return cur.round >= rounds
              ? { ...cur, phase: 'done' }
              : { phase: 'inhale', round: cur.round + 1 };
          default:
            return cur;
        }
      });
    }, Math.max(0.5, sec) * 1000);
    return () => window.clearTimeout(t);
  }, [started, phase, round, rounds, inhaleSec, holdSec, exhaleSec]);

  return { phase, round, started };
}
