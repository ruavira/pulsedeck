'use client';
// Scale slide on stage: one giant average number + a distribution histogram.

import type { ScaleResults } from '@/lib/types';

export function ScaleView({
  results,
  min,
  max,
  minLabel,
  maxLabel,
}: {
  results: ScaleResults;
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}) {
  const lo = Number.isFinite(min) ? Math.round(min) : 1;
  const hi = Number.isFinite(max) && max > lo ? Math.round(max) : lo + 4;
  const steps: number[] = [];
  for (let v = lo; v <= hi && steps.length < 15; v++) steps.push(v);

  const maxCount = Math.max(1, ...steps.map((v) => results.counts[String(v)] ?? 0));
  const avg = typeof results.avg === 'number' && Number.isFinite(results.avg) ? results.avg : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-[4vh]">
      <div className="text-center">
        <div
          className="font-bold leading-none text-accent tabular-nums [font-size:clamp(4rem,12vw,9rem)]"
          aria-label={avg !== null ? `Average ${avg.toFixed(1)}` : 'No average yet'}
        >
          {avg !== null ? avg.toFixed(1) : '—'}
        </div>
        <div className="mt-2 text-[clamp(1rem,1.6vw,1.4rem)] font-semibold uppercase tracking-[0.2em] text-fg-dim">
          average of {results.total} {results.total === 1 ? 'response' : 'responses'}
        </div>
      </div>

      <div className="w-full max-w-4xl">
        <div className="flex h-[26vh] items-end justify-center gap-[1.5vw]" role="list" aria-label="Response distribution">
          {steps.map((v) => {
            const count = results.counts[String(v)] ?? 0;
            const h = count > 0 ? Math.max(8, (count / maxCount) * 100) : 0;
            return (
              <div
                key={v}
                role="listitem"
                aria-label={`${v}: ${count} responses`}
                className="flex h-full w-full max-w-[88px] flex-col items-center justify-end gap-2"
              >
                <span className="font-mono text-[clamp(0.9rem,1.4vw,1.25rem)] font-bold tabular-nums text-fg">
                  {count}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg transition-[height] duration-500 ease-out"
                    style={{ height: `${h}%`, background: 'var(--color-cyan)', opacity: 0.85, minHeight: count > 0 ? 8 : 2 }}
                    aria-hidden="true"
                  />
                </div>
                <span className="font-mono text-[clamp(1rem,1.6vw,1.4rem)] font-semibold tabular-nums text-fg-dim">
                  {v}
                </span>
              </div>
            );
          })}
        </div>
        {(minLabel || maxLabel) && (
          <div className="mt-3 flex justify-between text-[clamp(0.95rem,1.5vw,1.3rem)] font-medium text-fg-dim">
            <span>{minLabel ?? ''}</span>
            <span>{maxLabel ?? ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
