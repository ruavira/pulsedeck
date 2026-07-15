'use client';
// Breathing slide on a phone: a small companion circle so the audience breathes
// along with the big screen. Same settings-driven phase machine as the stage
// (src/hooks/use-breathing-cycle), CSS transitions only — no animation library
// ships to phones. Reduced motion: no scaling, a dot row paces the phases.

import { useState } from 'react';
import type { Slide } from '@/lib/types';
import {
  BREATH_PHASE_WORDS,
  breathingConfig,
  useBreathingCycle,
} from '@/hooks/use-breathing-cycle';
import { prefersReducedMotion, PrivacyBadge } from './bits';

const CIRCLE_BG =
  'radial-gradient(circle at 50% 38%, color-mix(in oklab, var(--color-accent) 80%, var(--color-fg) 8%) 0%, color-mix(in oklab, var(--color-accent) 45%, transparent) 55%, color-mix(in oklab, var(--color-accent) 14%, transparent) 78%, transparent 100%)';

export function BreathingView({ slide }: { slide: Slide }) {
  const cfg = breathingConfig(slide.settings);
  // Snapshot once on mount — cheap, and this view lives for one slide only.
  const [reduced] = useState(prefersReducedMotion);
  const { phase, round, started } = useBreathingCycle(cfg);
  const done = phase === 'done';
  const grown = started && (phase === 'inhale' || phase === 'hold');
  const durSec =
    phase === 'inhale' ? cfg.inhaleSec : phase === 'exhale' ? cfg.exhaleSec : phase === 'hold' ? 0.4 : 1.6;
  const prompt = slide.body.prompt?.trim();

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      {!reduced ? (
        <div
          aria-hidden="true"
          className="shrink-0 rounded-full"
          style={{
            width: 'min(46vw, 240px)',
            height: 'min(46vw, 240px)',
            background: CIRCLE_BG,
            transform: grown ? 'scale(1)' : 'scale(0.55)',
            transition: `transform ${durSec}s ease-in-out`,
          }}
        />
      ) : (
        !done && (
          <div className="flex items-center gap-3" aria-hidden="true">
            {(cfg.holdSec > 0
              ? (['inhale', 'hold', 'exhale'] as const)
              : (['inhale', 'exhale'] as const)
            ).map((step) => (
              <span
                key={step}
                className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                  phase === step ? 'bg-accent' : 'bg-panel-2'
                }`}
              />
            ))}
          </div>
        )
      )}

      <p
        role="status"
        aria-live="polite"
        className={`text-2xl font-bold leading-snug ${done ? 'text-emerald' : 'text-fg'}`}
      >
        {BREATH_PHASE_WORDS[phase]}
      </p>

      {!done && (
        <p className="text-xs font-medium tabular-nums text-fg-dim">
          round {round} of {cfg.rounds}
        </p>
      )}

      {prompt && <p className="max-w-[240px] text-sm leading-relaxed text-fg-dim">{prompt}</p>}

      <div className="mt-2">
        <PrivacyBadge />
      </div>
    </section>
  );
}
