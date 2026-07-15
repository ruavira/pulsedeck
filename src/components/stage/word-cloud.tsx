'use client';
// Deterministic word cloud — zero layout dependencies. Words sorted by count,
// sized on a sqrt scale (20–96px), arranged center-out (biggest lands mid-array,
// centered flex rows put it in the middle of the screen). Colors rotate the
// chart palette keyed by a stable word hash so colors never jump between polls.
// New words fade in. One-tap toggle to a ranked list view.

import { useMemo, useState } from 'react';

const MAX_WORDS = 60;
const MIN_PX = 20;
const MAX_PX = 96;

function wordHash(w: string): number {
  let h = 0;
  for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) >>> 0;
  return h % 8;
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M6 5h11M6 10h11M6 15h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="2.6" cy="5" r="1.3" fill="currentColor" />
      <circle cx="2.6" cy="10" r="1.3" fill="currentColor" />
      <circle cx="2.6" cy="15" r="1.3" fill="currentColor" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5.5 15a3.5 3.5 0 01-.4-6.98A5 5 0 0114.6 9.1 3 3 0 0114 15H5.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WordCloud({ words, total }: { words: Record<string, number>; total: number }) {
  const [listView, setListView] = useState(false);

  const sorted = useMemo(
    () =>
      Object.entries(words)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, MAX_WORDS),
    [words],
  );

  // Center-out packing: alternate push/unshift so the biggest word sits mid-array.
  const arranged = useMemo(() => {
    const arr: Array<[string, number]> = [];
    sorted.forEach((entry, i) => {
      if (i % 2 === 0) arr.push(entry);
      else arr.unshift(entry);
    });
    return arr;
  }, [sorted]);

  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
  const minCount = sorted.length > 0 ? sorted[sorted.length - 1][1] : 1;
  const span = Math.sqrt(maxCount) - Math.sqrt(minCount);

  const sizeFor = (count: number) => {
    if (span <= 0) return sorted.length <= 3 ? 72 : 44;
    return Math.round(MIN_PX + ((Math.sqrt(count) - Math.sqrt(minCount)) / span) * (MAX_PX - MIN_PX));
  };

  return (
    <div className="relative flex h-full w-full flex-col">
      <style>{`@keyframes pd-word-in { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }`}</style>

      <button
        type="button"
        onClick={() => setListView((v) => !v)}
        aria-pressed={listView}
        className="absolute right-0 top-0 z-10 inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border border-edge bg-panel px-4 py-2 text-sm font-semibold text-fg-dim transition-colors hover:text-fg focus-visible:text-fg"
      >
        {listView ? <CloudIcon /> : <ListIcon />}
        {listView ? 'Cloud view' : 'List view'}
      </button>

      <div className="min-h-0 flex-1 overflow-hidden" aria-live="polite" aria-atomic="false">
        {listView ? (
          <div className="mx-auto grid h-full max-w-5xl grid-cols-1 content-center gap-x-12 gap-y-2 md:grid-cols-2">
            {sorted.slice(0, 20).map(([w, c], i) => (
              <div
                key={w}
                className="flex min-h-[44px] items-center gap-4 border-b border-edge/60 pb-1 text-[clamp(1.15rem,1.9vw,1.6rem)]"
              >
                <span className="w-9 shrink-0 font-mono text-fg-dim tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-fg">{w}</span>
                <span className="shrink-0 font-mono font-bold tabular-nums" style={{ color: `var(--chart-${wordHash(w) + 1})` }}>
                  {c}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-wrap content-center items-baseline justify-center gap-x-6 gap-y-2 px-2">
            {arranged.map(([w, c]) => (
              // Keyed by word: the CSS animation runs once when a word first
              // mounts (new word), and never restarts for words that persist.
              <span
                key={w}
                className="max-w-full truncate font-bold leading-tight"
                style={{
                  fontSize: `${sizeFor(c)}px`,
                  color: `var(--chart-${wordHash(w) + 1})`,
                  animation: 'pd-word-in 350ms ease-out both',
                }}
                aria-label={`${w}: ${c}`}
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="sr-only">{total} total submissions</p>
    </div>
  );
}
