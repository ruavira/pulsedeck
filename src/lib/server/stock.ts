import 'server-only';

// Curated stock imagery. Two sources, both env-gated + best-effort:
//   • Pexels    (PEXELS_API_KEY)         — clean license, no attribution required.
//   • Unsplash  (UNSPLASH_ACCESS_KEY)    — the library Gamma leans on; larger/higher
//                                          quality. Requires the API download-trigger
//                                          ping (done here) and, per Unsplash terms,
//                                          photo attribution + Production approval for
//                                          >50 req/hour (see docs/GAMMA_PARITY_PLATFORMS).
// With no keys the feature is inert and deck generation simply produces no images,
// exactly like the AI features degrade without ANTHROPIC_API_KEY.

const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';
const UNSPLASH_ENDPOINT = 'https://api.unsplash.com/search/photos';
const PIXABAY_ENDPOINT = 'https://pixabay.com/api/';

export type StockSource = 'auto' | 'pexels' | 'unsplash' | 'pixabay';
export type ResolvedStockSource = 'pexels' | 'unsplash' | 'pixabay';

export function stockEnabled(): boolean {
  return (
    !!process.env.PEXELS_API_KEY ||
    !!process.env.UNSPLASH_ACCESS_KEY ||
    !!process.env.PIXABAY_API_KEY
  );
}

/** Which stock sources are configured, Unsplash first (Gamma-like default). */
export function stockSources(): ResolvedStockSource[] {
  const out: ResolvedStockSource[] = [];
  if (process.env.UNSPLASH_ACCESS_KEY) out.push('unsplash');
  if (process.env.PEXELS_API_KEY) out.push('pexels');
  if (process.env.PIXABAY_API_KEY) out.push('pixabay');
  return out;
}

/** Resolve a requested source to one that's configured (or null if none). */
function pickStockSource(pref?: StockSource): ResolvedStockSource | null {
  const avail = stockSources();
  if (pref && pref !== 'auto' && avail.includes(pref)) return pref;
  return avail[0] ?? null;
}

interface StockImage {
  url: string;
  alt: string;
}

// ---------- Pexels ----------
interface PexelsPhoto {
  id: number;
  alt?: string;
  src?: { landscape?: string; large2x?: string; large?: string; original?: string };
}

async function searchPexels(q: string, variant: number): Promise<StockImage | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const url = `${PEXELS_ENDPOINT}?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`;
  try {
    const res = await fetch(url, { headers: { Authorization: key } });
    if (!res.ok) return null;
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    const photos = (data.photos ?? []).filter((p) => p.src?.landscape || p.src?.large);
    if (photos.length === 0) return null;
    const pick = photos[variant % photos.length];
    const src = pick.src?.landscape || pick.src?.large2x || pick.src?.large || pick.src?.original;
    if (!src) return null;
    return { url: src, alt: pick.alt?.trim() || q };
  } catch {
    return null;
  }
}

// ---------- Unsplash ----------
interface UnsplashPhoto {
  alt_description?: string;
  description?: string;
  urls?: { full?: string; regular?: string; small?: string };
  links?: { download_location?: string };
}

async function searchUnsplash(q: string, variant: number): Promise<StockImage | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const url = `${UNSPLASH_ENDPOINT}?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&content_filter=high`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: UnsplashPhoto[] };
    const photos = (data.results ?? []).filter((p) => p.urls?.regular || p.urls?.full);
    if (photos.length === 0) return null;
    const pick = photos[variant % photos.length];
    const src = pick.urls?.regular || pick.urls?.full || pick.urls?.small;
    if (!src) return null;
    // Unsplash API guideline: trigger a download event when an image is used.
    // Fire-and-forget — never blocks or fails image resolution.
    const dl = pick.links?.download_location;
    if (dl) void fetch(`${dl}`, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
    return { url: src, alt: pick.alt_description?.trim() || pick.description?.trim() || q };
  } catch {
    return null;
  }
}

// ---------- Pixabay ----------
interface PixabayHit {
  largeImageURL?: string;
  webformatURL?: string;
  tags?: string;
}

async function searchPixabay(q: string, variant: number): Promise<StockImage | null> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  const url =
    `${PIXABAY_ENDPOINT}?key=${key}&q=${encodeURIComponent(q)}` +
    `&image_type=photo&orientation=horizontal&per_page=12&safesearch=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { hits?: PixabayHit[] };
    const hits = (data.hits ?? []).filter((h) => h.largeImageURL || h.webformatURL);
    if (hits.length === 0) return null;
    const pick = hits[variant % hits.length];
    const src = pick.largeImageURL || pick.webformatURL;
    if (!src) return null;
    return { url: src, alt: pick.tags?.split(',')[0]?.trim() || q };
  } catch {
    return null;
  }
}

const SEARCHERS: Record<ResolvedStockSource, (q: string, v: number) => Promise<StockImage | null>> = {
  unsplash: searchUnsplash,
  pexels: searchPexels,
  pixabay: searchPixabay,
};

/**
 * Resolve a short search phrase to a single landscape image URL (or null).
 * Picks the requested source (or the best configured one), and falls back to the
 * other configured source if the first yields nothing. Deterministic-ish: the
 * `variant` index keeps the same slide on the same image across regenerations and
 * avoids every slide colliding on photo #1.
 */
export async function searchStockImage(
  query: string,
  variant = 0,
  source?: StockSource,
): Promise<StockImage | null> {
  const q = query.trim().slice(0, 80);
  if (!q) return null;
  const primary = pickStockSource(source);
  if (!primary) return null;
  // Try the chosen source first, then every other configured source in order.
  const order: ResolvedStockSource[] = [primary, ...stockSources().filter((s) => s !== primary)];
  for (const src of order) {
    const img = await SEARCHERS[src](q, variant);
    if (img) return img;
  }
  return null;
}

/** Bounded-concurrency resolver for a batch of (index, query) requests. */
export async function resolveStockImages(
  jobs: { idx: number; query: string }[],
  concurrency = 4,
  source?: StockSource,
): Promise<Map<number, StockImage>> {
  const out = new Map<number, StockImage>();
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const img = await searchStockImage(job.query, job.idx, source);
      if (img) out.set(job.idx, img);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return out;
}
