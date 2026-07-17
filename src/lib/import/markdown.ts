// Markdown → deck importer (pure, synchronous, never throws on strings).
//
// Grammar (line-oriented, forgiving):
//   first '# '                    → deck title
//   subsequent '# ' / '## '      → new content slide (heading = slide title)
//   '### '..'######'             → heading block inside the current slide
//   '- ' / '* ' / '+ ' / '1. '   → bullets block (consecutive lines grouped)
//   '> '                         → quote block (consecutive lines joined)
//   ![alt](url)                  → image block
//   plain lines                  → text blocks (paragraphs split on blank lines)
//   ?poll Question | opt1 | opt2      → poll slide
//   ?quiz Question | opt1 | *right    → quiz slide ('*' marks correct options)
//   ?wordcloud Prompt                 → wordcloud slide
//   ?scale Prompt | 1 | 10            → scale slide (min | max optional)
//   ?qa Title                         → Q&A slide
//   ?open Prompt                      → open text slide
//
// Worst case for sloppy input: a single content slide carrying the raw text.

import type { ContentBlock, Slide, SlideKind, SlideSettings } from '@/lib/types';

const DIRECTIVE_RE = /^\?(poll|quiz|wordcloud|scale|qa|open)\b[ \t]*(.*)$/i;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;
const H1_RE = /^#\s+(.*)$/;
const H2_RE = /^##\s+(.*)$/;
const H3PLUS_RE = /^#{3,6}\s+(.*)$/;
const BULLET_RE = /^(?:[-*+]|\d{1,3}[.)])\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;

interface SlideDraft {
  title: string;
  blocks: ContentBlock[];
}

function defaultSettings(kind: SlideKind): SlideSettings {
  switch (kind) {
    case 'poll':
      return { showResultsLive: true };
    case 'quiz':
      return { timeLimitSec: 30, points: 1000 };
    case 'wordcloud':
      return { maxWords: 3 };
    default:
      return {};
  }
}

function contentLayout(draft: SlideDraft): SlideSettings {
  if (draft.blocks.length === 0) return { layout: 'title' };
  if (draft.blocks.length === 1 && draft.blocks[0].type === 'image') return { layout: 'media' };
  return { layout: 'full' };
}

/** Split a directive tail on '|', trimming each part and dropping empties. */
function splitParts(rest: string): string[] {
  return rest
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function makeInteractiveSlide(kindRaw: string, rest: string): Slide {
  const kind = kindRaw.toLowerCase();
  const parts = splitParts(rest);
  const prompt = parts[0] ?? '';

  if (kind === 'poll') {
    return bareSlide('poll', prompt || 'Poll', {
      prompt: prompt || 'Poll',
      options: parts.slice(1),
    });
  }

  if (kind === 'quiz') {
    const rawOptions = parts.slice(1);
    const correct: number[] = [];
    const options = rawOptions.map((opt, i) => {
      if (opt.startsWith('*')) {
        correct.push(i);
        return opt.slice(1).trim();
      }
      return opt;
    });
    return bareSlide('quiz', prompt || 'Quiz question', {
      prompt: prompt || 'Quiz question',
      options,
      correct,
    });
  }

  if (kind === 'wordcloud') {
    return bareSlide('wordcloud', prompt || 'Word cloud', { prompt: prompt || 'Word cloud' });
  }

  if (kind === 'scale') {
    let min = parseNumber(parts[1], 1);
    let max = parseNumber(parts[2], 10);
    if (min >= max) {
      min = 1;
      max = 10;
    }
    return bareSlide('scale', prompt || 'Rate this', { prompt: prompt || 'Rate this', min, max });
  }

  if (kind === 'qa') {
    return bareSlide('qa', prompt || 'Q&A', { prompt: prompt || 'Ask us anything' });
  }

  // 'open'
  return bareSlide('open_text', prompt || 'Open question', { prompt: prompt || 'Open question' });
}

function bareSlide(kind: SlideKind, title: string, body: Slide['body']): Slide {
  return {
    id: crypto.randomUUID(),
    kind,
    title,
    body,
    settings: defaultSettings(kind),
    position: 0, // re-sequenced at the end
  };
}

export function parseMarkdownDeck(md: string): { title: string; slides: Slide[] } {
  const raw = typeof md === 'string' ? md : '';
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  let deckTitle: string | null = null;
  const slides: Slide[] = [];

  let draft: SlideDraft | null = null;
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let quote: string[] = [];

  const ensureDraft = (): SlideDraft => {
    if (!draft) draft = { title: '', blocks: [] };
    return draft;
  };

  const flushRuns = () => {
    if (paragraph.length) {
      ensureDraft().blocks.push({ type: 'text', text: paragraph.join('\n') });
      paragraph = [];
    }
    if (bullets.length) {
      ensureDraft().blocks.push({ type: 'bullets', items: bullets });
      bullets = [];
    }
    if (quote.length) {
      ensureDraft().blocks.push({ type: 'quote', text: quote.join('\n') });
      quote = [];
    }
  };

  const flushSlide = () => {
    flushRuns();
    if (draft && (draft.title.trim() || draft.blocks.length > 0)) {
      slides.push({
        id: crypto.randomUUID(),
        kind: 'content',
        title: draft.title.trim(),
        body: { blocks: draft.blocks },
        settings: contentLayout(draft),
        position: 0,
      });
    }
    draft = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Blank line: ends the current paragraph / bullet / quote runs.
    if (trimmed === '') {
      flushRuns();
      continue;
    }

    // Interactive directive → its own slide.
    const directive = trimmed.match(DIRECTIVE_RE);
    if (directive) {
      flushSlide();
      slides.push(makeInteractiveSlide(directive[1], directive[2] ?? ''));
      continue;
    }

    // Level-1 heading: first one is the deck title, later ones start slides.
    const h1 = trimmed.match(H1_RE);
    if (h1) {
      if (deckTitle === null && slides.length === 0 && !draft) {
        deckTitle = h1[1].trim();
      } else {
        flushSlide();
        draft = { title: h1[1].trim(), blocks: [] };
      }
      continue;
    }

    const h2 = trimmed.match(H2_RE);
    if (h2) {
      flushSlide();
      draft = { title: h2[1].trim(), blocks: [] };
      continue;
    }

    const h3 = trimmed.match(H3PLUS_RE);
    if (h3) {
      flushRuns();
      ensureDraft().blocks.push({ type: 'heading', text: h3[1].trim() });
      continue;
    }

    // Horizontal rules are noise in a deck context.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushRuns();
      continue;
    }

    const img = trimmed.match(IMAGE_RE);
    if (img) {
      flushRuns();
      ensureDraft().blocks.push({
        type: 'image',
        url: img[2],
        alt: img[1] || undefined,
        fit: 'contain',
      });
      continue;
    }

    const bullet = trimmed.match(BULLET_RE);
    if (bullet) {
      // A bullet run interrupts paragraphs/quotes but not other bullets.
      if (paragraph.length || quote.length) flushRuns();
      bullets.push(bullet[1].trim());
      continue;
    }

    const q = trimmed.match(QUOTE_RE);
    if (q) {
      if (paragraph.length || bullets.length) flushRuns();
      if (q[1].trim()) quote.push(q[1].trim());
      continue;
    }

    // Plain paragraph line.
    if (bullets.length || quote.length) flushRuns();
    paragraph.push(trimmed);
  }

  flushSlide();

  // Worst case: nothing parsed into slides — carry the raw text on one slide.
  if (slides.length === 0) {
    const text = raw.trim();
    slides.push({
      id: crypto.randomUUID(),
      kind: 'content',
      title: deckTitle ?? '',
      body: { blocks: text ? [{ type: 'text', text }] : [] },
      settings: { layout: text ? 'full' : 'title' },
      position: 0,
    });
  }

  slides.forEach((s, i) => {
    s.position = i;
  });

  return {
    title: deckTitle ?? slides.find((s) => s.title)?.title ?? 'Imported deck',
    slides,
  };
}
