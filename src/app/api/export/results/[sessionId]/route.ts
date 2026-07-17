import ExcelJS from 'exceljs';
import { getAdmin } from '@/lib/supabase/admin';
import { verifySessionKey, unauthorized } from '@/lib/server/presenter-auth';
import { buildResultsPdf, type ResultsPdfActivity } from '@/lib/server/results-pdf';
import type { DeckSnapshot, Slide } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const INTERACTIVE = new Set<Slide['kind']>(['poll', 'quiz', 'ranking', 'wordcloud', 'scale', 'open_text']);

// GET /api/export/results/[sessionId]?format=xlsx|csv|pdf&key=... (key in query for direct download links)
export async function GET(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await ctx.params;
  const url = new URL(req.url);
  const key = req.headers.get('x-presenter-key') ?? url.searchParams.get('key');
  if (!(await verifySessionKey(sessionId, key))) return unauthorized();
  const rawFormat = url.searchParams.get('format');
  const format = rawFormat === 'csv' ? 'csv' : rawFormat === 'pdf' ? 'pdf' : 'xlsx';

  const admin = getAdmin();
  const { data: session } = await admin
    .from('sessions')
    .select('id, code, started_at, ended_at, deck_snapshot')
    .eq('id', sessionId)
    .single();
  if (!session) return Response.json({ error: 'not_found' }, { status: 404 });
  const snapshot = session.deck_snapshot as DeckSnapshot;
  const slides: Slide[] = snapshot?.slides ?? [];

  const [{ data: participants }, { data: responses }, { data: questions }] = await Promise.all([
    admin.from('participants').select('id, nickname, score, streak, joined_at').eq('session_id', sessionId).order('score', { ascending: false }),
    admin.from('responses').select('slide_id, participant_id, payload, answered_ms, is_correct, points, created_at').eq('session_id', sessionId),
    admin.from('qa_questions').select('text, author_nickname, status, upvotes, created_at').eq('session_id', sessionId).order('upvotes', { ascending: false }),
  ]);

  const slideById = new Map(slides.map((s) => [s.id, s]));
  const pById = new Map((participants ?? []).map((p) => [p.id, p]));

  // ---- PDF: branded summary report (leaderboard + activity aggregates + Q&A) ----
  if (format === 'pdf') {
    const bySlide = new Map<string, Record<string, unknown>[]>();
    for (const r of responses ?? []) {
      const payload = (r.payload && typeof r.payload === 'object' ? r.payload : {}) as Record<string, unknown>;
      const list = bySlide.get(r.slide_id);
      if (list) list.push(payload);
      else bySlide.set(r.slide_id, [payload]);
    }

    const pct = (n: number, total: number) => (total > 0 ? ` (${Math.round((n / total) * 100)}%)` : '');

    const activities: ResultsPdfActivity[] = slides
      .filter((s) => INTERACTIVE.has(s.kind))
      .map((s) => {
        const rows = bySlide.get(s.id) ?? [];
        const total = rows.length;
        const options = s.body.options ?? [];
        const correct = new Set<number>(s.kind === 'quiz' ? (s.body.correct ?? []) : []);
        const lines: string[] = [];

        if (s.kind === 'poll' || s.kind === 'quiz' || s.kind === 'ranking') {
          const counts: Record<string, number> = {};
          for (const p of rows) {
            if (p.choice !== undefined && p.choice !== null) {
              const k = String(p.choice);
              counts[k] = (counts[k] ?? 0) + 1;
            } else if (Array.isArray(p.choices)) {
              for (const c of p.choices as unknown[]) counts[String(c)] = (counts[String(c)] ?? 0) + 1;
            }
          }
          options.forEach((opt, i) => {
            const n = counts[String(i)] ?? 0;
            const star = correct.has(i) ? ' [correct]' : '';
            lines.push(`${opt}${star} — ${n}${pct(n, total)}`);
          });
        } else if (s.kind === 'wordcloud') {
          const tally = new Map<string, number>();
          for (const p of rows) {
            if (!Array.isArray(p.words)) continue;
            for (const raw of p.words as unknown[]) {
              const w = String(raw ?? '').trim().toLowerCase();
              if (w) tally.set(w, (tally.get(w) ?? 0) + 1);
            }
          }
          [...tally.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .forEach(([w, c]) => lines.push(`${w} — ${c}`));
        } else if (s.kind === 'scale') {
          const counts: Record<string, number> = {};
          let sum = 0;
          let n = 0;
          for (const p of rows) {
            const v = Number(p.value);
            if (!Number.isFinite(v)) continue;
            counts[String(p.value)] = (counts[String(p.value)] ?? 0) + 1;
            sum += v;
            n += 1;
          }
          const avg = n > 0 ? Math.round((sum / n) * 100) / 100 : 0;
          lines.push(`Average: ${avg} (from ${n} rating${n === 1 ? '' : 's'})`);
          Object.keys(counts)
            .sort((a, b) => Number(a) - Number(b))
            .forEach((k) => lines.push(`${k} — ${counts[k]}${pct(counts[k], n)}`));
        } else {
          // open_text — sample the most recent entries
          rows
            .map((p) => String(p.text ?? '').trim())
            .filter(Boolean)
            .slice(0, 20)
            .forEach((t) => lines.push(`"${t}"`));
        }

        return { title: s.title ?? '', kind: s.kind, prompt: s.body.prompt ?? '', lines, total };
      });

    const pdf = await buildResultsPdf({
      session: {
        code: session.code,
        title: snapshot?.title ?? 'Untitled deck',
        startedAt: session.started_at ?? null,
        endedAt: session.ended_at ?? null,
        participantCount: (participants ?? []).length,
      },
      leaderboard: (participants ?? []).map((p) => ({ nickname: p.nickname, score: p.score, streak: p.streak })),
      activities,
      questions: (questions ?? []).map((q) => ({
        text: q.text,
        author: q.author_nickname ?? 'Anonymous',
        upvotes: q.upvotes ?? 0,
        status: q.status ?? '',
      })),
      generatedAt: new Date().toISOString().slice(0, 10),
    });

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="pulsedeck-${session.code}-results.pdf"`,
        'referrer-policy': 'no-referrer',
        'cache-control': 'no-store',
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PulseDeck';

  // Sheet 1: Summary / leaderboard
  const sum = wb.addWorksheet('Leaderboard');
  sum.addRow([`PulseDeck session ${session.code}`, snapshot?.title ?? '']);
  sum.addRow(['Started', session.started_at ?? '', 'Ended', session.ended_at ?? '']);
  sum.addRow([]);
  sum.addRow(['Rank', 'Nickname', 'Score', 'Best streak']).font = { bold: true };
  (participants ?? []).forEach((p, i) => sum.addRow([i + 1, p.nickname, p.score, p.streak]));
  sum.columns.forEach((c) => (c.width = 22));

  // Sheet 2: per-activity results
  const res = wb.addWorksheet('Responses');
  res.addRow(['Slide', 'Kind', 'Participant', 'Answer', 'Correct', 'Points', 'Time (ms)', 'At']).font = { bold: true };
  for (const r of responses ?? []) {
    const slide = slideById.get(r.slide_id);
    const p = pById.get(r.participant_id);
    const payload = r.payload as Record<string, unknown>;
    let answer = '';
    if (payload.choice !== undefined) {
      const idx = Number(payload.choice);
      answer = slide?.body.options?.[idx] ?? String(payload.choice);
    } else if (Array.isArray(payload.choices)) {
      answer = (payload.choices as number[]).map((i) => slide?.body.options?.[i] ?? i).join('; ');
    } else if (Array.isArray(payload.words)) answer = (payload.words as string[]).join('; ');
    else if (payload.text !== undefined) answer = String(payload.text);
    else if (payload.value !== undefined) answer = String(payload.value);
    else if (Array.isArray(payload.ranking)) answer = (payload.ranking as number[]).map((i) => slide?.body.options?.[i] ?? i).join(' > ');
    res.addRow([
      slide?.title || slide?.body.prompt || r.slide_id,
      slide?.kind ?? '',
      p?.nickname ?? 'unknown',
      answer,
      r.is_correct === null ? '' : r.is_correct ? 'yes' : 'no',
      r.points,
      r.answered_ms ?? '',
      r.created_at,
    ]);
  }
  res.columns.forEach((c) => (c.width = 28));

  // Sheet 3: Q&A
  const qa = wb.addWorksheet('Q&A');
  qa.addRow(['Question', 'Author', 'Upvotes', 'Status', 'At']).font = { bold: true };
  (questions ?? []).forEach((q) => qa.addRow([q.text, q.author_nickname, q.upvotes, q.status, q.created_at]));
  qa.columns.forEach((c) => (c.width = 40));

  if (format === 'csv') {
    // CSV: flatten the Responses sheet (the most useful raw data)
    const lines: string[] = [];
    res.eachRow((row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`);
      lines.push(vals.join(','));
    });
    return new Response(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="pulsedeck-${session.code}-results.csv"`,
        'referrer-policy': 'no-referrer',
        'cache-control': 'no-store',
      },
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="pulsedeck-${session.code}-results.xlsx"`,
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    },
  });
}
