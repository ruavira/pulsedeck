'use client';
// Open-text slide: masonry-ish card wall (CSS columns), newest first, ~24 visible.

import type { OpenTextResults } from '@/lib/types';

const MAX_VISIBLE = 24;

export function OpenTextWall({ results }: { results: OpenTextResults }) {
  const entries = results.entries.slice(0, MAX_VISIBLE);

  return (
    <div className="h-full w-full overflow-hidden" aria-live="polite" aria-atomic="false">
      <style>{`@keyframes pd-card-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>
      <div className="h-full columns-2 gap-5 xl:columns-3 [column-fill:balance]">
        {entries.map((e, i) => (
          <div
            key={`${i}-${e.text.slice(0, 24)}`}
            className="mb-5 break-inside-avoid rounded-2xl border border-edge bg-panel px-6 py-5"
            style={{ animation: i === 0 ? 'pd-card-in 300ms ease-out both' : undefined }}
          >
            <p className="text-[clamp(1.15rem,1.8vw,1.6rem)] font-medium leading-snug text-fg [overflow-wrap:anywhere]">
              {e.text}
            </p>
          </div>
        ))}
      </div>
      {results.total > MAX_VISIBLE && (
        <p className="sr-only">Showing the latest {MAX_VISIBLE} of {results.total} responses</p>
      )}
    </div>
  );
}
