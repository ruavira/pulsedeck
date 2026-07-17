// Deck → .pptx exporter (CLIENT-ONLY: pptxgenjs is lazy-imported and triggers
// a browser download). Content slides render as styled dark slides; interactive
// slides render as a static summary with a "run in PulseDeck" note.

import type { ContentBlock, Deck, Slide } from '@/lib/types';
// Type-only import — erased at compile time, so pptxgenjs stays lazy-loaded.
import type PptxGenJS from 'pptxgenjs';

// PulseDeck design tokens as pptx hex (no leading '#').
const INK = '061826';
const FG = 'F2F5FA';
const DIM = '8B94A7';
const CYAN = '35C4C8';
const EMERALD = '10B981';
const DEFAULT_ACCENT = '2F86C9';

// LAYOUT_16x9 canvas is 10" x 5.625".
const PAGE_W = 10;
const PAGE_H = 5.625;
const MARGIN = 0.5;
const BODY_W = PAGE_W - MARGIN * 2;

const KIND_LABEL: Record<Slide['kind'], string> = {
  content: 'Slide',
  poll: 'Live poll',
  quiz: 'Quiz question',
  wordcloud: 'Word cloud',
  qa: 'Audience Q&A',
  scale: 'Rating scale',
  ranking: 'Ranking',
  open_text: 'Open answers',
  timer: 'Break timer',
  breathing: 'Breathing exercise',
  join: 'Join screen',
};

function accentOf(deck: Deck): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(deck.theme?.accent ?? '');
  return m ? m[1].toUpperCase() : DEFAULT_ACCENT;
}

/** Rough line-count estimate for wrapped text at body font size. */
function estLines(text: string, charsPerLine = 90): number {
  return text
    .split('\n')
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function safeFileName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|]/g, '').trim();
  return `${cleaned || 'PulseDeck deck'}.pptx`;
}

function renderBlocks(
  slide: PptxGenJS.Slide,
  blocks: ContentBlock[],
  startY: number,
  accent: string,
): void {
  let y = startY;
  const remaining = () => Math.max(0.4, PAGE_H - MARGIN + 0.15 - y);

  for (const block of blocks) {
    if (y > PAGE_H - 0.8) break; // out of room; stop rather than overflow off-canvas

    switch (block.type) {
      case 'heading': {
        const h = 0.55;
        slide.addText(block.text, {
          x: MARGIN, y, w: BODY_W, h,
          fontSize: 22, bold: true, color: FG, align: 'left', valign: 'top',
        });
        y += h + 0.1;
        break;
      }
      case 'text': {
        const h = Math.min(remaining(), 0.32 * estLines(block.text) + 0.12);
        slide.addText(block.text, {
          x: MARGIN, y, w: BODY_W, h,
          fontSize: 15, color: FG, align: 'left', valign: 'top',
        });
        y += h + 0.12;
        break;
      }
      case 'bullets': {
        const items = block.items.slice(0, 12);
        const h = Math.min(remaining(), 0.34 * items.length + 0.1);
        slide.addText(
          items.map((t): PptxGenJS.TextProps => ({
            text: t,
            options: { bullet: { code: '2022' }, color: FG, fontSize: 15, breakLine: true },
          })),
          { x: MARGIN + 0.1, y, w: BODY_W - 0.1, h, valign: 'top' },
        );
        y += h + 0.12;
        break;
      }
      case 'quote': {
        const runs: PptxGenJS.TextProps[] = [
          { text: `“${block.text}”`, options: { italic: true, color: FG, fontSize: 17, breakLine: true } },
        ];
        if (block.attribution) {
          runs.push({ text: `— ${block.attribution}`, options: { color: DIM, fontSize: 13 } });
        }
        const h = Math.min(remaining(), 0.34 * estLines(block.text, 80) + (block.attribution ? 0.4 : 0.15));
        slide.addText(runs, { x: MARGIN + 0.25, y, w: BODY_W - 0.5, h, valign: 'top' });
        y += h + 0.12;
        break;
      }
      case 'bigStat': {
        const h = block.label ? 1.35 : 0.95;
        const runs: PptxGenJS.TextProps[] = [
          { text: block.value, options: { bold: true, fontSize: 48, color: accent, breakLine: true } },
        ];
        if (block.label) runs.push({ text: block.label, options: { fontSize: 16, color: DIM } });
        slide.addText(runs, { x: MARGIN, y, w: BODY_W, h, align: 'center', valign: 'top' });
        y += h + 0.1;
        break;
      }
      case 'image': {
        const h = Math.min(3, remaining());
        slide.addImage({
          path: block.url,
          x: (PAGE_W - 6) / 2, y, w: 6, h,
          sizing: { type: 'contain', w: 6, h },
          altText: block.alt ?? '',
        });
        y += h + 0.12;
        break;
      }
      case 'video': {
        const h = 0.4;
        slide.addText(`▶ Video: ${block.url}`, {
          x: MARGIN, y, w: BODY_W, h,
          fontSize: 13, color: CYAN, hyperlink: { url: block.url },
        });
        y += h + 0.1;
        break;
      }
    }
  }
}

function renderInteractive(slide: PptxGenJS.Slide, s: Slide, accent: string): void {
  const prompt = s.body.prompt || s.title || KIND_LABEL[s.kind];

  slide.addText(KIND_LABEL[s.kind].toUpperCase(), {
    x: MARGIN, y: 0.45, w: BODY_W, h: 0.35,
    fontSize: 12, bold: true, color: CYAN, charSpacing: 3,
  });
  slide.addText(prompt, {
    x: MARGIN, y: 0.95, w: BODY_W, h: 1.0,
    fontSize: 28, bold: true, color: FG, valign: 'top',
  });

  let y = 2.15;
  const options = s.body.options ?? [];
  if (options.length > 0) {
    const correct = new Set(s.kind === 'quiz' ? s.body.correct ?? [] : []);
    const runs = options.slice(0, 10).map((opt, i): PptxGenJS.TextProps => ({
      text: correct.has(i) ? `✓ ${opt} (correct)` : opt,
      options: {
        bullet: { code: '2022' },
        color: correct.has(i) ? EMERALD : FG,
        bold: correct.has(i),
        fontSize: 16,
        breakLine: true,
      },
    }));
    const h = Math.min(0.38 * runs.length + 0.1, PAGE_H - y - 0.7);
    slide.addText(runs, { x: MARGIN + 0.1, y, w: BODY_W - 0.1, h, valign: 'top' });
    y += h + 0.15;
  } else if (s.kind === 'scale') {
    const min = s.body.min ?? 1;
    const max = s.body.max ?? 10;
    const lo = s.body.minLabel ? `${min} (${s.body.minLabel})` : String(min);
    const hi = s.body.maxLabel ? `${max} (${s.body.maxLabel})` : String(max);
    slide.addText(`Scale: ${lo} → ${hi}`, {
      x: MARGIN, y, w: BODY_W, h: 0.45, fontSize: 16, color: FG,
    });
    y += 0.6;
  }

  slide.addText('[Live interaction — run in PulseDeck]', {
    x: MARGIN, y: PAGE_H - 0.75, w: BODY_W, h: 0.4,
    fontSize: 13, italic: true, color: accent,
  });
}

/**
 * Export a deck as a 16:9 .pptx and trigger the browser download.
 * Throws a friendly Error if generation fails (e.g. an image URL is unreachable).
 */
export async function exportDeckToPptx(deck: Deck): Promise<void> {
  const { default: PptxGen } = await import('pptxgenjs');
  const pptx = new PptxGen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'PulseDeck';
  pptx.title = deck.title || 'PulseDeck deck';

  const accent = accentOf(deck);
  const slides = [...deck.slides].sort((a, b) => a.position - b.position);

  // Title slide
  const cover = pptx.addSlide();
  cover.background = { color: INK };
  cover.addText(deck.title || 'Untitled deck', {
    x: MARGIN, y: 1.9, w: BODY_W, h: 1.2,
    fontSize: 40, bold: true, color: FG, align: 'center',
  });
  cover.addText('Made with PulseDeck', {
    x: MARGIN, y: 3.2, w: BODY_W, h: 0.5,
    fontSize: 14, color: accent, align: 'center',
  });

  for (const s of slides) {
    const slide = pptx.addSlide();
    if (s.body.backgroundImage) {
      slide.background = { path: s.body.backgroundImage };
    } else {
      slide.background = { color: INK };
    }

    if (s.kind === 'content') {
      let startY = 0.55;
      if (s.title.trim()) {
        slide.addText(s.title, {
          x: MARGIN, y: 0.45, w: BODY_W, h: 0.7,
          fontSize: 30, bold: true, color: accent, valign: 'top',
        });
        startY = 1.35;
      }
      renderBlocks(slide, s.body.blocks ?? [], startY, accent);
    } else {
      renderInteractive(slide, s, accent);
    }
  }

  try {
    await pptx.writeFile({ fileName: safeFileName(deck.title) });
  } catch (e) {
    throw new Error(
      `Could not generate the PowerPoint file${e instanceof Error && e.message ? ` (${e.message})` : ''}. ` +
        'If the deck contains images, make sure they are reachable and try again.',
    );
  }
}
