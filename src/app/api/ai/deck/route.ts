import { proGate } from '@/lib/auth';
import { aiEnabled, aiDisabledResponse, claudeJson, DECK_SCHEMA_GUIDE } from '@/lib/server/ai';
import { stockEnabled, resolveStockImages, type StockSource } from '@/lib/server/stock';
import { imagegenEnabled, resolveGeneratedImages } from '@/lib/server/imagegen';
import type { DeckTheme, ImageProvider, ImageStyle, Slide, ThemePack } from '@/lib/types';

// Only these content layouts read well behind a full-bleed photo + scrim.
// Data-dense slides (stats/cards/columns) stay clean — we drop their image hint.
const IMAGE_OK_LAYOUTS = new Set(['title', 'statement', 'full', undefined]);
const MAX_IMAGES = 8; // bound API calls + avoid a photo on every slide

const THEME_PACKS: readonly ThemePack[] = [
  'ice',
  'sky',
  'teal',
  'sunrise',
  'navy',
  'aurora',
  'sand',
  'pop',
] as const;

/** Keep only a valid pack; drop anything else so a bad value never ships. */
function normalizeTheme(raw: unknown): DeckTheme {
  const pack = (raw as { pack?: string } | undefined)?.pack;
  return THEME_PACKS.includes(pack as ThemePack) ? { pack: pack as ThemePack } : {};
}

export const runtime = 'nodejs';
export const maxDuration = 120;

interface DeckGenRequest {
  topic?: string;
  outline?: string; // markdown/plain outline to convert
  slideCount?: number;
  audience?: string;
  tone?: string;
  aiImages?: boolean; // generate bespoke images instead of stock photos
  imageStyle?: ImageStyle; // per-deck image look (photographic/editorial/…)
  imageProvider?: ImageProvider; // preferred engine ('auto' = best available)
  stockSource?: StockSource; // preferred stock library when not using AI images
}

// POST /api/ai/deck — generate a full interactive deck from a topic or outline
export async function POST(req: Request) {
  if (!aiEnabled()) return aiDisabledResponse();
  const gate = await proGate();
  if (gate) return gate;
  const body = (await req.json().catch(() => ({}))) as DeckGenRequest;
  if (!body.topic && !body.outline) {
    return Response.json({ error: 'topic or outline required' }, { status: 400 });
  }

  const count = Math.min(Math.max(body.slideCount ?? 10, 3), 24);
  const system = `You are PulseDeck's presentation designer: you create world-class interactive presentations. ${DECK_SCHEMA_GUIDE}`;
  const user = body.outline
    ? `Convert this outline into an interactive deck of about ${count} slides.${body.audience ? ` Audience: ${body.audience}.` : ''}${body.tone ? ` Tone: ${body.tone}.` : ''}\n\nOUTLINE:\n${body.outline.slice(0, 12000)}`
    : `Create an interactive deck of about ${count} slides on: "${body.topic}".${body.audience ? ` Audience: ${body.audience}.` : ''}${body.tone ? ` Tone: ${body.tone}.` : ''} Include at least one poll, one word cloud, one quiz question and one Q&A slide.`;

  try {
    const deck = await claudeJson<{ title: string; theme?: unknown; slides: Slide[] }>(
      system,
      user,
      12000,
    );
    if (!deck.title || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      return Response.json({ error: 'ai_bad_output' }, { status: 502 });
    }
    // Normalize: ensure ids/positions exist
    const slides = deck.slides.map((s, i) => ({
      id: crypto.randomUUID(),
      kind: s.kind ?? 'content',
      title: s.title ?? '',
      body: s.body ?? {},
      settings: s.settings ?? {},
      position: i,
    }));

    // Resolve stock imagery: for content slides the AI tagged with an imageQuery
    // (and only on photo-friendly layouts), fetch a landscape photo and promote
    // it to a full-bleed backgroundImage. Env-gated + fully best-effort — any
    // failure just leaves the slide text-only. The imageQuery hint is always
    // stripped so it never leaks to the client/renderer.
    // Prefer AI-generated images when the caller opts in AND fal.ai is configured;
    // otherwise fall back to curated stock. Both are env-gated + best-effort.
    const useAiImages = body.aiImages === true && imagegenEnabled();
    if (useAiImages || stockEnabled()) {
      const jobs: { idx: number; query: string }[] = [];
      slides.forEach((s, idx) => {
        const q = s.body?.imageQuery?.trim();
        const okLayout = IMAGE_OK_LAYOUTS.has(s.settings?.layout);
        if (
          jobs.length < MAX_IMAGES &&
          s.kind === 'content' &&
          q &&
          okLayout &&
          !s.body.backgroundImage
        ) {
          jobs.push({ idx, query: q });
        }
      });
      if (jobs.length > 0) {
        if (useAiImages) {
          const gen = await resolveGeneratedImages(jobs, {
            provider: body.imageProvider,
            style: body.imageStyle,
          });
          gen.forEach((url, idx) => {
            slides[idx].body = { ...slides[idx].body, backgroundImage: url };
          });
          // Any slides the generator missed fall back to stock, if available.
          if (stockEnabled()) {
            const missed = jobs.filter((j) => !gen.has(j.idx));
            if (missed.length > 0) {
              const stock = await resolveStockImages(missed, 4, body.stockSource);
              stock.forEach((img, idx) => {
                slides[idx].body = { ...slides[idx].body, backgroundImage: img.url };
              });
            }
          }
        } else {
          const images = await resolveStockImages(jobs, 4, body.stockSource);
          images.forEach((img, idx) => {
            slides[idx].body = { ...slides[idx].body, backgroundImage: img.url };
          });
        }
      }
    }
    // imageQuery is kept on the slide so the editor's "shuffle photo" control can
    // reuse the AI's original search phrase.

    // Carry the caller's chosen image look onto the deck theme so reshuffles and
    // later edits stay visually consistent with what was just generated.
    const theme: DeckTheme = {
      ...normalizeTheme(deck.theme),
      ...(body.imageStyle ? { imageStyle: body.imageStyle } : {}),
      ...(body.imageProvider ? { imageProvider: body.imageProvider } : {}),
    };
    return Response.json({ title: deck.title, theme, slides });
  } catch (e) {
    return Response.json({ error: `ai_failed: ${(e as Error).message}` }, { status: 502 });
  }
}
