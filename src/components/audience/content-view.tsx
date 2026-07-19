'use client';
// Content slide on a phone. Default = calm "eyes up front" state. But anyone who
// can't read a far screen (big room, back row, low vision) can tap "Follow along"
// to mirror the slide's text on their own device, with a text-size control.

import { useState } from 'react';
import type { ContentBlock, Slide } from '@/lib/types';
import { PrivacyBadge } from './bits';

/** Pull the readable text out of a content block (skips media). */
function blockText(b: ContentBlock): { kind: string; lines: string[] } | null {
  switch (b.type) {
    case 'heading':
      return { kind: 'heading', lines: [b.text] };
    case 'text':
      return { kind: 'text', lines: [b.text] };
    case 'bullets':
      return { kind: 'bullets', lines: b.items };
    case 'quote':
      return { kind: 'quote', lines: [b.text, b.attribution ? `— ${b.attribution}` : ''].filter(Boolean) };
    case 'bigStat':
      return { kind: 'stat', lines: [b.value, b.label ?? ''].filter(Boolean) };
    default:
      return null; // image / video — nothing to read
  }
}

const SIZES = ['text-base', 'text-lg', 'text-xl'] as const;

export function ContentView({ slide, deckTitle }: { slide: Slide; deckTitle: string }) {
  const [follow, setFollow] = useState(false);
  const [size, setSize] = useState(1); // index into SIZES

  const blocks = (slide.body.blocks ?? []).map(blockText).filter(Boolean) as {
    kind: string;
    lines: string[];
  }[];
  const hasText = !!slide.title || blocks.length > 0;

  if (follow) {
    return (
      <section className="flex flex-1 flex-col py-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-fg-dim">
            Following along
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Smaller text"
              onClick={() => setSize((s) => Math.max(0, s - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-panel text-sm font-bold text-fg disabled:opacity-40"
              disabled={size === 0}
            >
              A−
            </button>
            <button
              type="button"
              aria-label="Larger text"
              onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-panel text-base font-bold text-fg disabled:opacity-40"
              disabled={size === SIZES.length - 1}
            >
              A+
            </button>
          </div>
        </div>

        <div className={`flex flex-col gap-4 ${SIZES[size]} leading-relaxed text-fg`}>
          {slide.title && !blocks.some((b) => b.kind === 'heading') && (
            <h1 className="text-2xl font-bold leading-snug">{slide.title}</h1>
          )}
          {blocks.map((b, i) => {
            if (b.kind === 'heading')
              return (
                <h2 key={i} className="text-2xl font-bold leading-snug">
                  {b.lines[0]}
                </h2>
              );
            if (b.kind === 'bullets')
              return (
                <ul key={i} className="flex flex-col gap-2">
                  {b.lines.map((l, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span
                        className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              );
            if (b.kind === 'quote')
              return (
                <blockquote key={i} className="border-l-4 border-accent pl-4 italic text-fg-dim">
                  {b.lines.map((l, j) => (
                    <p key={j}>{l}</p>
                  ))}
                </blockquote>
              );
            if (b.kind === 'stat')
              return (
                <div key={i}>
                  <div className="text-3xl font-extrabold text-accent">{b.lines[0]}</div>
                  {b.lines[1] && <div className="text-sm text-fg-dim">{b.lines[1]}</div>}
                </div>
              );
            return (
              <p key={i}>
                {b.lines.map((l, j) => (
                  <span key={j}>{l}</span>
                ))}
              </p>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setFollow(false)}
          className="mt-6 inline-flex min-h-[44px] items-center self-start rounded-full border border-edge bg-panel px-4 py-2 text-sm font-semibold text-fg-dim hover:text-fg"
        >
          ← Eyes up front
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <span className="relative mb-8 flex h-4 w-4" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-4 w-4 rounded-full bg-accent" />
      </span>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-dim">{deckTitle}</p>
      <h1 className="mb-4 max-w-xs text-2xl font-bold leading-snug text-fg">
        {slide.title || 'On the big screen'}
      </h1>
      <p role="status" aria-live="polite" className="mb-6 text-sm text-fg-dim">
        Eyes up front — the action is on the big screen. Your phone will light up when it&apos;s
        your turn.
      </p>
      {hasText && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-accent bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent"
        >
          📖 Follow along on my phone
        </button>
      )}
      <PrivacyBadge />
    </section>
  );
}
