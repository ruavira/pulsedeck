'use client';
// Per-activity result card for the post-session report.
// Deliberately light + print-friendly: pure CSS bars, no chart lib, no motion lib.

import { Card, Pill } from '@/components/shared/ui';
import type { SlideKind } from '@/lib/types';
import type { ReportSlide } from './types';

const KIND_LABEL: Record<SlideKind, string> = {
  content: 'Slide',
  poll: 'Poll',
  quiz: 'Quiz',
  wordcloud: 'Word cloud',
  qa: 'Q&A',
  scale: 'Scale',
  ranking: 'Ranking',
  open_text: 'Open text',
  timer: 'Timer',
  breathing: 'Breathing',
  join: 'Join',
};

const chartColor = (i: number) => `var(--chart-${(i % 8) + 1})`;

function Bar({
  label,
  count,
  total,
  color,
  correct,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  correct?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-fg print:text-black min-w-0 break-words">
          {label}
          {correct && (
            <span className="ml-2 font-semibold text-emerald print:text-black">✓ correct</span>
          )}
        </span>
        <span className="shrink-0 tabular-nums text-fg-dim print:text-neutral-600">
          {count} · {pct}%
        </span>
      </div>
      <div
        className="mt-1 h-3 w-full overflow-hidden rounded-full bg-panel-2 print:bg-neutral-100"
        role="img"
        aria-label={`${label}: ${count} of ${total} responses (${pct}%)`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ChoiceBars({ slide }: { slide: ReportSlide }) {
  if (slide.results.kind !== 'poll' && slide.results.kind !== 'quiz' && slide.results.kind !== 'ranking')
    return null;
  const { counts, total } = slide.results;
  const options = slide.options ?? [];
  const correct = new Set(slide.correct ?? []);
  // Include any counted keys that fall outside the option list (defensive).
  const extraKeys = Object.keys(counts).filter((k) => {
    const n = Number(k);
    return !Number.isInteger(n) || n < 0 || n >= options.length;
  });
  return (
    <div className="space-y-3">
      {options.map((opt, i) => (
        <Bar
          key={i}
          label={opt || `Option ${i + 1}`}
          count={counts[String(i)] ?? 0}
          total={total}
          color={chartColor(i)}
          correct={correct.has(i)}
        />
      ))}
      {extraKeys.map((k, i) => (
        <Bar key={k} label={`Answer ${k}`} count={counts[k]} total={total} color={chartColor(options.length + i)} />
      ))}
    </div>
  );
}

function WordList({ slide }: { slide: ReportSlide }) {
  if (slide.results.kind !== 'wordcloud') return null;
  const entries = Object.entries(slide.results.words).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <EmptyNote>No words were submitted.</EmptyNote>;
  const max = entries[0][1];
  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map(([word, count], i) => (
        <li
          key={word}
          className="rounded-full border border-edge bg-panel-2 px-3 py-1 print:border-neutral-300 print:bg-white"
          style={{ fontSize: `${Math.round(13 + 9 * (count / max))}px` }}
        >
          <span className="font-medium" style={{ color: `var(--chart-${(i % 8) + 1})` }}>
            {word}
          </span>
          <span className="ml-1.5 text-xs tabular-nums text-fg-dim print:text-neutral-600">×{count}</span>
        </li>
      ))}
    </ul>
  );
}

function ScaleSummary({ slide }: { slide: ReportSlide }) {
  if (slide.results.kind !== 'scale') return null;
  const { avg, counts, total } = slide.results;
  const min = slide.min ?? 1;
  const max = slide.max ?? 10;
  const values: number[] = [];
  for (let v = min; v <= max && values.length < 25; v++) values.push(v);
  return (
    <div>
      <p className="mb-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums text-accent print:text-black">{avg}</span>
        <span className="text-sm text-fg-dim print:text-neutral-600">
          average of {total} rating{total === 1 ? '' : 's'} · scale {min}
          {slide.minLabel ? ` (${slide.minLabel})` : ''} – {max}
          {slide.maxLabel ? ` (${slide.maxLabel})` : ''}
        </span>
      </p>
      <div className="space-y-2">
        {values.map((v, i) => (
          <Bar key={v} label={String(v)} count={counts[String(v)] ?? 0} total={total} color={chartColor(i)} />
        ))}
      </div>
    </div>
  );
}

function OpenTextList({ slide }: { slide: ReportSlide }) {
  if (slide.results.kind !== 'open_text') return null;
  const { entries, total } = slide.results;
  if (entries.length === 0) return <EmptyNote>No answers were submitted.</EmptyNote>;
  return (
    <div>
      <ul className="space-y-2">
        {entries.map((e, i) => (
          <li
            key={i}
            className="rounded-xl border border-edge bg-panel-2 px-4 py-2.5 text-sm text-fg print:border-neutral-300 print:bg-white print:text-black"
          >
            {e.text}
          </li>
        ))}
      </ul>
      {total > entries.length && (
        <p className="mt-2 text-xs text-fg-dim print:text-neutral-600">
          Showing {entries.length} of {total} answers — download the XLSX for the full set.
        </p>
      )}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-fg-dim print:text-neutral-600">{children}</p>;
}

export function ResultCard({ slide, index }: { slide: ReportSlide; index: number }) {
  const total = slide.results.total;
  return (
    <Card className="break-inside-avoid p-5 print:border-neutral-300 print:bg-white sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone="accent" className="print:border-neutral-400 print:bg-white print:text-black">
          {KIND_LABEL[slide.kind]}
        </Pill>
        <span className="text-xs text-fg-dim print:text-neutral-600">Activity {index + 1}</span>
        <span className="ml-auto text-xs tabular-nums text-fg-dim print:text-neutral-600">
          {total} response{total === 1 ? '' : 's'}
        </span>
      </div>
      <h3 className="mb-4 text-lg font-semibold text-fg print:text-black">
        {slide.prompt || slide.title || 'Untitled activity'}
      </h3>
      {total === 0 ? (
        <EmptyNote>No responses were recorded for this activity.</EmptyNote>
      ) : (
        <>
          <ChoiceBars slide={slide} />
          <WordList slide={slide} />
          <ScaleSummary slide={slide} />
          <OpenTextList slide={slide} />
        </>
      )}
    </Card>
  );
}
