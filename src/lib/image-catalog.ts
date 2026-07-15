// Client-safe catalog of image styles and providers. NO secrets, NO env reads,
// NO server-only imports — this is imported by studio UI *and* the server
// registry so both share one source of truth for ids, labels, tiers and costs.
// Actual generation logic + key/env reads live in src/lib/server/imagegen.ts.
import type { ImageProvider, ImageStyle } from '@/lib/types';

export interface ImageStyleMeta {
  id: ImageStyle;
  label: string;
  hint: string;
}

/** Per-deck image looks. Order = display order in the picker. */
export const IMAGE_STYLES: readonly ImageStyleMeta[] = [
  { id: 'auto', label: 'Auto', hint: 'Cinematic editorial default — good all-rounder.' },
  { id: 'photographic', label: 'Photographic', hint: 'Realistic photography, natural light.' },
  { id: 'editorial', label: 'Editorial', hint: 'Magazine-grade, dramatic, high-contrast.' },
  { id: 'render3d', label: '3D render', hint: 'Soft 3D, clean studio product look.' },
  { id: 'illustration', label: 'Illustration', hint: 'Modern digital illustration.' },
  { id: 'vector', label: 'Vector', hint: 'Flat vector shapes, bold and simple.' },
  { id: 'watercolor', label: 'Watercolor', hint: 'Soft painterly washes.' },
  { id: 'mono', label: 'Mono', hint: 'Monochrome, single-hue minimal.' },
] as const;

export type ProviderTier = 'free' | 'paid';

export interface ImageProviderMeta {
  id: ImageProvider;
  label: string;
  tier: ProviderTier;
  /** Short human cost label shown next to the option. */
  cost: string;
  /** One-line description for the picker. */
  hint: string;
  /**
   * Env var(s) the server needs for this provider to be usable. Empty = keyless
   * (always available). The *catalog* only names them; the server decides
   * availability. Never contains a value — just the variable name(s).
   */
  keyEnv: readonly string[];
  /**
   * Whether the generation call is actually implemented. Providers with
   * `wired: false` show in the picker as "coming soon" and are never selected
   * for real generation (the server falls back). This lets the full Gamma-shaped
   * provider list ship now, with engines lit up incrementally.
   */
  wired: boolean;
}

/**
 * The full provider surface Gamma-style. Free engines first. `auto` is the
 * default: the server picks the best *available* engine (currently Pollinations,
 * or Cloudflare/fal/OpenAI/Stability when their keys are set).
 */
export const IMAGE_PROVIDERS: readonly ImageProviderMeta[] = [
  {
    id: 'auto',
    label: 'Auto (best available)',
    tier: 'free',
    cost: 'Free',
    hint: 'Uses the best engine that is configured. Always works.',
    keyEnv: [],
    wired: true,
  },
  {
    id: 'pollinations',
    label: 'Pollinations · FLUX',
    tier: 'free',
    cost: 'Free',
    hint: 'Keyless FLUX. No account, no billing. The default free engine.',
    keyEnv: [],
    wired: true,
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare Workers AI · FLUX',
    tier: 'free',
    cost: 'Free tier',
    hint: 'Free FLUX on your Cloudflare account (needs account id + token).',
    keyEnv: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    wired: true,
  },
  {
    id: 'fal',
    label: 'fal.ai · FLUX schnell',
    tier: 'paid',
    cost: '~$0.003 / image',
    hint: 'Fast, high-quality FLUX. Needs a fal.ai key.',
    keyEnv: ['FAL_KEY'],
    wired: true,
  },
  {
    id: 'openai',
    label: 'OpenAI · GPT-Image-1',
    tier: 'paid',
    cost: '~$0.04 / image',
    hint: 'Strong prompt-following and text. Needs an OpenAI key.',
    keyEnv: ['OPENAI_API_KEY'],
    wired: true,
  },
  {
    id: 'stability',
    label: 'Stability · SD3',
    tier: 'paid',
    cost: '~$0.04 / image',
    hint: 'Stable Diffusion 3. Needs a Stability key.',
    keyEnv: ['STABILITY_API_KEY'],
    wired: true,
  },
  {
    id: 'imagen',
    label: 'Google · Imagen 3',
    tier: 'paid',
    cost: '~$0.03 / image',
    hint: 'Google Imagen via the Gemini API. Add GOOGLE_IMAGEN_KEY.',
    keyEnv: ['GOOGLE_IMAGEN_KEY'],
    wired: true,
  },
  {
    id: 'ideogram',
    label: 'Ideogram · v3',
    tier: 'paid',
    cost: '~$0.06 / image',
    hint: 'Best-in-class text-in-image. Add IDEOGRAM_API_KEY.',
    keyEnv: ['IDEOGRAM_API_KEY'],
    wired: true,
  },
  {
    id: 'replicate',
    label: 'Replicate · FLUX',
    tier: 'paid',
    cost: '~$0.003 / image',
    hint: 'FLUX schnell hosted on Replicate. Add REPLICATE_API_TOKEN.',
    keyEnv: ['REPLICATE_API_TOKEN'],
    wired: true,
  },
  {
    id: 'recraft',
    label: 'Recraft · V3',
    tier: 'paid',
    cost: '~$0.04 / image',
    hint: 'Brand/vector-strong; maps to your style preset. Add RECRAFT_API_KEY.',
    keyEnv: ['RECRAFT_API_KEY'],
    wired: true,
  },
  {
    id: 'leonardo',
    label: 'Leonardo · Phoenix',
    tier: 'paid',
    cost: 'Varies (credits)',
    hint: 'Leonardo.ai Phoenix. Add LEONARDO_API_KEY.',
    keyEnv: ['LEONARDO_API_KEY'],
    wired: true,
  },
] as const;

export const imageProviderMeta = (id: ImageProvider): ImageProviderMeta | undefined =>
  IMAGE_PROVIDERS.find((p) => p.id === id);
