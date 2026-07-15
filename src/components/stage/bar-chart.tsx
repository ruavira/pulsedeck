'use client';
// Stage horizontal bar chart for poll / quiz / ranking results.
// Label + count + % are ALWAYS visible (never color-only meaning). Bars animate
// width via CSS transitions. Rows are sorted by count (leaders rise to the top)
// and glide to their new positions via framer-motion layout animations —
// position-only, so labels and counts stay crisp (no scale distortion).
// Quiz reveal: correct options go emerald with an explicit "Correct" mark,
// wrong options dim. Reduced motion disables the glide.

import { motion, useReducedMotion } from 'framer-motion';

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-[1em] w-[1em] ${className}`} aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface BarChartProps {
  options: string[];
  counts: Record<string, number>;
  total: number;
  /** Quiz reveal mode: highlight correct, dim wrong. */
  reveal?: boolean;
  /** Indexes of correct options (quiz). */
  correct?: number[];
  /** Optional per-option thumbnail images (picture polls). */
  optionImages?: string[];
}

export function BarChart({
  options,
  counts,
  total,
  reveal = false,
  correct = [],
  optionImages,
}: BarChartProps) {
  const reduced = useReducedMotion();
  const max = Math.max(1, ...options.map((_, i) => counts[String(i)] ?? 0));

  // Sort by count descending; ties keep option order so rows never jitter.
  const rows = options
    .map((label, i) => ({ label, i, count: counts[String(i)] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.i - b.i);

  return (
    <div className="flex w-full flex-col justify-center gap-4" role="list" aria-label="Live results by option">
      {rows.map(({ label, i, count }) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const width = count > 0 ? Math.max(6, (count / max) * 100) : 0;
        const isCorrect = correct.includes(i);
        const dimmed = reveal && correct.length > 0 && !isCorrect;

        return (
          <motion.div
            key={i}
            layout={reduced ? false : 'position'}
            transition={{ layout: { duration: 0.45, ease: 'easeOut' } }}
            role="listitem"
            aria-label={`${label}: ${count} responses, ${pct} percent${reveal && isCorrect ? ', correct answer' : ''}`}
            className={`transition-opacity duration-300 ${dimmed ? 'opacity-40' : 'opacity-100'}`}
          >
            <div
              className={`relative min-h-[56px] w-full overflow-hidden rounded-xl border bg-panel ${
                reveal && isCorrect ? 'border-emerald' : 'border-edge'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-r-xl transition-[width] duration-500 ease-out"
                style={{
                  width: `${width}%`,
                  background: reveal && isCorrect ? 'var(--color-emerald)' : `var(--chart-${(i % 8) + 1})`,
                  opacity: reveal && isCorrect ? 0.95 : 0.8,
                }}
                aria-hidden="true"
              />
              <div className="relative flex min-h-[56px] items-center justify-between gap-6 px-5 py-2">
                <span className="flex min-w-0 items-center gap-3 text-[clamp(1.25rem,2.2vw,1.9rem)] font-semibold leading-tight text-fg [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
                  {reveal && isCorrect && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink/60 px-3 py-1 text-[0.55em] font-bold uppercase tracking-wider text-emerald">
                      <CheckIcon /> Correct
                    </span>
                  )}
                  {optionImages?.[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={optionImages[i]}
                      alt=""
                      aria-hidden="true"
                      className="h-[2em] w-[2em] shrink-0 rounded-lg object-cover shadow"
                    />
                  )}
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 font-mono text-[clamp(1.1rem,1.8vw,1.6rem)] font-bold tabular-nums text-fg [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
                  {count} <span className="text-fg-dim">·</span> {pct}%
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
