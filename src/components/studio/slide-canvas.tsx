'use client';
// 16:9 preview of the selected slide. A lightweight approximation of the stage renderer —
// deliberately independent from components/stage (owned by another module) but built on the
// same design tokens so the look matches. Uses container-query units so type scales with
// the canvas, like it will on a projector.

import type { CSSProperties } from 'react';
import type { ContentBlock, DeckTheme, Slide } from '@/lib/types';
import { KIND_META } from './slide-kinds';
import { IconCheck } from './icons';
import { useGoogleFonts } from '@/hooks/use-google-fonts';
import { fontStack } from '@/lib/font-pairings';

// Theme-aware backgrounds inlined so their var()s resolve in the current
// [data-theme] scope (a :root custom property would bake in the default palette).
const SURFACE_BG =
  'radial-gradient(1180px 780px at 12% -8%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 60%), radial-gradient(940px 720px at 108% 114%, color-mix(in oklab, var(--color-cyan) 13%, transparent), transparent 62%), var(--color-ink)';
const CARD_BG =
  'linear-gradient(145deg, color-mix(in oklab, var(--color-accent) 12%, var(--color-panel)) 0%, var(--color-panel) 60%)';

// Deterministic placeholder bar widths (percent) so previews look alive but stable.
const BAR_W = [78, 52, 64, 38, 58, 44, 70, 30];
const CLOUD_WORDS: { w: string; s: number; c: number }[] = [
  { w: 'ideas', s: 7, c: 1 },
  { w: 'energy', s: 5, c: 2 },
  { w: 'live', s: 9, c: 3 },
  { w: 'wow', s: 4, c: 4 },
  { w: 'insight', s: 6, c: 5 },
  { w: 'curious', s: 4, c: 2 },
  { w: 'bold', s: 5, c: 7 },
  { w: 'together', s: 3.4, c: 8 },
];

export function SlideCanvas({
  slide,
  theme,
  onPrev,
  onNext,
}: {
  slide: Slide;
  theme: DeckTheme;
  onPrev: () => void;
  onNext: () => void;
}) {
  const accent = slide.settings.accent || theme.accent || 'var(--color-accent)';
  useGoogleFonts([theme.fontHeading, theme.fontBody]);
  const hasBrandFont = !!(theme.fontHeading || theme.fontBody);
  // Preview reflects the deck's chosen theme pack, so the studio matches the stage.
  const pack = theme.pack;
  const dataTheme = pack && pack !== 'ice' ? pack : undefined;
  // Hero photo (background image + text blocks) → dark scrim + light text, matching the stage.
  const heroPhoto = !!slide.body.backgroundImage && (slide.body.blocks?.length ?? 0) > 0;
  return (
    <div
      tabIndex={0}
      role="group"
      data-theme={dataTheme}
      aria-label={`Preview of slide: ${slide.title || 'Untitled'}. Use arrow keys to switch slides.`}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          onPrev();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          onNext();
        }
      }}
      className={`@container relative mx-auto aspect-video w-full max-w-[960px] overflow-hidden rounded-xl border border-edge shadow-pop outline-offset-4${hasBrandFont ? ' pd-brandfont' : ''}`}
      style={
        {
          '--pd-accent': accent,
          background: slide.body.backgroundImage ? 'var(--color-ink)' : SURFACE_BG,
          ...(hasBrandFont
            ? {
                '--font-heading': fontStack(theme.fontHeading, 'heading'),
                '--font-body': fontStack(theme.fontBody, 'body'),
                fontFamily: fontStack(theme.fontBody, 'body'),
              }
            : {}),
        } as CSSProperties
      }
    >
      {slide.body.backgroundImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.body.backgroundImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={
              heroPhoto
                ? {
                    background:
                      'linear-gradient(to top, rgba(6,8,16,0.86) 0%, rgba(6,8,16,0.5) 50%, rgba(6,8,16,0.64) 100%)',
                  }
                : undefined
            }
            aria-hidden="true"
          >
            {!heroPhoto && <div className="h-full w-full bg-ink/30" />}
          </div>
        </>
      )}
      <div
        className="relative flex h-full w-full flex-col p-[4cqw]"
        style={
          heroPhoto
            ? ({ '--color-fg': '#ffffff', '--color-fg-dim': 'rgba(255,255,255,0.85)' } as CSSProperties)
            : undefined
        }
      >
        <SlideBody slide={slide} />
      </div>
      {theme.logoUrl && slide.kind === 'content' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.logoUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-[3cqw] top-[3cqw] z-20 h-[9cqw] w-auto object-contain opacity-90"
        />
      )}
      <JoinHint />
    </div>
  );
}

function JoinHint() {
  // Mirrors the live stage's bottom-left join chip: host + code (no corner QR —
  // the QR lives on the lobby, Join slides, and the press-Q spotlight).
  const host = typeof window !== 'undefined' ? window.location.host : 'pulsedeck';
  return (
    <div
      className="absolute bottom-[2cqw] left-[2cqw] flex items-center gap-[1.2cqw] rounded-full border border-edge bg-panel/85 px-[2cqw] py-[1cqw]"
      title="When live, your join host and 6-letter code show here"
    >
      <span className="text-[1.7cqw] font-medium text-fg-dim">{host}/j</span>
      <span className="text-fg-dim/50" aria-hidden="true">·</span>
      <span className="text-[1.9cqw] font-bold tracking-[0.18em] text-cyan">CODE</span>
    </div>
  );
}

function Prompt({ text }: { text?: string }) {
  return (
    <h3 className="text-[5cqw] font-bold leading-tight text-fg">
      {text?.trim() || <span className="text-fg-dim">Type a prompt in the panel →</span>}
    </h3>
  );
}

function RespondHint() {
  return (
    <p className="mt-[1cqw] text-[1.9cqw] font-medium text-cyan">Audience responds on their phones</p>
  );
}

function SlideBody({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case 'content':
      return <ContentPreview slide={slide} />;
    case 'poll':
    case 'quiz':
      return <ChoicePreview slide={slide} />;
    case 'ranking':
      return <RankingPreview slide={slide} />;
    case 'wordcloud':
      return <WordcloudPreview slide={slide} />;
    case 'scale':
      return <ScalePreview slide={slide} />;
    case 'open_text':
      return <OpenTextPreview slide={slide} />;
    case 'qa':
      return <QaPreview slide={slide} />;
    case 'timer':
      return <TimerPreview slide={slide} />;
    case 'breathing':
      return <BreathingPreview slide={slide} />;
    case 'join':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-white p-2" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className={`h-3.5 w-3.5 rounded-[2px] ${i % 2 === 0 ? 'bg-ink' : 'bg-white'}`} />
            ))}
          </div>
          <p className="text-lg font-bold text-fg">{slide.title || 'Join in — phones out'}</p>
          <p className="font-mono text-xl font-bold tracking-[0.25em] text-cyan">ABC123</p>
          <p className="text-xs text-fg-dim">Giant QR + code + live counter render on stage</p>
        </div>
      );
  }
}

// ---------- content ----------
function ContentPreview({ slide }: { slide: Slide }) {
  const blocks = slide.body.blocks ?? [];
  const layout = slide.settings.layout ?? 'title';
  if (blocks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-[3cqw] text-fg-dim">Empty slide — add blocks in the panel on the right.</p>
      </div>
    );
  }
  const centered = layout === 'title' || layout === 'statement';

  // ----- Designed: feature cards -----
  if (layout === 'cards') {
    const heading = blocks.find((b) => b.type === 'heading') as
      | Extract<ContentBlock, { type: 'heading' }>
      | undefined;
    const bulletsBlock = blocks.find((b) => b.type === 'bullets') as
      | Extract<ContentBlock, { type: 'bullets' }>
      | undefined;
    const textItems = blocks.filter((b) => b.type === 'text') as Extract<
      ContentBlock,
      { type: 'text' }
    >[];
    const items = bulletsBlock ? bulletsBlock.items.filter(Boolean) : textItems.map((b) => b.text);
    if (items.length >= 2) {
      const cols = items.length === 2 || items.length === 4 ? 'grid-cols-2' : 'grid-cols-3';
      return (
        <div className="flex flex-1 flex-col justify-center gap-[3cqw]">
          {heading && (
            <h3 className="text-[5cqw] font-extrabold leading-tight text-fg">{heading.text}</h3>
          )}
          <div className={`grid ${cols} gap-[2cqw]`}>
            {items.map((it, i) => (
              <div
                key={i}
                className="flex flex-col gap-[1.4cqw] rounded-lg border border-edge/70 p-[2cqw]"
                style={{ background: CARD_BG }}
              >
                <span className="flex h-[4cqw] w-[4cqw] items-center justify-center rounded-md bg-[var(--pd-accent)] text-[2cqw] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-[2.2cqw] leading-snug text-fg">{it}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // ----- Designed: stat row -----
  if (layout === 'stats') {
    const heading = blocks.find((b) => b.type === 'heading') as
      | Extract<ContentBlock, { type: 'heading' }>
      | undefined;
    const stats = blocks.filter((b) => b.type === 'bigStat') as Extract<
      ContentBlock,
      { type: 'bigStat' }
    >[];
    if (stats.length >= 2) {
      const cols = stats.length === 2 || stats.length === 4 ? 'grid-cols-2' : 'grid-cols-3';
      return (
        <div className="flex flex-1 flex-col justify-center gap-[3cqw]">
          {heading && (
            <h3 className="text-[5cqw] font-extrabold leading-tight text-fg">{heading.text}</h3>
          )}
          <div className={`grid ${cols} gap-[2cqw]`}>
            {stats.map((s, i) => (
              <div
                key={i}
                className="flex flex-col rounded-lg border border-edge/70 p-[2.4cqw]"
                style={{ background: CARD_BG }}
              >
                <span className="text-[7cqw] font-extrabold leading-none text-[var(--pd-accent)]">
                  {s.value || '—'}
                </span>
                {s.label && <span className="mt-[1cqw] text-[2cqw] text-fg-dim">{s.label}</span>}
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // ----- Designed: two columns -----
  if (layout === 'columns') {
    const heading = blocks.find((b) => b.type === 'heading') as
      | Extract<ContentBlock, { type: 'heading' }>
      | undefined;
    const rest = blocks.filter((b) => !(heading && b === heading));
    if (rest.length >= 2) {
      const mid = Math.ceil(rest.length / 2);
      return (
        <div className="flex flex-1 flex-col justify-center gap-[2.5cqw]">
          {heading && (
            <h3 className="text-[5cqw] font-extrabold leading-tight text-fg">{heading.text}</h3>
          )}
          <div className="grid grid-cols-2 gap-[3cqw]">
            <div className="space-y-[2cqw]">
              {rest.slice(0, mid).map((b, i) => (
                <BlockPreview key={i} block={b} />
              ))}
            </div>
            <div className="space-y-[2cqw]">
              {rest.slice(mid).map((b, i) => (
                <BlockPreview key={i} block={b} />
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  if (layout === 'split' && blocks.length > 1) {
    const mid = Math.ceil(blocks.length / 2);
    return (
      <div className="grid flex-1 grid-cols-2 items-center gap-[3cqw]">
        <div className="space-y-[2cqw]">
          {blocks.slice(0, mid).map((b, i) => (
            <BlockPreview key={i} block={b} />
          ))}
        </div>
        <div className="space-y-[2cqw]">
          {blocks.slice(mid).map((b, i) => (
            <BlockPreview key={i} block={b} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-1 flex-col gap-[2cqw] ${
        centered ? 'items-center justify-center text-center' : 'justify-center'
      }`}
    >
      {blocks.map((b, i) => (
        <BlockPreview key={i} block={b} />
      ))}
    </div>
  );
}

function BlockPreview({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="text-[6cqw] font-extrabold leading-tight text-fg">{block.text || 'Heading'}</h3>;
    case 'text':
      return <p className="whitespace-pre-wrap text-[2.6cqw] leading-relaxed text-fg/90">{block.text}</p>;
    case 'bullets':
      return (
        <ul className="space-y-[1cqw] text-left text-[2.6cqw] text-fg/90">
          {block.items.filter(Boolean).map((it, i) => (
            <li key={i} className="flex items-start gap-[1.2cqw]">
              <span
                aria-hidden="true"
                className="mt-[1cqw] h-[1.2cqw] w-[1.2cqw] shrink-0 rounded-full bg-[var(--pd-accent)]"
              />
              {it}
            </li>
          ))}
        </ul>
      );
    case 'image':
      return block.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.url}
          alt={block.alt ?? ''}
          className={`max-h-[52cqw] w-auto max-w-full rounded-lg ${
            block.fit === 'cover' ? 'object-cover' : 'object-contain'
          }`}
        />
      ) : (
        <div className="flex h-[24cqw] w-full items-center justify-center rounded-lg border border-dashed border-edge text-[2cqw] text-fg-dim">
          Image — paste a URL or upload
        </div>
      );
    case 'video':
      return (
        <div className="flex h-[26cqw] w-full items-center justify-center gap-[1.5cqw] rounded-lg bg-panel text-fg-dim">
          <span className="flex h-[6cqw] w-[6cqw] items-center justify-center rounded-full bg-[var(--pd-accent)] text-fg">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-[0.5cqw] h-[3cqw] w-[3cqw]">
              <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.5-6.86a1.03 1.03 0 0 0 0-1.76L9.56 4.26A1.03 1.03 0 0 0 8 5.14z" />
            </svg>
          </span>
          <span className="text-[2cqw]">
            {block.provider === 'youtube' ? 'YouTube video' : 'Video'}
            {block.url ? '' : ' — add a URL'}
          </span>
        </div>
      );
    case 'quote':
      return (
        <blockquote className="border-l-[0.6cqw] border-[var(--pd-accent)] pl-[2cqw] text-left">
          <p className="text-[3.4cqw] font-medium italic leading-snug text-fg">
            &ldquo;{block.text || 'Quote text'}&rdquo;
          </p>
          {block.attribution && <footer className="mt-[1cqw] text-[2cqw] text-fg-dim">— {block.attribution}</footer>}
        </blockquote>
      );
    case 'bigStat':
      return (
        <div>
          <p className="text-[11cqw] font-extrabold leading-none text-[var(--pd-accent)]">{block.value || '—'}</p>
          {block.label && <p className="mt-[1cqw] text-[2.4cqw] text-fg-dim">{block.label}</p>}
        </div>
      );
  }
}

// ---------- poll / quiz ----------
function ChoicePreview({ slide }: { slide: Slide }) {
  const options = slide.body.options ?? [];
  const correct = slide.kind === 'quiz' ? (slide.body.correct ?? []) : [];
  return (
    <div className="flex flex-1 flex-col justify-center">
      <Prompt text={slide.body.prompt} />
      <div className="mt-[3cqw] space-y-[1.6cqw]">
        {options.length === 0 && (
          <p className="text-[2.2cqw] text-fg-dim">Add options in the panel on the right.</p>
        )}
        {options.map((opt, i) => (
          <div key={i}>
            <div className="mb-[0.5cqw] flex items-center justify-between text-[2.2cqw] text-fg">
              <span className="flex items-center gap-[1cqw] font-medium">
                {opt.trim() || `Option ${i + 1}`}
                {correct.includes(i) && (
                  <span className="flex items-center gap-[0.5cqw] rounded-full bg-emerald/15 px-[1.2cqw] py-[0.3cqw] text-[1.6cqw] font-bold text-emerald">
                    <IconCheck width={12} height={12} className="h-[1.6cqw] w-[1.6cqw]" /> Correct
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="tabular-nums text-fg-dim">
                —
              </span>
            </div>
            <div className="h-[2.6cqw] overflow-hidden rounded-full bg-panel">
              <div
                className="h-full rounded-full opacity-70"
                style={{
                  width: `${BAR_W[i % BAR_W.length]}%`,
                  backgroundColor: `var(--chart-${(i % 8) + 1})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {slide.kind === 'quiz' && (
        <p className="mt-[2cqw] text-[1.9cqw] text-fg-dim">
          Timed · {slide.settings.timeLimitSec ?? 30}s · {slide.settings.points ?? 1000} pts — bars show a live
          results preview
        </p>
      )}
      {slide.kind === 'poll' && <RespondHint />}
    </div>
  );
}

// ---------- ranking ----------
function RankingPreview({ slide }: { slide: Slide }) {
  const options = slide.body.options ?? [];
  return (
    <div className="flex flex-1 flex-col justify-center">
      <Prompt text={slide.body.prompt} />
      <ol className="mt-[3cqw] space-y-[1.4cqw]">
        {options.map((opt, i) => (
          <li key={i} className="flex items-center gap-[1.6cqw]">
            <span className="flex h-[4cqw] w-[4cqw] shrink-0 items-center justify-center rounded-full bg-panel text-[2cqw] font-bold text-[var(--pd-accent)]">
              {i + 1}
            </span>
            <div className="flex h-[4cqw] flex-1 items-center rounded-lg bg-panel px-[1.6cqw] text-[2.2cqw] text-fg">
              {opt.trim() || `Item ${i + 1}`}
            </div>
          </li>
        ))}
      </ol>
      <RespondHint />
    </div>
  );
}

// ---------- wordcloud ----------
function WordcloudPreview({ slide }: { slide: Slide }) {
  return (
    <div className="flex flex-1 flex-col">
      <Prompt text={slide.body.prompt} />
      <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-x-[3cqw] gap-y-[1cqw]">
        {CLOUD_WORDS.map(({ w, s, c }) => (
          <span
            key={w}
            aria-hidden="true"
            className="font-bold leading-none opacity-80"
            style={{ fontSize: `${s}cqw`, color: `var(--chart-${c})` }}
          >
            {w}
          </span>
        ))}
      </div>
      <p className="text-[1.9cqw] text-fg-dim">
        Placeholder cloud — audience words appear live · up to {slide.settings.maxWords ?? 3} words each
      </p>
    </div>
  );
}

// ---------- scale ----------
function ScalePreview({ slide }: { slide: Slide }) {
  const min = slide.body.min ?? 1;
  const max = slide.body.max ?? 5;
  return (
    <div className="flex flex-1 flex-col justify-center">
      <Prompt text={slide.body.prompt} />
      <div className="mt-[6cqw]">
        <div className="relative h-[1.4cqw] rounded-full bg-panel">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-[var(--pd-accent)] opacity-70"
            style={{ width: '62%' }}
          />
          <div
            aria-hidden="true"
            className="absolute top-1/2 h-[4cqw] w-[4cqw] -translate-y-1/2 rounded-full border-[0.4cqw] border-ink bg-[var(--pd-accent)]"
            style={{ left: '62%', transform: 'translate(-50%, -50%)' }}
          />
        </div>
        <div className="mt-[1.6cqw] flex justify-between text-[2.2cqw] text-fg-dim">
          <span>
            {min} {slide.body.minLabel && `· ${slide.body.minLabel}`}
          </span>
          <span className="font-semibold text-fg">avg — live</span>
          <span>
            {slide.body.maxLabel && `${slide.body.maxLabel} · `}
            {max}
          </span>
        </div>
      </div>
      <RespondHint />
    </div>
  );
}

// ---------- open text ----------
function OpenTextPreview({ slide }: { slide: Slide }) {
  return (
    <div className="flex flex-1 flex-col">
      <Prompt text={slide.body.prompt} />
      <div className="mt-[3cqw] grid flex-1 grid-cols-3 content-start gap-[1.6cqw]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-[1cqw] rounded-lg bg-panel p-[1.6cqw]">
            <div className="h-[1.4cqw] w-4/5 rounded bg-panel-2" />
            <div className="h-[1.4cqw] w-3/5 rounded bg-panel-2" />
          </div>
        ))}
      </div>
      <p className="text-[1.9cqw] text-fg-dim">Answers appear as cards on the wall</p>
      <RespondHint />
    </div>
  );
}

// ---------- timer ----------
function TimerPreview({ slide }: { slide: Slide }) {
  const duration = Math.max(0, Math.round(slide.settings.durationSec ?? 300));
  const mm = String(Math.floor(duration / 60)).padStart(2, '0');
  const ss = String(duration % 60).padStart(2, '0');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[2cqw] text-center">
      <p className="text-[2.6cqw] font-semibold text-fg-dim">
        {slide.settings.timerLabel?.trim() || slide.title || 'Back in'}
      </p>
      <p className="text-[16cqw] font-bold leading-none tabular-nums text-fg">
        {mm}:{ss}
      </p>
      <div className="h-[1cqw] w-[55cqw] overflow-hidden rounded-full bg-panel" aria-hidden="true">
        <div className="h-full w-[62%] rounded-full bg-[var(--pd-accent)] opacity-80" />
      </div>
      <p className="mt-[1cqw] text-[1.9cqw] text-fg-dim">
        Counts down automatically on stage · click the stage (or press T) to restart
      </p>
    </div>
  );
}

// ---------- breathing ----------
function BreathingPreview({ slide }: { slide: Slide }) {
  const rounds = slide.settings.rounds ?? 5;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[2cqw] text-center">
      <div
        aria-hidden="true"
        className="h-[24cqw] w-[24cqw] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, color-mix(in oklab, var(--pd-accent) 80%, var(--color-fg) 8%) 0%, color-mix(in oklab, var(--pd-accent) 45%, transparent) 55%, transparent 100%)',
        }}
      />
      <p className="text-[4.5cqw] font-bold text-fg">Breathe in</p>
      <p className="text-[1.9cqw] tabular-nums text-fg-dim">round 1 of {rounds}</p>
      {slide.body.prompt?.trim() && (
        <p className="max-w-[60cqw] text-[2.2cqw] text-fg-dim">{slide.body.prompt}</p>
      )}
      <p className="text-[1.9cqw] text-fg-dim">
        The circle grows and shrinks with the inhale/hold/exhale timings — audience phones breathe along
      </p>
    </div>
  );
}

// ---------- qa ----------
function QaPreview({ slide }: { slide: Slide }) {
  const meta = KIND_META.qa;
  return (
    <div className="flex flex-1 flex-col">
      <h3 className="flex items-center gap-[1.5cqw] text-[5cqw] font-bold text-fg">
        <meta.icon className="h-[4cqw] w-[4cqw] text-[var(--pd-accent)]" /> {slide.title || 'Q&A'}
      </h3>
      <div className="mt-[3cqw] space-y-[1.6cqw]" aria-hidden="true">
        {[
          { q: 'Audience questions show up here…', v: 12 },
          { q: '…sorted by upvotes', v: 7 },
        ].map(({ q, v }) => (
          <div key={q} className="flex items-center gap-[2cqw] rounded-lg bg-panel p-[2cqw]">
            <span className="flex flex-col items-center text-[1.8cqw] font-bold text-cyan">
              ▲<span className="tabular-nums">{v}</span>
            </span>
            <span className="text-[2.4cqw] text-fg/90">{q}</span>
          </div>
        ))}
      </div>
      <p className="mt-auto text-[1.9cqw] text-fg-dim">Moderate from your phone remote when live</p>
    </div>
  );
}
