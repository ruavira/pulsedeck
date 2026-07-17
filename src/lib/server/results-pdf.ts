import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// Branded, paginated results report as a real PDF (parity with the XLSX/CSV
// exports). Intentionally a *summary* report — leaderboard, per-activity
// aggregates, and Q&A — not the raw per-response dump (that's what CSV/XLSX are
// for). pdf-lib is pure-JS with embedded standard fonts, so this runs on the
// Netlify Node runtime with no native deps or external font files.

export interface ResultsPdfActivity {
  title: string;
  kind: string;
  prompt: string;
  /** Pre-formatted summary lines, e.g. "Solar — 12 (48%)". */
  lines: string[];
  /** Total responses for this activity. */
  total: number;
}

export interface ResultsPdfInput {
  session: {
    code: string;
    title: string;
    startedAt: string | null;
    endedAt: string | null;
    participantCount: number;
  };
  leaderboard: { nickname: string; score: number; streak: number }[];
  activities: ResultsPdfActivity[];
  questions: { text: string; author: string; upvotes: number; status: string }[];
  generatedAt: string;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const CONTENT_W = A4.w - MARGIN * 2;

const INK = rgb(0.09, 0.09, 0.13);
const DIM = rgb(0.42, 0.42, 0.5);
const ACCENT = rgb(0.39, 0.4, 0.95); // PulseDeck violet
const RULE = rgb(0.86, 0.86, 0.9);
const ZEBRA = rgb(0.96, 0.96, 0.98);

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  pageNo: number;
  session_code: string;
}

function fmtWhen(startedAt: string | null, endedAt: string | null): string {
  const f = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  const s = f(startedAt);
  const e = f(endedAt);
  if (s && e) return `${s} — ${e}`;
  if (s) return `Started ${s}`;
  if (e) return `Ended ${e}`;
  return 'Time not recorded';
}

/** Sanitize to WinAnsi-safe text — StandardFonts can't encode arbitrary UTF-8. */
function safe(str: string): string {
  return (str ?? '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '') // drop anything else non-ASCII (emoji, etc.)
    .trimEnd();
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      // Hard-break a single word that's too long to fit on its own line.
      if (font.widthOfTextAtSize(word, size) > maxW) {
        let chunk = '';
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxW) {
            if (chunk) lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        cur = chunk;
      } else {
        cur = word;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function footer(ctx: Ctx) {
  const label = safe(`PulseDeck results - ${ctx.session_code ?? ''}`).trim();
  ctx.page.drawText(safe(`Page ${ctx.pageNo}`), {
    x: A4.w - MARGIN - ctx.font.widthOfTextAtSize(`Page ${ctx.pageNo}`, 8),
    y: 28,
    size: 8,
    font: ctx.font,
    color: DIM,
  });
  ctx.page.drawText(label, { x: MARGIN, y: 28, size: 8, font: ctx.font, color: DIM });
}

function newPage(ctx: Ctx) {
  footer(ctx);
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.pageNo += 1;
  ctx.y = A4.h - MARGIN;
}

function ensure(ctx: Ctx, need: number) {
  if (ctx.y - need < MARGIN + 24) newPage(ctx);
}

function heading(ctx: Ctx, text: string) {
  ensure(ctx, 40);
  ctx.y -= 26;
  ctx.page.drawText(safe(text), { x: MARGIN, y: ctx.y, size: 15, font: ctx.bold, color: INK });
  ctx.y -= 8;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: CONTENT_W, height: 1.5, color: ACCENT });
  ctx.y -= 10;
}

function paragraph(ctx: Ctx, text: string, size = 10, color = INK, font?: PDFFont) {
  const f = font ?? ctx.font;
  const lines = wrap(text, f, size, CONTENT_W);
  const lh = size + 4;
  for (const line of lines) {
    ensure(ctx, lh);
    ctx.page.drawText(line, { x: MARGIN, y: ctx.y - size, size, font: f, color });
    ctx.y -= lh;
  }
}

export async function buildResultsPdf(input: ResultsPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`PulseDeck results — ${input.session.title}`);
  doc.setCreator('PulseDeck');
  doc.setProducer('PulseDeck');

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - MARGIN, font, bold, pageNo: 1, session_code: input.session.code };

  // ---- Cover header ----
  ctx.page.drawText('PulseDeck', { x: MARGIN, y: ctx.y - 18, size: 20, font: bold, color: ACCENT });
  ctx.page.drawText('RESULTS REPORT', {
    x: A4.w - MARGIN - font.widthOfTextAtSize('RESULTS REPORT', 10),
    y: ctx.y - 12,
    size: 10,
    font: bold,
    color: DIM,
  });
  ctx.y -= 34;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: CONTENT_W, height: 2, color: ACCENT });
  ctx.y -= 18;

  paragraph(ctx, input.session.title, 18, INK, bold);
  ctx.y -= 2;
  paragraph(ctx, `Join code ${input.session.code}`, 11, DIM);
  paragraph(ctx, fmtWhen(input.session.startedAt, input.session.endedAt), 10, DIM);
  paragraph(
    ctx,
    `${input.session.participantCount} participant${input.session.participantCount === 1 ? '' : 's'}`,
    10,
    DIM,
  );

  // ---- Leaderboard ----
  heading(ctx, 'Leaderboard');
  if (input.leaderboard.length === 0) {
    paragraph(ctx, 'No participants scored in this session.', 10, DIM);
  } else {
    const cols = [
      { label: 'Rank', x: MARGIN + 4, w: 44 },
      { label: 'Nickname', x: MARGIN + 55, w: 300 },
      { label: 'Score', x: MARGIN + 360, w: 70 },
      { label: 'Streak', x: MARGIN + 450, w: CONTENT_W - 450 },
    ];
    const rowH = 18;
    // header row
    ensure(ctx, rowH + 4);
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: ACCENT });
    for (const c of cols) {
      ctx.page.drawText(c.label, { x: c.x, y: ctx.y - rowH + 9, size: 9, font: bold, color: rgb(1, 1, 1) });
    }
    ctx.y -= rowH;
    input.leaderboard.forEach((p, i) => {
      ensure(ctx, rowH);
      if (i % 2 === 1) {
        ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rowH + 4, width: CONTENT_W, height: rowH, color: ZEBRA });
      }
      const cells = [
        String(i + 1),
        safe(p.nickname) || 'unknown',
        String(p.score),
        String(p.streak),
      ];
      cells.forEach((val, ci) => {
        const c = cols[ci];
        let text = val;
        // truncate nickname to column width
        while (text && font.widthOfTextAtSize(text, 9) > c.w - 6) text = text.slice(0, -1);
        ctx.page.drawText(text, { x: c.x, y: ctx.y - rowH + 9, size: 9, font, color: INK });
      });
      ctx.y -= rowH;
    });
  }

  // ---- Activity results ----
  heading(ctx, 'Activity results');
  if (input.activities.length === 0) {
    paragraph(ctx, 'This deck had no interactive activities to aggregate.', 10, DIM);
  } else {
    input.activities.forEach((a, idx) => {
      ensure(ctx, 46);
      ctx.y -= 8;
      const label = `${idx + 1}. ${a.title || a.prompt || 'Activity'}`;
      paragraph(ctx, label, 11, INK, bold);
      paragraph(ctx, `${a.kind} · ${a.total} response${a.total === 1 ? '' : 's'}`, 8.5, DIM);
      if (a.prompt && a.prompt !== a.title) paragraph(ctx, a.prompt, 9.5, DIM);
      ctx.y -= 2;
      if (a.lines.length === 0) {
        paragraph(ctx, 'No responses.', 9.5, DIM);
      } else {
        for (const line of a.lines) {
          ensure(ctx, 14);
          ctx.page.drawText('•', { x: MARGIN + 6, y: ctx.y - 9.5, size: 9.5, font, color: ACCENT });
          const wrapped = wrap(line, font, 9.5, CONTENT_W - 22);
          wrapped.forEach((wl, wi) => {
            if (wi > 0) ensure(ctx, 13);
            ctx.page.drawText(wl, { x: MARGIN + 18, y: ctx.y - 9.5, size: 9.5, font, color: INK });
            ctx.y -= 13;
          });
        }
      }
    });
  }

  // ---- Q&A ----
  heading(ctx, 'Questions & Answers');
  if (input.questions.length === 0) {
    paragraph(ctx, 'No questions were submitted.', 10, DIM);
  } else {
    input.questions.forEach((q, i) => {
      ensure(ctx, 30);
      ctx.y -= 6;
      paragraph(ctx, `${i + 1}. ${q.text}`, 10, INK);
      paragraph(ctx, `— ${q.author || 'Anonymous'} · ${q.upvotes} upvote${q.upvotes === 1 ? '' : 's'} · ${q.status}`, 8.5, DIM);
    });
  }

  ctx.y -= 24;
  ensure(ctx, 24);
  paragraph(ctx, `Generated by PulseDeck on ${input.generatedAt}`, 8.5, DIM);

  footer(ctx);
  return doc.save();
}
