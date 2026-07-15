import 'server-only';
import { createHash } from 'node:crypto';
import { getAdmin } from '@/lib/supabase/admin';
import type { ImageProvider, ImageStyle } from '@/lib/types';
import { IMAGE_PROVIDERS } from '@/lib/image-catalog';

// ─────────────────────────────────────────────────────────────────────────────
// Pluggable AI hero-image registry.
//
// Every provider is declared in the shared catalog (src/lib/image-catalog.ts);
// this module holds the actual generate() calls + the env reads that decide which
// engines are *available*. Free engines (Pollinations = keyless, Cloudflare =
// free tier) work out of the box; paid engines (fal, OpenAI, Stability, …) light
// up only when their API key env var is present. Unwired providers are declared
// but never generate (the resolver falls back), so the full Gamma-shaped surface
// ships now and engines can be lit incrementally.
//
// Contract mirrors stock.ts: an availability gate + a single-image generator +
// a bounded-concurrency batch resolver returning Map<idx, url>. Every call is
// best-effort — the deck route falls back to curated stock for any miss.
// ─────────────────────────────────────────────────────────────────────────────

const POLLINATIONS = 'https://image.pollinations.ai/prompt/';
const FAL_ENDPOINT = 'https://fal.run/fal-ai/flux/schnell';
// Generated images are hosted in the same public `media` bucket the upload route
// uses (proven writable by the x-server-secret admin client), so byte-returning
// engines yield lightweight hosted URLs instead of bloating the deck JSON — no
// new secret required. If the upload ever fails, we fall back to an inline data URL.
const STORAGE_BUCKET = 'media';

/** Always available — Pollinations needs no key, so image generation never hard-fails. */
export function imagegenEnabled(): boolean {
  return true;
}

// ---------- prompt shaping ----------

// Style modifiers keep a deck's imagery visually coherent (Gamma-style). Kept
// server-side so prompt engineering stays in one place; the ids/labels are shared.
const STYLE_MODIFIER: Record<ImageStyle, string> = {
  auto: 'Dramatic lighting, rich depth of field, professional composition.',
  photographic:
    'Realistic photography, natural light, shallow depth of field, true-to-life color.',
  editorial:
    'High-end editorial magazine photography, dramatic directional light, bold high contrast, striking composition.',
  render3d:
    'Soft 3D render, clean studio lighting, smooth materials, subtle ambient occlusion, product-shot look.',
  illustration:
    'Modern digital illustration, clean linework, harmonious flat-plus-gradient shading, editorial illustration style.',
  vector:
    'Flat vector illustration, bold simple geometric shapes, limited palette, crisp edges, no photographic texture.',
  watercolor:
    'Soft watercolor painting, gentle washes, organic bleeds, textured paper, muted painterly palette.',
  mono: 'Monochrome single-hue minimalist image, elegant negative space, restrained tonal range.',
};

function heroPrompt(query: string, style: ImageStyle = 'auto'): string {
  const look = STYLE_MODIFIER[style] ?? STYLE_MODIFIER.auto;
  const noun = style === 'auto' ? 'cinematic editorial photograph' : 'image';
  return `A striking, high-quality ${noun} representing "${query}". ${look} No text, no words, no watermark, no logos.`;
}

// ---------- storage (for engines that return raw bytes) ----------

/**
 * Turn raw image bytes into a URL the renderer can use. Primary path uploads to
 * the public `media` bucket (deterministic content-hash object path, so the same
 * prompt+seed reuses one object) via the admin client and returns a lightweight
 * hosted URL. If that fails for any reason, inline the image as a `data:` URL so a
 * configured engine always yields an image.
 */
async function persistBytes(
  bytes: Uint8Array,
  contentType: string,
  key: string,
): Promise<string | null> {
  try {
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const path = `gen/${createHash('sha1').update(key).digest('hex')}.${ext}`;
    const admin = getAdmin();
    const up = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(path, Buffer.from(bytes), { contentType, upsert: true });
    if (!up.error) {
      const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      if (data.publicUrl) return data.publicUrl;
    }
  } catch {
    /* fall through to data URL */
  }
  // Inline fallback — no hosting required.
  return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

// ---------- provider availability ----------

/** True if every env var this provider needs is set (keyless → always true). */
function providerConfigured(id: ImageProvider): boolean {
  const meta = IMAGE_PROVIDERS.find((p) => p.id === id);
  if (!meta || !meta.wired) return false;
  return meta.keyEnv.every((k) => !!process.env[k]);
}

/** The set of provider ids that can actually generate right now. */
export function availableProviders(): ImageProvider[] {
  return IMAGE_PROVIDERS.filter((p) => p.wired && providerConfigured(p.id)).map((p) => p.id);
}

// 'auto' considers FREE engines ONLY, so the default never silently spends money
// or swaps the deck's look. Paid engines (fal/openai/stability) are used solely
// when the presenter explicitly selects them. Pollinations first (keyless, hosted
// URL, lightweight decks); Cloudflare next (free tier on the user's own account).
const AUTO_ORDER: ImageProvider[] = ['pollinations', 'cloudflare'];

/** Resolve a requested provider to one that's actually available. */
function pickProvider(requested?: ImageProvider): ImageProvider {
  // Explicit selection (incl. paid) wins when it's actually configured.
  if (requested && requested !== 'auto' && providerConfigured(requested)) return requested;
  // 'auto' or an unavailable request → best available FREE engine.
  for (const id of AUTO_ORDER) if (providerConfigured(id)) return id;
  return 'pollinations'; // keyless floor
}

// ---------- per-provider generators ----------

/** Free Pollinations URL (deterministic by prompt + seed). The URL *is* the image. */
function generatePollinations(query: string, style: ImageStyle, seed: number): string {
  const prompt = encodeURIComponent(heroPrompt(query, style));
  return `${POLLINATIONS}${prompt}?width=1280&height=720&nologo=true&model=flux&seed=${seed}`;
}

/** fal.ai FLUX schnell — returns a persistent fal.media URL. */
async function generateFal(query: string, style: ImageStyle): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  try {
    const res = await fetch(FAL_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: heroPrompt(query, style),
        image_size: 'landscape_16_9',
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { images?: { url?: string }[] };
    const url = data.images?.[0]?.url;
    return typeof url === 'string' ? url : null;
  } catch {
    return null;
  }
}

/** Cloudflare Workers AI FLUX (free tier). Returns base64 → persisted to storage. */
async function generateCloudflare(
  query: string,
  style: ImageStyle,
  seed: number,
): Promise<string | null> {
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!acct || !token) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: heroPrompt(query, style), steps: 6, seed }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { image?: string } };
    const b64 = data.result?.image;
    if (!b64) return null;
    return persistBytes(b64ToBytes(b64), 'image/jpeg', `cf:${style}:${seed}:${query}`);
  } catch {
    return null;
  }
}

/** OpenAI GPT-Image-1. Returns base64 → persisted to storage. */
async function generateOpenAI(query: string, style: ImageStyle): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: heroPrompt(query, style),
        size: '1536x1024',
        n: 1,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const item = data.data?.[0];
    if (item?.b64_json)
      return persistBytes(b64ToBytes(item.b64_json), 'image/png', `oai:${style}:${query}`);
    return item?.url ?? null;
  } catch {
    return null;
  }
}

/** Stability SD3. Returns raw image bytes → persisted to storage. */
async function generateStability(query: string, style: ImageStyle): Promise<string | null> {
  const key = process.env.STABILITY_API_KEY;
  if (!key) return null;
  try {
    const form = new FormData();
    form.append('prompt', heroPrompt(query, style));
    form.append('aspect_ratio', '16:9');
    form.append('output_format', 'jpeg');
    const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' },
      body: form,
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return persistBytes(buf, 'image/jpeg', `sd3:${style}:${query}`);
  } catch {
    return null;
  }
}

/** Google Imagen 3 (Gemini API). Returns base64 → persisted / inlined. */
async function generateImagen(query: string, style: ImageStyle): Promise<string | null> {
  const key = process.env.GOOGLE_IMAGEN_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: heroPrompt(query, style) }],
          parameters: { sampleCount: 1, aspectRatio: '16:9' },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { predictions?: { bytesBase64Encoded?: string }[] };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (!b64) return null;
    return persistBytes(b64ToBytes(b64), 'image/png', `imagen:${style}:${query}`);
  } catch {
    return null;
  }
}

/** Ideogram v3. Returns a hosted URL. */
async function generateIdeogram(query: string, style: ImageStyle): Promise<string | null> {
  const key = process.env.IDEOGRAM_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
      method: 'POST',
      headers: { 'Api-Key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: heroPrompt(query, style),
        rendering_speed: 'TURBO',
        aspect_ratio: '16x9',
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { url?: string }[] };
    return data.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

/** Replicate (FLUX schnell by default). Sync via `Prefer: wait`. Returns a URL. */
async function generateReplicate(query: string, style: ImageStyle): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({
          input: { prompt: heroPrompt(query, style), aspect_ratio: '16:9', output_format: 'jpg' },
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { output?: string | string[] };
    const out = Array.isArray(data.output) ? data.output[0] : data.output;
    return typeof out === 'string' ? out : null;
  } catch {
    return null;
  }
}

/** Recraft V3. Returns a hosted URL. */
async function generateRecraft(query: string, style: ImageStyle): Promise<string | null> {
  const key = process.env.RECRAFT_API_KEY;
  if (!key) return null;
  // Map our style presets onto Recraft's named styles (it's brand/vector-strong).
  const recraftStyle =
    style === 'vector'
      ? 'vector_illustration'
      : style === 'illustration' || style === 'watercolor'
        ? 'digital_illustration'
        : 'realistic_image';
  try {
    const res = await fetch('https://external.api.recraft.ai/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: heroPrompt(query, style),
        style: recraftStyle,
        size: '1820x1024',
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { url?: string }[] };
    return data.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

/** Leonardo Phoenix. Async: create → poll for the image URL (bounded). */
async function generateLeonardo(query: string, style: ImageStyle): Promise<string | null> {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) return null;
  const headers = {
    Authorization: `Bearer ${key}`,
    accept: 'application/json',
    'content-type': 'application/json',
  };
  try {
    const start = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: heroPrompt(query, style),
        width: 1280,
        height: 720,
        num_images: 1,
        modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3', // Leonardo Phoenix 1.0
      }),
    });
    if (!start.ok) return null;
    const startData = (await start.json()) as { sdGenerationJob?: { generationId?: string } };
    const id = startData.sdGenerationJob?.generationId;
    if (!id) return null;
    // Poll up to ~24s (12 × 2s) for the generated image.
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${id}`, {
        headers,
      });
      if (!poll.ok) continue;
      const pd = (await poll.json()) as {
        generations_by_pk?: { status?: string; generated_images?: { url?: string }[] };
      };
      const gen = pd.generations_by_pk;
      if (gen?.status === 'COMPLETE') return gen.generated_images?.[0]?.url ?? null;
      if (gen?.status === 'FAILED') return null;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- public API ----------

export interface GenerateOpts {
  provider?: ImageProvider;
  style?: ImageStyle;
  seed?: number;
}

/**
 * Generate one 16:9 hero image for a concept phrase using the requested engine
 * (or the best available when 'auto' / unavailable). `seed` varies the result
 * for per-slide variety / reshuffle. Best-effort — returns null on any failure.
 */
export async function generateImage(
  query: string,
  opts: GenerateOpts = {},
): Promise<string | null> {
  const q = query.trim().slice(0, 200);
  if (!q) return null;
  const style = opts.style ?? 'auto';
  const seed = opts.seed ?? 1;
  const provider = pickProvider(opts.provider);
  switch (provider) {
    case 'fal':
      return generateFal(q, style);
    case 'openai':
      return generateOpenAI(q, style);
    case 'stability':
      return generateStability(q, style);
    case 'imagen':
      return generateImagen(q, style);
    case 'ideogram':
      return generateIdeogram(q, style);
    case 'replicate':
      return generateReplicate(q, style);
    case 'recraft':
      return generateRecraft(q, style);
    case 'leonardo':
      return generateLeonardo(q, style);
    case 'cloudflare':
      return generateCloudflare(q, style, seed);
    case 'pollinations':
    default:
      return generatePollinations(q, style, seed);
  }
}

/**
 * Bounded-concurrency generator for a batch of (index, query) jobs. Resolves the
 * engine once up front so a whole deck renders in one consistent style/provider.
 */
export async function resolveGeneratedImages(
  jobs: { idx: number; query: string }[],
  opts: GenerateOpts = {},
  concurrency = 3,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const provider = pickProvider(opts.provider);
  const style = opts.style ?? 'auto';
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const url = await generateImage(job.query, { provider, style, seed: job.idx + 1 });
      if (url) out.set(job.idx, url);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return out;
}
