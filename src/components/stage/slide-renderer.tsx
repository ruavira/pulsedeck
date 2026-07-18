'use client';
// Full-screen, 16:9-safe renderer for every SlideKind. Nothing ever scrolls.
// Content slides render ContentBlock[] per settings.layout; interactive slides
// show the prompt as a headline plus live results (bars / cloud / scale /
// card wall / Q&A). Enter animation per settings.animation via framer-motion,
// disabled under prefers-reduced-motion.

import { motion, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import type {
  ContentBlock,
  DeckTheme,
  Phase,
  Results,
  Slide,
} from '@/lib/types';
import { JoinCode } from '@/components/shared/ui';
import { BarChart } from './bar-chart';
import { WordCloud } from './word-cloud';
import { ScaleView } from './scale-view';
import { OpenTextWall } from './open-text-wall';
import { QaWall } from './qa-wall';
import { CountdownRing } from './countdown-ring';
import { TimerSlide } from './timer-slide';
import { BreathingSlide } from './breathing-slide';
import { JoinSlide } from './join-slide';
import { joinHost } from './join-qr';
import { detectVideoProvider, embedUrl, providerLabel } from '@/lib/video';
import { useGoogleFonts } from '@/hooks/use-google-fonts';
import { fontStack } from '@/lib/font-pairings';

// Theme-aware backgrounds, declared inline (NOT via a :root custom property).
// CSS resolves the nested var()s inside a custom property at its *declaration*
// scope — a `--surface-gradient` defined at :root bakes in the default palette
// and never re-resolves under [data-theme]. Used directly in a real `background`
// on an element inside the themed subtree, these re-color per pack correctly.
const SURFACE_BG =
  'radial-gradient(1180px 780px at 12% -8%, color-mix(in oklab, var(--color-accent) 16%, transparent), transparent 60%), radial-gradient(940px 720px at 108% 114%, color-mix(in oklab, var(--color-cyan) 13%, transparent), transparent 62%), var(--color-ink)';
const CARD_BG =
  'linear-gradient(145deg, color-mix(in oklab, var(--color-accent) 12%, var(--color-panel)) 0%, var(--color-panel) 60%)';

// ---------- markdown-lite (**bold**, *italic*, line breaks) ----------

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderText(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i, all) => (
    <span key={i}>
      {renderInline(line)}
      {i < all.length - 1 && <br />}
    </span>
  ));
}

// ---------- element build animations ----------

// Per-element staggered entrance, used when a slide's `buildAnimation` is on.
// Transform + opacity only (no layout-affecting props) so FitBox's zoom
// measurement stays stable. The delay starts just after the whole-slide enter
// (~0.2s) and steps per index. Returns {} when off → the element renders static.
// Reduced-motion is handled upstream (build is forced false).
function buildItemProps(build: boolean, i: number) {
  if (!build) return {};
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.34, ease: 'easeOut', delay: 0.18 + i * 0.09 },
  } as const;
}

// ---------- content blocks ----------

function BlockView({
  block,
  big = false,
  build = false,
}: {
  block: ContentBlock;
  big?: boolean;
  build?: boolean;
}) {
  switch (block.type) {
    case 'heading':
      return (
        <h2 className="font-bold leading-[1.05] text-fg [font-size:clamp(2.5rem,7vw,6rem)] [text-wrap:balance]">
          {renderInline(block.text)}
        </h2>
      );
    case 'text':
      return (
        <p className={`leading-snug text-fg ${big ? '[font-size:clamp(2rem,4vw,3.25rem)]' : '[font-size:clamp(2rem,3vw,2.6rem)]'}`}>
          {renderText(block.text)}
        </p>
      );
    case 'bullets':
      return (
        <ul className="flex flex-col gap-[1.5vh] [font-size:clamp(2rem,3vw,2.6rem)] leading-snug text-fg">
          {block.items.map((item, i) => (
            <motion.li key={i} className="flex items-start gap-4" {...buildItemProps(build, i)}>
              <span className="mt-[0.55em] h-[0.35em] w-[0.35em] shrink-0 rounded-full bg-(--slide-accent)" aria-hidden="true" />
              <span>{renderInline(item)}</span>
            </motion.li>
          ))}
        </ul>
      );
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.url}
          alt={block.alt ?? ''}
          className={`max-h-full max-w-full rounded-2xl ${block.fit === 'cover' ? 'h-full w-full object-cover' : 'object-contain'}`}
          draggable={false}
        />
      );
    case 'video': {
      // Re-detect from the URL so pasted links always get the right player,
      // even if the stored provider is stale. Supports YouTube, Vimeo, Loom,
      // and direct video files (incl. uploads to our own storage).
      const provider = detectVideoProvider(block.url);
      if (provider !== 'mp4') {
        const src = embedUrl(provider, block.url, block.autoplay);
        if (!src) {
          return (
            <p className="text-xl text-fg-dim">
              Video unavailable — unrecognized {providerLabel[provider]} link.
            </p>
          );
        }
        return (
          <iframe
            src={src}
            title="Slide video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="aspect-video h-auto max-h-full w-full rounded-2xl border border-edge bg-black"
          />
        );
      }
      return (
        <video
          src={block.url}
          controls
          muted
          playsInline
          autoPlay={block.autoplay ?? false}
          className="max-h-full max-w-full rounded-2xl bg-black object-contain"
        />
      );
    }
    case 'quote':
      return (
        <figure className="relative max-w-5xl">
          <span
            aria-hidden="true"
            className="absolute -top-[5vh] left-0 select-none font-bold leading-none [font-size:clamp(5rem,13vw,11rem)]"
            style={{ color: 'color-mix(in oklab, var(--slide-accent) 22%, transparent)' }}
          >
            &ldquo;
          </span>
          <blockquote className="relative border-l-4 border-(--slide-accent) pl-8 italic leading-snug text-fg [font-size:clamp(2rem,4vw,3.25rem)] [text-wrap:balance]">
            &ldquo;{renderInline(block.text)}&rdquo;
          </blockquote>
          {block.attribution && (
            <figcaption className="mt-[2vh] pl-8 text-[clamp(1.25rem,2vw,1.75rem)] font-semibold text-fg-dim">
              — {block.attribution}
            </figcaption>
          )}
        </figure>
      );
    case 'bigStat':
      return (
        <div>
          <div className="font-bold leading-none tabular-nums text-(--slide-accent) [font-size:clamp(4rem,12vw,9rem)]">
            {block.value}
          </div>
          {block.label && (
            <div className="mt-[1.5vh] text-[clamp(1.4rem,2.5vw,2.25rem)] font-medium text-fg-dim">
              {block.label}
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}

const isMedia = (b: ContentBlock) => b.type === 'image' || b.type === 'video';

// ---------- designed-layout building blocks ----------

/** Static Tailwind column classes (JIT can't see interpolated class names). */
function gridColsFor(n: number): string {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-2';
  if (n === 4) return 'grid-cols-2';
  if (n >= 5) return 'grid-cols-3';
  return 'grid-cols-3'; // 3
}

/** A stat rendered as a card, for the 'stats' row layout. */
function StatCard({ value, label }: { value: string; label?: string }) {
  return (
    <div
      className="flex flex-col items-start justify-center rounded-3xl border border-edge/70 px-[3vw] py-[4vh] shadow-pop"
      style={{ background: CARD_BG }}
    >
      <div className="font-bold leading-none tabular-nums text-(--slide-accent) [font-size:clamp(2.75rem,7vw,5.5rem)]">
        {value}
      </div>
      {label && (
        <div className="mt-[1.5vh] text-[clamp(1.05rem,2vw,1.6rem)] font-medium leading-snug text-fg-dim">
          {label}
        </div>
      )}
    </div>
  );
}

/** A single item rendered as a numbered feature card, for the 'cards' layout. */
function FeatureCard({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-[1.8vh] rounded-3xl border border-edge/70 p-[2.4vw] shadow-soft"
      style={{ background: CARD_BG }}
    >
      <span className="flex h-[clamp(2.4rem,4vw,3.4rem)] w-[clamp(2.4rem,4vw,3.4rem)] items-center justify-center rounded-2xl bg-(--slide-accent) font-bold text-white [font-size:clamp(1.1rem,2vw,1.6rem)]">
        {index}
      </span>
      <p className="leading-snug text-fg [font-size:clamp(1.2rem,2.1vw,1.9rem)]">{children}</p>
    </div>
  );
}

const isHeading = (b: ContentBlock): b is Extract<ContentBlock, { type: 'heading' }> =>
  b.type === 'heading';
const isBigStat = (b: ContentBlock): b is Extract<ContentBlock, { type: 'bigStat' }> =>
  b.type === 'bigStat';

/**
 * PowerPoint-style autofit: if a slide's content is taller/wider than the
 * viewport (imported decks carry long text), scale it down to fit.
 * The stage NEVER scrolls. Re-measures on slide change and window resize.
 */
function FitBox({ fitKey, children }: { fitKey: string; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;

    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const fits = () => {
      // Overflow check with centering neutralized (justify-center hides
      // top-overflow from scrollHeight).
      i.style.justifyContent = 'flex-start';
      const ok =
        i.scrollHeight <= o.clientHeight + 2 && i.scrollWidth <= o.clientWidth + 2;
      i.style.justifyContent = '';
      return ok;
    };
    const measure = () => {
      // CSS zoom re-flows layout (unlike transform), so nested h-full grids
      // and centered columns shrink coherently. Step down until it fits.
      let z = 1;
      i.style.zoom = '1';
      while (!fits() && z > 0.42) {
        z = Math.round(z * 0.94 * 1000) / 1000;
        i.style.zoom = String(z);
      }
      setScale(z);
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    schedule();
    // Images load late and change content height — re-measure on media loads
    // (capture: 'load' does not bubble) and on settle timers.
    o.addEventListener('load', schedule, true);
    timers.push(setTimeout(schedule, 400), setTimeout(schedule, 1500));

    const ro = new ResizeObserver(schedule);
    ro.observe(o);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      o.removeEventListener('load', schedule, true);
      ro.disconnect();
    };
  }, [fitKey]);

  return (
    <div ref={outer} className="h-full w-full overflow-hidden">
      <div
        ref={inner}
        className="flex h-full w-full flex-col justify-center"
        style={scale < 1 ? ({ zoom: scale } as React.CSSProperties) : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function ContentSlideView({ slide, build = false }: { slide: Slide; build?: boolean }) {
  const layout = slide.settings.layout ?? 'full';
  // Contract healing: content producers (studio, imports, demo deck) put the
  // headline in slide.title. If no heading block exists, inject one so the
  // title always renders. ('media' overlays the heading itself; 'statement'
  // uses its first line.)
  let blocks = slide.body.blocks ?? [];
  const hasHeading = blocks.some((b) => b.type === 'heading');
  if (slide.title && !hasHeading && layout !== 'statement' && blocks.length > 0) {
    blocks = [{ type: 'heading', text: slide.title }, ...blocks];
  }

  if (blocks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-[8vw]">
        <h2 className="text-center font-bold leading-[1.05] text-fg [font-size:clamp(2.5rem,7vw,6rem)] [text-wrap:balance]">
          {slide.title || 'PulseDeck'}
        </h2>
      </div>
    );
  }

  if (layout === 'statement') {
    const first = blocks[0];
    const line =
      first.type === 'heading' || first.type === 'text' || first.type === 'quote' ? first : null;
    return (
      <div className="flex h-full items-center justify-center px-[8vw] text-center">
        <p className="font-bold leading-[1.08] text-fg [font-size:clamp(2.5rem,7vw,6rem)] [text-wrap:balance]">
          {line ? renderInline(line.text) : slide.title}
        </p>
      </div>
    );
  }

  if (layout === 'media') {
    const media = blocks.find(isMedia);
    const heading = blocks.find(
      (b): b is Extract<ContentBlock, { type: 'heading' }> => b.type === 'heading',
    );
    return (
      <div className="relative h-full w-full">
        {media ? (
          <div className="absolute inset-0 flex items-center justify-center [&>img]:h-full [&>img]:w-full [&>img]:rounded-none [&>img]:object-cover [&>video]:h-full [&>video]:w-full [&>video]:rounded-none [&>iframe]:h-full [&>iframe]:rounded-none">
            <BlockView block={media} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-fg-dim">No media on this slide</div>
        )}
        {heading && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 via-ink/50 to-transparent px-[6vw] pb-[6vh] pt-[14vh]">
            <h2 className="font-bold leading-[1.05] text-fg [font-size:clamp(2rem,5vw,4rem)] [text-wrap:balance]">
              {renderInline(heading.text)}
            </h2>
          </div>
        )}
      </div>
    );
  }

  // ----- Designed: feature cards (bullets/text items → card grid) -----
  if (layout === 'cards') {
    const heading = blocks.find(isHeading);
    const bulletsBlock = blocks.find(
      (b): b is Extract<ContentBlock, { type: 'bullets' }> => b.type === 'bullets',
    );
    const textItems = blocks.filter(
      (b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text',
    );
    const items = bulletsBlock ? bulletsBlock.items.filter(Boolean) : textItems.map((b) => b.text);
    if (items.length >= 2) {
      return (
        <div className="flex h-full flex-col justify-center gap-[4vh] px-[7vw] py-[7vh]">
          {heading && <BlockView block={heading} />}
          <div className={`grid gap-[2vw] ${gridColsFor(items.length)}`}>
            {items.map((it, i) => (
              <motion.div key={i} {...buildItemProps(build, i)}>
                <FeatureCard index={i + 1}>{renderInline(it)}</FeatureCard>
              </motion.div>
            ))}
          </div>
        </div>
      );
    }
  }

  // ----- Designed: stat row (bigStat blocks → cards side by side) -----
  if (layout === 'stats') {
    const heading = blocks.find(isHeading);
    const intro = blocks.find(
      (b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text',
    );
    const stats = blocks.filter(isBigStat);
    if (stats.length >= 2) {
      return (
        <div className="flex h-full flex-col justify-center gap-[4vh] px-[7vw] py-[7vh]">
          {heading && <BlockView block={heading} />}
          {intro && <BlockView block={intro} />}
          <div className={`grid gap-[2vw] ${gridColsFor(stats.length)}`}>
            {stats.map((s, i) => (
              <motion.div key={i} {...buildItemProps(build, i)}>
                <StatCard value={s.value} label={s.label} />
              </motion.div>
            ))}
          </div>
        </div>
      );
    }
  }

  // ----- Designed: two balanced columns -----
  if (layout === 'columns') {
    const heading = blocks.find(isHeading);
    const rest = blocks.filter((b) => !(heading && b === heading));
    if (rest.length >= 2) {
      const mid = Math.ceil(rest.length / 2);
      return (
        <div className="flex h-full flex-col justify-center gap-[3.5vh] px-[7vw] py-[7vh]">
          {heading && <BlockView block={heading} />}
          <div className="grid grid-cols-2 gap-[4vw]">
            <div className="flex flex-col gap-[3vh]">
              {rest.slice(0, mid).map((b, i) => (
                <BlockView key={i} block={b} build={build} />
              ))}
            </div>
            <div className="flex flex-col gap-[3vh]">
              {rest.slice(mid).map((b, i) => (
                <BlockView key={i} block={b} build={build} />
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  if (layout === 'split') {
    const media = blocks.find(isMedia);
    const rest = blocks.filter((b) => b !== media);
    return (
      <div className="grid h-full grid-cols-2 items-center gap-[64px] px-[96px] py-[72px]">
        <div className="flex min-w-0 flex-col justify-center gap-[3.5vh]">
          {rest.map((b, i) => (
            <BlockView key={i} block={b} build={build} />
          ))}
        </div>
        <div className="flex h-full min-w-0 items-center justify-center">
          {media ? (
            <BlockView block={media} />
          ) : (
            // No media: a themed accent panel reads as intentional design
            // rather than an empty bordered box.
            <div
              className="relative h-full w-full overflow-hidden rounded-3xl border border-edge/60 shadow-pop"
              style={{ background: CARD_BG }}
              aria-hidden="true"
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(62% 62% at 28% 22%, color-mix(in oklab, var(--slide-accent) 34%, transparent), transparent 70%)',
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layout === 'title') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[28px] px-[128px] text-center">
        {blocks.map((b, i) => (
          <motion.div key={i} {...buildItemProps(build, i)}>
            <BlockView block={b} big />
          </motion.div>
        ))}
      </div>
    );
  }

  // 'full' (default): generous stacked column
  return (
    <div className="flex h-full flex-col justify-center gap-[32px] px-[128px] py-[72px]">
      {blocks.map((b, i) => (
        <motion.div key={i} {...buildItemProps(build, i)}>
          <BlockView block={b} />
        </motion.div>
      ))}
    </div>
  );
}

// ---------- interactive slides ----------

function PhasePill({ phase }: { phase: Phase }) {
  const map: Record<Phase, { label: string; cls: string; pulse?: boolean }> = {
    show: { label: 'Get ready', cls: 'border-edge text-fg-dim' },
    open: { label: 'Voting open', cls: 'border-emerald/60 text-emerald', pulse: true },
    closed: { label: 'Voting closed', cls: 'border-amber/60 text-fg' },
    reveal: { label: 'Results', cls: 'border-accent/60 text-accent' },
  };
  const { label, cls, pulse } = map[phase];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border bg-panel/80 px-4 py-1.5 text-sm font-bold uppercase tracking-widest ${cls}`}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full bg-current ${pulse ? 'animate-pulse' : ''}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function WaitingPanel({ code, open }: { code: string; open: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[3vh] text-center">
      <style>{`@keyframes pd-wait-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }`}</style>
      <p className="text-[clamp(1.4rem,2.6vw,2.2rem)] font-medium text-fg-dim">
        Join at <span className="font-semibold text-fg">{joinHost()}/j</span> · code{' '}
        <JoinCode code={code} className="text-[1.1em]" />
      </p>
      <p
        className="text-[clamp(1.2rem,2.2vw,1.8rem)] font-semibold text-fg"
        style={{ animation: 'pd-wait-pulse 2s ease-in-out infinite' }}
        role="status"
      >
        {open ? 'Voting is open — waiting for responses…' : 'Waiting for responses…'}
      </p>
    </div>
  );
}

function InteractiveSlideView({
  slide,
  phase,
  phaseOpenedAt,
  results,
  code,
  skewMs,
  sessionId,
  qaBump,
}: {
  slide: Slide;
  phase: Phase;
  phaseOpenedAt: string | null;
  results: Results | null;
  code: string;
  skewMs: number;
  sessionId: string;
  qaBump: number;
}) {
  const prompt = slide.body.prompt || slide.title;
  const total = results?.total ?? 0;
  const isQa = slide.kind === 'qa';
  const showWaiting = !isQa && (phase === 'show' || !results || total === 0);
  const hideLiveBars =
    slide.settings.showResultsLive === false && phase === 'open' &&
    (slide.kind === 'poll' || slide.kind === 'quiz' || slide.kind === 'ranking');

  const timeLimit = slide.settings.timeLimitSec ?? 30;
  const showCountdown = slide.kind === 'quiz' && phase === 'open' && !!phaseOpenedAt && timeLimit > 0;

  let body: React.ReactNode = null;
  if (isQa) {
    body = <QaWall sessionId={sessionId} bumpSignal={qaBump} code={code} />;
  } else if (showWaiting) {
    body = <WaitingPanel code={code} open={phase === 'open'} />;
  } else if (hideLiveBars) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-[2vh] text-center">
        <p className="font-mono text-[clamp(3rem,8vw,6rem)] font-bold tabular-nums text-accent">{total}</p>
        <p className="text-[clamp(1.2rem,2.2vw,1.8rem)] font-semibold text-fg-dim">
          {total === 1 ? 'response so far' : 'responses so far'} — results revealed when voting closes
        </p>
      </div>
    );
  } else if (results) {
    switch (results.kind) {
      case 'poll':
      case 'quiz':
      case 'ranking':
        body = (
          <div className="flex h-full items-center">
            <BarChart
              options={slide.body.options ?? []}
              counts={results.counts}
              total={results.total}
              reveal={slide.kind === 'quiz' && phase === 'reveal'}
              correct={slide.body.correct ?? []}
              optionImages={slide.body.optionImages}
            />
          </div>
        );
        break;
      case 'wordcloud':
        body = <WordCloud words={results.words} total={results.total} />;
        break;
      case 'scale':
        body = (
          <ScaleView
            results={results}
            min={slide.body.min ?? 1}
            max={slide.body.max ?? 5}
            minLabel={slide.body.minLabel}
            maxLabel={slide.body.maxLabel}
          />
        );
        break;
      case 'open_text':
        body = <OpenTextWall results={results} />;
        break;
    }
  }

  return (
    <div className="flex h-full flex-col px-[5vw] pb-[12vh] pt-[5vh]">
      <div className="mb-[3vh] flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <PhasePill phase={phase} />
          <h1 className="font-bold leading-[1.1] text-fg [font-size:clamp(2rem,5vw,4rem)] [text-wrap:balance]">
            {prompt}
          </h1>
        </div>
        {showCountdown && phaseOpenedAt && (
          <CountdownRing openedAt={phaseOpenedAt} seconds={timeLimit} skewMs={skewMs} />
        )}
      </div>

      <div className="min-h-0 flex-1">{body}</div>

      {!isQa && !showWaiting && (
        <p
          className="mt-[2vh] shrink-0 font-mono text-lg font-semibold tabular-nums text-fg-dim"
          aria-live="polite"
          aria-atomic="true"
        >
          {total} {total === 1 ? 'response' : 'responses'}
        </p>
      )}
    </div>
  );
}

// ---------- root ----------

const VARIANTS = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  slide: { initial: { opacity: 0, x: 56 }, animate: { opacity: 1, x: 0 } },
  zoom: { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 } },
  none: { initial: {}, animate: {} },
} as const;

export interface SlideRendererProps {
  slide: Slide;
  theme: DeckTheme;
  phase: Phase;
  phaseOpenedAt: string | null;
  results: Results | null;
  code: string;
  skewMs: number;
  sessionId: string;
  /** Incremented on `qa` broadcast nudges — QaWall refetches when it changes. */
  qaBump: number;
}

export function SlideRenderer({
  slide,
  theme,
  phase,
  phaseOpenedAt,
  results,
  code,
  skewMs,
  sessionId,
  qaBump,
}: SlideRendererProps) {
  const reduced = useReducedMotion();
  useGoogleFonts([theme.fontHeading, theme.fontBody]);
  const brandFontStyle = {
    '--font-heading': fontStack(theme.fontHeading, 'heading'),
    '--font-body': fontStack(theme.fontBody, 'body'),
    fontFamily: fontStack(theme.fontBody, 'body'),
  } as React.CSSProperties;
  const hasBrandFont = !!(theme.fontHeading || theme.fontBody);
  const animKey: keyof typeof VARIANTS = reduced ? 'none' : (slide.settings.animation ?? 'fade');
  const v = VARIANTS[animKey];
  // Element-level build animation (staggered bullets/cards/stats). Off unless the
  // slide opts in, and always off under prefers-reduced-motion.
  const build = !reduced && (slide.settings.buildAnimation ?? false);
  const accent = slide.settings.accent || theme.accent || 'var(--color-accent)';
  const bg = slide.body.backgroundImage;
  // "Hero photo" = a background image with text blocks to overlay (the AI stock
  // case). It gets a consistent DARK overlay + forced light text so it's legible
  // on any theme — the same treatment every deck tool uses for photo slides.
  // PDF-import pages (backgroundImage but blocks:[]) keep the softer theme scrim.
  const heroPhoto = !!bg && slide.kind === 'content' && (slide.body.blocks?.length ?? 0) > 0;

  return (
    <motion.div
      key={slide.id}
      initial={v.initial}
      animate={v.animate}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`absolute inset-0 overflow-hidden${hasBrandFont ? ' pd-brandfont' : ''}`}
      style={{ '--slide-accent': accent, ...(hasBrandFont ? brandFontStyle : {}) } as React.CSSProperties}
    >
      {/* Designed surface: soft themed gradient behind every slide (unless a
          full-bleed background image takes over). The single biggest visual
          upgrade vs a flat fill. */}
      {!bg && (
        <div
          className="absolute inset-0"
          style={{ background: SURFACE_BG }}
          aria-hidden="true"
        />
      )}
      {bg && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(bg)})` }}
            aria-hidden="true"
          />
          {/* Hero photos get a fixed dark scrim (theme-independent, always
              legible); PDF-page backgrounds keep the softer theme-tinted scrim. */}
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
          />
          {!heroPhoto && (
            <div
              className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 to-ink/60"
              aria-hidden="true"
            />
          )}
        </>
      )}
      <div
        className="relative z-10 h-full"
        // On a hero photo, force light text regardless of the (possibly light) theme.
        style={
          heroPhoto
            ? ({ '--color-fg': '#ffffff', '--color-fg-dim': 'rgba(255,255,255,0.85)' } as React.CSSProperties)
            : undefined
        }
      >
        {slide.kind === 'content' ? (
          slide.settings.layout === 'media' || slide.body.backgroundImage ? (
            <ContentSlideView slide={slide} build={build} />
          ) : (
            <FitBox fitKey={slide.id}>
              <ContentSlideView slide={slide} build={build} />
            </FitBox>
          )
        ) : slide.kind === 'join' ? (
          <JoinSlide slide={slide} sessionId={sessionId} code={code} />
        ) : slide.kind === 'timer' ? (
          <TimerSlide slide={slide} />
        ) : slide.kind === 'breathing' ? (
          <BreathingSlide slide={slide} />
        ) : (
          <InteractiveSlideView
            slide={slide}
            phase={phase}
            phaseOpenedAt={phaseOpenedAt}
            results={results}
            code={code}
            skewMs={skewMs}
            sessionId={sessionId}
            qaBump={qaBump}
          />
        )}
      </div>
      {theme.logoUrl && slide.kind === 'content' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.logoUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute right-[3.5vw] top-[3.5vh] z-20 h-[5.5vh] max-h-20 w-auto object-contain opacity-90 drop-shadow"
        />
      )}
    </motion.div>
  );
}
