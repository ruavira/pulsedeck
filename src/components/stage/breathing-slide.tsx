'use client';
// Guided breathing on the big screen for 'breathing' slides. A JS phase state
// machine (src/hooks/use-breathing-cycle) drives CSS transitions whose
// transition-duration is set per phase, so the inhale/hold/exhale lengths from
// slide settings are respected exactly — no fixed keyframes. Under
// prefers-reduced-motion the circle never scales: a progress dot row paces the
// same durations instead.

import { useReducedMotion } from 'framer-motion';
import type { Slide } from '@/lib/types';
import {
  BREATH_PHASE_WORDS,
  breathingConfig,
  useBreathingCycle,
  type BreathPhase,
  type BreathingConfig,
} from '@/hooks/use-breathing-cycle';

const CIRCLE_BG =
  'radial-gradient(circle at 50% 38%, color-mix(in oklab, var(--color-accent) 80%, var(--color-fg) 8%) 0%, color-mix(in oklab, var(--color-accent) 45%, transparent) 55%, color-mix(in oklab, var(--color-accent) 14%, transparent) 78%, transparent 100%)';

/** Dot row pacing the phases for reduced-motion users (no scaling anywhere). */
function DotRow({ phase, cfg }: { phase: BreathPhase; cfg: BreathingConfig }) {
  const steps: { key: BreathPhase; word: string }[] = [
    { key: 'inhale', word: BREATH_PHASE_WORDS.inhale },
    ...(cfg.holdSec > 0 ? [{ key: 'hold' as const, word: BREATH_PHASE_WORDS.hold }] : []),
    { key: 'exhale', word: BREATH_PHASE_WORDS.exhale },
  ];
  return (
    <div className="flex items-center gap-[2.5vmin]" aria-hidden="true">
      {steps.map((s) => (
        <span
          key={s.key}
          className={`h-[2.4vmin] w-[2.4vmin] rounded-full transition-colors duration-300 ${
            phase === s.key ? 'bg-accent' : 'bg-panel-2'
          }`}
        />
      ))}
    </div>
  );
}

export function BreathingSlide({ slide }: { slide: Slide }) {
  const cfg = breathingConfig(slide.settings);
  const reduced = useReducedMotion();
  const { phase, round, started } = useBreathingCycle(cfg);
  const done = phase === 'done';
  const grown = started && (phase === 'inhale' || phase === 'hold');
  // Per-phase transition duration — this is what makes settings-driven pacing work.
  const durSec =
    phase === 'inhale' ? cfg.inhaleSec : phase === 'exhale' ? cfg.exhaleSec : phase === 'hold' ? 0.4 : 1.6;
  const prompt = slide.body.prompt?.trim();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[4.5vh] px-[8vw] text-center">
      {!reduced ? (
        <div
          aria-hidden="true"
          className="shrink-0 rounded-full"
          style={{
            width: '34vmin',
            height: '34vmin',
            background: CIRCLE_BG,
            boxShadow: '0 0 120px color-mix(in oklab, var(--color-accent) 30%, transparent)',
            transform: grown ? 'scale(1)' : 'scale(0.55)',
            transition: `transform ${durSec}s ease-in-out`,
          }}
        />
      ) : (
        !done && <DotRow phase={phase} cfg={cfg} />
      )}

      <p
        role="status"
        aria-live="polite"
        className={`font-bold leading-[1.1] [font-size:clamp(2.5rem,6vw,5rem)] [text-wrap:balance] ${
          done ? 'text-emerald' : 'text-fg'
        }`}
      >
        {BREATH_PHASE_WORDS[phase]}
      </p>

      {!done && (
        <p className="text-[clamp(1rem,1.8vw,1.5rem)] font-medium tabular-nums text-fg-dim">
          round {round} of {cfg.rounds}
        </p>
      )}

      {prompt && (
        <p className="max-w-4xl text-[clamp(1.1rem,2vw,1.7rem)] leading-relaxed text-fg-dim [text-wrap:balance]">
          {prompt}
        </p>
      )}
    </div>
  );
}
